'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { Decimal } from 'decimal.js'
import type { LivestockEvent, LivestockEventType } from '@prisma/client'

export type LivestockEventFormData = {
  batchId: string
  type: LivestockEventType
  date: Date
  weight?: number
  location?: string
  description?: string
  employeeId?: string
  notes?: string
}

export async function getLivestockEvents(
  batchId: string
): Promise<(LivestockEvent & { employee: { id: string; name: string } | null })[]> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.livestockEvent.findMany({
    where: { tenantId, batchId },
    include: { employee: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
  })
}

export async function createLivestockEvent(data: LivestockEventFormData) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const batch = await prisma.livestockBatch.findFirst({ where: { id: data.batchId, tenantId } })
  if (!batch) throw new Error('Lote não encontrado')

  await prisma.livestockEvent.create({
    data: {
      tenantId,
      batchId: data.batchId,
      type: data.type,
      date: new Date(data.date),
      weight: data.weight !== undefined ? new Decimal(data.weight) : null,
      location: data.location || null,
      description: data.description || null,
      employeeId: data.employeeId || null,
      notes: data.notes || null,
    },
  })

  const batchUpdate: any = {}
  if (data.type === 'WEIGHING' && data.weight !== undefined) {
    batchUpdate.averageWeight = new Decimal(data.weight)
  }
  if (data.type === 'MOVEMENT' && data.location) {
    batchUpdate.location = data.location
  }
  if (Object.keys(batchUpdate).length > 0) {
    await prisma.livestockBatch.update({ where: { id: data.batchId }, data: batchUpdate })
  }

  revalidatePath(`/${tenantId}/rebanho/${data.batchId}`)
}

export async function deleteLivestockEvent(id: string) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const event = await prisma.livestockEvent.findFirst({ where: { id, tenantId } })
  if (!event) throw new Error('Registro não encontrado')

  await prisma.livestockEvent.deleteMany({ where: { id, tenantId } })

  revalidatePath(`/${tenantId}/rebanho/${event.batchId}`)
}
