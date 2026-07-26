'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'
import { revalidatePath } from 'next/cache'
import type { Professional } from '@prisma/client'
import { ProfessionalSchema, type ProfessionalFormData } from '@/modules/clinic/schemas'
import { AuthError, handleActionError } from '@/lib/errors'

function requireTenant(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user?.tenantId) throw new AuthError()
  return session.user.tenantId
}

export async function getProfessionals(): Promise<Professional[]> {
  const { tenantId } = await requirePermission('clinic:read')
  return prisma.professional.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
}

export async function createProfessional(data: ProfessionalFormData) {
  try {
    const { tenantId } = await requirePermission('clinic:write')
    const parsed = ProfessionalSchema.parse(data)

    await prisma.professional.create({
      data: { tenantId, ...parsed },
    })

    revalidatePath(`/${tenantId}/profissionais`)
  } catch (error) {
    handleActionError(error)
  }
}

export async function updateProfessional(id: string, data: Partial<ProfessionalFormData>) {
  try {
    const { tenantId } = await requirePermission('clinic:write')
    const parsed = ProfessionalSchema.partial().parse(data)

    await prisma.professional.updateMany({
      where: { id, tenantId },
      data: parsed,
    })

    revalidatePath(`/${tenantId}/profissionais`)
  } catch (error) {
    handleActionError(error)
  }
}

export async function deleteProfessional(id: string): Promise<{ archived: boolean } | undefined> {
  try {
    const { tenantId } = await requirePermission('clinic:delete')

    const professional = await prisma.professional.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!professional) throw new Error('Profissional não encontrado')

    const appointments = await prisma.appointment.count({ where: { professionalId: id } })

    if (appointments > 0) {
      await prisma.professional.update({ where: { id }, data: { active: false } })
      revalidatePath(`/${tenantId}/profissionais`)
      return { archived: true }
    }

    await prisma.professional.deleteMany({ where: { id, tenantId } })
    revalidatePath(`/${tenantId}/profissionais`)
    return { archived: false }
  } catch (error) {
    handleActionError(error)
  }
}
