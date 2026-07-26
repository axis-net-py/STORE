'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'
import { revalidatePath } from 'next/cache'
import { Decimal } from 'decimal.js'
import type { Silo } from '@prisma/client'

export type SiloFormData = {
  name: string
  capacity: number
  unit?: string // TON, BAG, KG
}

export async function getSilos(): Promise<Silo[]> {
  const { tenantId } = await requirePermission('farm:read')

  return prisma.silo.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  })
}

export async function getSiloById(id: string): Promise<Silo | null> {
  const { tenantId } = await requirePermission('farm:read')

  return prisma.silo.findFirst({ where: { id, tenantId } })
}

export async function createSilo(data: SiloFormData) {
  const { tenantId } = await requirePermission('farm:write')

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
  const { tenantId } = await requirePermission('farm:write')

  const updateData: any = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.capacity !== undefined) updateData.capacity = new Decimal(data.capacity)
  if (data.unit !== undefined) updateData.unit = data.unit

  await prisma.silo.updateMany({ where: { id, tenantId }, data: updateData })

  revalidatePath(`/${tenantId}/silos`)
}

export async function deleteSilo(id: string) {
  const { tenantId } = await requirePermission('farm:delete')

  await prisma.silo.deleteMany({ where: { id, tenantId } })

  revalidatePath(`/${tenantId}/silos`)
}
