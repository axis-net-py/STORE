'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { Service } from '@prisma/client'
import { ServiceSchema, type ServiceFormData } from '@/modules/clinic/schemas'
import { AuthError, handleActionError } from '@/lib/errors'

function requireTenant(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user?.tenantId) throw new AuthError()
  return session.user.tenantId
}

export async function getServices(): Promise<Service[]> {
  const session = await auth()
  const tenantId = requireTenant(session)
  return prisma.service.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
}

export async function createService(data: ServiceFormData) {
  try {
    const session = await auth()
    const tenantId = requireTenant(session)
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
    const session = await auth()
    const tenantId = requireTenant(session)
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
    const session = await auth()
    const tenantId = requireTenant(session)

    await prisma.service.deleteMany({ where: { id, tenantId } })
    revalidatePath(`/${tenantId}/servicos`)
  } catch (error) {
    handleActionError(error)
  }
}
