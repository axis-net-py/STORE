'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'
import { revalidatePath } from 'next/cache'
import type { Service } from '@prisma/client'
import { ServiceSchema, type ServiceFormData } from '@/modules/clinic/schemas'
import { AuthError, handleActionError } from '@/lib/errors'

function requireTenant(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user?.tenantId) throw new AuthError()
  return session.user.tenantId
}

export async function getServices(): Promise<Service[]> {
  const { tenantId } = await requirePermission('clinic:read')
  return prisma.service.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
}

export async function createService(data: ServiceFormData) {
  try {
    const { tenantId } = await requirePermission('clinic:write')
    const parsed = ServiceSchema.parse(data)

    await prisma.service.create({
      data: { tenantId, ...parsed },
    })

    revalidatePath(`/${tenantId}/servicos`)
  } catch (error) {
    handleActionError(error)
  }
}

export async function updateService(id: string, data: Partial<ServiceFormData>) {
  try {
    const { tenantId } = await requirePermission('clinic:write')
    const parsed = ServiceSchema.partial().parse(data)

    await prisma.service.updateMany({
      where: { id, tenantId },
      data: parsed,
    })

    revalidatePath(`/${tenantId}/servicos`)
  } catch (error) {
    handleActionError(error)
  }
}

export async function deleteService(id: string) {
  try {
    const { tenantId } = await requirePermission('clinic:delete')

    await prisma.service.deleteMany({ where: { id, tenantId } })
    revalidatePath(`/${tenantId}/servicos`)
  } catch (error) {
    handleActionError(error)
  }
}
