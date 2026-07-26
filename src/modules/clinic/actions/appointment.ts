'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'
import { revalidatePath } from 'next/cache'
import type { AppointmentStatus } from '@prisma/client'
import {
  AppointmentSchema,
  CompleteAppointmentSchema,
  type AppointmentFormData,
  type CompleteAppointmentFormData,
} from '@/modules/clinic/schemas'
import { AuthError, ValidationError, handleActionError } from '@/lib/errors'
import { overlaps } from '@/modules/clinic/lib/agenda'
import { createSalesInvoice } from '@/app/actions/invoice'

function requireTenant(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user?.tenantId) throw new AuthError()
  return session.user.tenantId
}

/** Dados da janela visível da agenda + catálogos para os formulários. */
export async function getAgendaData(fromISO: string, toISO: string) {
  const { tenantId } = await requirePermission('clinic:read')
  const from = new Date(fromISO)
  const to = new Date(toISO)

  const [appointments, professionals, services, patients] = await Promise.all([
    prisma.appointment.findMany({
      where: { tenantId, startsAt: { lt: to }, endsAt: { gt: from } },
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        professional: { select: { id: true, name: true, color: true } },
        service: { select: { id: true, name: true, durationMin: true, price: true } },
      },
      orderBy: { startsAt: 'asc' },
    }),
    prisma.professional.findMany({ where: { tenantId, active: true }, orderBy: { name: 'asc' } }),
    prisma.service.findMany({ where: { tenantId, active: true }, orderBy: { name: 'asc' } }),
    prisma.customer.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // Decimal não cruza a fronteira server->client; converter para number.
  return {
    appointments: appointments.map(a => ({
      ...a,
      chargedAmount: a.chargedAmount === null ? null : Number(a.chargedAmount),
      service: { ...a.service, price: Number(a.service.price) },
    })),
    professionals,
    services: services.map(s => ({ ...s, price: Number(s.price) })),
    patients,
  }
}

async function assertNoConflict(
  tenantId: string,
  professionalId: string,
  startsAt: Date,
  endsAt: Date,
  ignoreId?: string
) {
  const sameDay = await prisma.appointment.findMany({
    where: {
      tenantId,
      professionalId,
      status: { notIn: ['CANCELADA'] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
    select: { id: true, startsAt: true, endsAt: true },
  })
  const conflict = sameDay.find(a => overlaps(startsAt, endsAt, a.startsAt, a.endsAt))
  if (conflict) {
    throw new ValidationError(
      `Conflito de horário: o profissional já tem consulta das ${conflict.startsAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às ${conflict.endsAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`
    )
  }
}

export async function createAppointment(data: AppointmentFormData) {
  try {
    const { tenantId } = await requirePermission('clinic:write')
    const parsed = AppointmentSchema.parse(data)

    const service = await prisma.service.findFirst({
      where: { id: parsed.serviceId, tenantId },
      select: { durationMin: true, price: true },
    })
    if (!service) throw new ValidationError('Serviço não encontrado')

    const endsAt = new Date(parsed.startsAt.getTime() + service.durationMin * 60_000)
    await assertNoConflict(tenantId, parsed.professionalId, parsed.startsAt, endsAt)

    await prisma.appointment.create({
      data: {
        tenantId,
        patientId: parsed.patientId,
        professionalId: parsed.professionalId,
        serviceId: parsed.serviceId,
        startsAt: parsed.startsAt,
        endsAt,
        chargedAmount: service.price,
      },
    })

    revalidatePath(`/${tenantId}/agenda`)
  } catch (error) {
    handleActionError(error)
  }
}

export async function rescheduleAppointment(id: string, startsAtISO: string) {
  try {
    const { tenantId } = await requirePermission('clinic:write')
    const startsAt = new Date(startsAtISO)
    if (isNaN(startsAt.getTime())) throw new ValidationError('Data inválida')

    const appt = await prisma.appointment.findFirst({
      where: { id, tenantId },
      select: { professionalId: true, startsAt: true, endsAt: true },
    })
    if (!appt) throw new ValidationError('Consulta não encontrada')

    const duration = appt.endsAt.getTime() - appt.startsAt.getTime()
    const endsAt = new Date(startsAt.getTime() + duration)
    await assertNoConflict(tenantId, appt.professionalId, startsAt, endsAt, id)

    await prisma.appointment.updateMany({
      where: { id, tenantId },
      data: { startsAt, endsAt, status: 'AGENDADA' },
    })

    revalidatePath(`/${tenantId}/agenda`)
  } catch (error) {
    handleActionError(error)
  }
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus) {
  try {
    const { tenantId } = await requirePermission('clinic:write')

    await prisma.appointment.updateMany({ where: { id, tenantId }, data: { status } })
    revalidatePath(`/${tenantId}/agenda`)
  } catch (error) {
    handleActionError(error)
  }
}

/** Gera fatura de venda da consulta CONCLUIDA reusando o fluxo fiscal existente.
 * O serviço vira um Product espelho (isService: true — sem estoque) para caber no InvoiceItem. */
export async function invoiceAppointment(id: string) {
  try {
    const { tenantId } = await requirePermission('clinic:write')

    const appt = await prisma.appointment.findFirst({
      where: { id, tenantId },
      include: { service: true, patient: { select: { id: true } } },
    })
    if (!appt) throw new ValidationError('Consulta não encontrada')
    if (appt.status !== 'CONCLUIDA') throw new ValidationError('Só é possível faturar consultas concluídas')
    if (appt.invoiceId) throw new ValidationError('Esta consulta já foi faturada')

    const amount = Number(appt.chargedAmount ?? appt.service.price)
    if (!amount || amount <= 0) throw new ValidationError('Valor cobrado inválido — edite a consulta antes de faturar')

    const sku = `SVC-${appt.service.id.slice(-6).toUpperCase()}`
    let product = await prisma.product.findFirst({ where: { tenantId, sku } })
    if (!product) {
      product = await prisma.product.create({
        data: {
          tenantId,
          sku,
          name: appt.service.name,
          price: appt.service.price,
          isService: true,
          unit: 'serv',
        },
      })
    }

    const invoice = await createSalesInvoice({
      type: 'SALES',
      customerId: appt.patient.id,
      notes: `Atendimento de ${appt.startsAt.toLocaleDateString('pt-BR')} — ${appt.service.name}`,
      items: [{ productId: product.id, quantity: 1, unitPrice: amount }],
    })

    await prisma.appointment.updateMany({
      where: { id, tenantId },
      data: { invoiceId: invoice.id },
    })

    revalidatePath(`/${tenantId}/agenda`)
    revalidatePath(`/${tenantId}/customers/${appt.patient.id}`)
    return { invoiceId: invoice.id }
  } catch (error) {
    handleActionError(error)
  }
}

export async function completeAppointment(id: string, data: CompleteAppointmentFormData) {
  try {
    const { tenantId } = await requirePermission('clinic:write')
    const parsed = CompleteAppointmentSchema.parse(data)

    await prisma.appointment.updateMany({
      where: { id, tenantId },
      data: {
        status: 'CONCLUIDA',
        clinicalNotes: parsed.clinicalNotes,
        ...(parsed.chargedAmount !== undefined ? { chargedAmount: parsed.chargedAmount } : {}),
      },
    })

    revalidatePath(`/${tenantId}/agenda`)
  } catch (error) {
    handleActionError(error)
  }
}
