'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { Decimal } from 'decimal.js'
import type { LivestockBatch } from '@prisma/client'

export type LivestockBatchFormData = {
  name: string
  category: string
  quantity: number
  averageWeight?: number
  location?: string
  status?: string // ACTIVE, SOLD
}

export async function getLivestockBatches(): Promise<LivestockBatch[]> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.livestockBatch.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  })
}

export async function getLivestockBatchById(id: string): Promise<LivestockBatch | null> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.livestockBatch.findFirst({ where: { id, tenantId } })
}

export async function createLivestockBatch(data: LivestockBatchFormData) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.livestockBatch.create({
    data: {
      tenantId,
      name: data.name,
      category: data.category,
      quantity: data.quantity,
      averageWeight: data.averageWeight !== undefined ? new Decimal(data.averageWeight) : null,
      location: data.location || null,
      status: data.status ?? 'ACTIVE',
    },
  })

  revalidatePath(`/${tenantId}/rebanho`)
}

export async function updateLivestockBatch(id: string, data: Partial<LivestockBatchFormData>) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const updateData: any = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.category !== undefined) updateData.category = data.category
  if (data.quantity !== undefined) updateData.quantity = data.quantity
  if (data.averageWeight !== undefined) updateData.averageWeight = new Decimal(data.averageWeight)
  if (data.location !== undefined) updateData.location = data.location || null
  if (data.status !== undefined) updateData.status = data.status

  await prisma.livestockBatch.updateMany({ where: { id, tenantId }, data: updateData })

  revalidatePath(`/${tenantId}/rebanho`)
}

export async function deleteLivestockBatch(id: string) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.livestockBatch.deleteMany({ where: { id, tenantId } })

  revalidatePath(`/${tenantId}/rebanho`)
}
