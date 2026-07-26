'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'
import { IrrigationEventSchema } from '@/modules/farm/schemas'
import { revalidatePath } from 'next/cache'
import { Decimal } from 'decimal.js'
import type { IrrigationEvent } from '@prisma/client'

export type IrrigationEventFormData = {
  plotId: string
  date: Date
  method?: string
  durationHours?: number
  flowRate?: number
  volumeApplied?: number
  employeeId?: string
  notes?: string
}

export async function getIrrigationEvents(
  plotId: string
): Promise<(IrrigationEvent & { employee: { id: string; name: string } | null })[]> {
  const { tenantId } = await requirePermission('farm:read')

  return prisma.irrigationEvent.findMany({
    where: { tenantId, plotId },
    include: { employee: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
  })
}

export async function createIrrigationEvent(data: IrrigationEventFormData) {
  const { tenantId } = await requirePermission('farm:write')

  const parsed = IrrigationEventSchema.safeParse(data)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  const plot = await prisma.plot.findFirst({ where: { id: data.plotId, tenantId } })
  if (!plot) throw new Error('Talhão não encontrado')

  await prisma.irrigationEvent.create({
    data: {
      tenantId,
      plotId: data.plotId,
      date: new Date(data.date),
      method: data.method || null,
      durationHours: data.durationHours !== undefined ? new Decimal(data.durationHours) : null,
      flowRate: data.flowRate !== undefined ? new Decimal(data.flowRate) : null,
      volumeApplied: data.volumeApplied !== undefined ? new Decimal(data.volumeApplied) : null,
      employeeId: data.employeeId || null,
      notes: data.notes || null,
    },
  })

  revalidatePath(`/${tenantId}/talhoes/${data.plotId}`)
}

export async function deleteIrrigationEvent(id: string) {
  const { tenantId } = await requirePermission('farm:delete')

  const event = await prisma.irrigationEvent.findFirst({ where: { id, tenantId } })
  if (!event) throw new Error('Registro não encontrado')

  await prisma.irrigationEvent.deleteMany({ where: { id, tenantId } })

  revalidatePath(`/${tenantId}/talhoes/${event.plotId}`)
}
