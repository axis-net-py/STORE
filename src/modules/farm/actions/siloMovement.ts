'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { Decimal } from 'decimal.js'
import type { SiloMovement, SiloMovementType } from '@prisma/client'

export type SiloMovementFormData = {
  siloId: string
  type: SiloMovementType
  quantity: number
  date: Date
  harvestId?: string
  contractId?: string
  moisture?: number
  qualityGrade?: string
  notes?: string
}

export async function getSiloMovements(siloId: string): Promise<
  (SiloMovement & {
    harvest: { id: string; name: string } | null
    contract: { id: string; contractNumber: string } | null
  })[]
> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.siloMovement.findMany({
    where: { tenantId, siloId },
    include: {
      harvest: { select: { id: true, name: true } },
      contract: { select: { id: true, contractNumber: true } },
    },
    orderBy: { date: 'desc' },
  })
}

export async function createSiloMovement(data: SiloMovementFormData) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const silo = await prisma.silo.findFirst({ where: { id: data.siloId, tenantId } })
  if (!silo) throw new Error('Silo não encontrado')

  const quantity = new Decimal(data.quantity)
  if (data.type === 'OUT' && quantity.greaterThan(silo.currentStock)) {
    throw new Error(`Estoque insuficiente no silo: disponível ${silo.currentStock} ${silo.unit}`)
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.siloMovement.create({
      data: {
        tenantId,
        siloId: data.siloId,
        type: data.type,
        quantity,
        date: new Date(data.date),
        harvestId: data.harvestId || null,
        contractId: data.contractId || null,
        moisture: data.moisture !== undefined ? new Decimal(data.moisture) : null,
        qualityGrade: data.qualityGrade || null,
        notes: data.notes || null,
      },
    })

    await tx.silo.update({
      where: { id: data.siloId },
      data: { currentStock: { [data.type === 'IN' ? 'increment' : 'decrement']: quantity } },
    })
  })

  revalidatePath(`/${tenantId}/silos/${data.siloId}`)
}

export async function deleteSiloMovement(id: string) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const movement = await prisma.siloMovement.findFirst({ where: { id, tenantId } })
  if (!movement) throw new Error('Registro não encontrado')

  await prisma.$transaction(async (tx: any) => {
    await tx.silo.update({
      where: { id: movement.siloId },
      data: { currentStock: { [movement.type === 'IN' ? 'decrement' : 'increment']: movement.quantity } },
    })

    await tx.siloMovement.delete({ where: { id } })
  })

  revalidatePath(`/${tenantId}/silos/${movement.siloId}`)
}
