'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { Decimal } from 'decimal.js'
import type { Silo } from '@prisma/client'

export type SiloFormData = {
  name: string
  capacity: number
  unit?: string // TON, BAG, KG
}

export async function getSilos(): Promise<Silo[]> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.silo.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  })
}

export async function getSiloById(id: string): Promise<Silo | null> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.silo.findFirst({ where: { id, tenantId } })
}

export async function createSilo(data: SiloFormData) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.silo.create({
    data: {
      tenantId,
      name: data.name,
      capacity: new Decimal(data.capacity),
      unit: data.unit ?? 'TON',
    },
  })

  revalidatePath(`/${tenantId}/silos`)
}

export async function updateSilo(id: string, data: Partial<SiloFormData>) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const updateData: any = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.capacity !== undefined) updateData.capacity = new Decimal(data.capacity)
  if (data.unit !== undefined) updateData.unit = data.unit

  await prisma.silo.updateMany({ where: { id, tenantId }, data: updateData })

  revalidatePath(`/${tenantId}/silos`)
}

export async function deleteSilo(id: string) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.silo.deleteMany({ where: { id, tenantId } })

  revalidatePath(`/${tenantId}/silos`)
}
