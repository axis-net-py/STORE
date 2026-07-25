'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { Harvest } from '@prisma/client'

export type HarvestFormData = {
  name: string
  cropType: string
  startDate: Date
  endDate: Date
  status?: string
}

export async function getHarvests(): Promise<Harvest[]> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.harvest.findMany({
    where: { tenantId },
    orderBy: { startDate: 'desc' },
  })
}

export async function getHarvestById(id: string): Promise<Harvest | null> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.harvest.findFirst({
    where: { id, tenantId },
  })
}

export async function createHarvest(data: HarvestFormData) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.harvest.create({
    data: {
      tenantId,
      name: data.name,
      cropType: data.cropType,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      status: data.status ?? 'ACTIVE',
    },
  })

  revalidatePath(`/${tenantId}/safra`)
}

export async function updateHarvest(id: string, data: Partial<HarvestFormData>) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const updateData: any = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.cropType !== undefined) updateData.cropType = data.cropType
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate)
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate)
  if (data.status !== undefined) updateData.status = data.status

  await prisma.harvest.updateMany({
    where: { id, tenantId },
    data: updateData,
  })

  revalidatePath(`/${tenantId}/safra`)
}

export async function deleteHarvest(id: string) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.harvest.deleteMany({
    where: { id, tenantId },
  })

  revalidatePath(`/${tenantId}/safra`)
}
