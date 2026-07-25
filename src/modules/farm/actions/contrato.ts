'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { Contract } from '@prisma/client'
import { Decimal } from 'decimal.js'

export type ContractFormData = {
  contractNumber: string
  siloName: string
  grainType: string
  quantity: number
  unit?: string // TON, BAG, KG
  pricePerUnit: number
  currency?: 'USD' | 'PYG' | 'BRL'
  status?: string // ACTIVE, COMPLETED, CANCELLED
  deliveryDate?: string | null
  notes?: string | null
  harvestId?: string | null
}

export async function getContracts(): Promise<(Contract & { harvest?: { name: string } | null })[]> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.contract.findMany({
    where: { tenantId },
    include: {
      harvest: {
        select: { name: true }
      }
    },
    orderBy: { createdAt: 'desc' },
  }) as any
}

export async function createContract(data: ContractFormData) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.contract.create({
    data: {
      tenantId,
      contractNumber: data.contractNumber,
      siloName: data.siloName,
      grainType: data.grainType,
      quantity: new Decimal(data.quantity),
      unit: data.unit ?? 'TON',
      pricePerUnit: new Decimal(data.pricePerUnit),
      currency: data.currency ?? 'USD',
      status: data.status ?? 'ACTIVE',
      deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
      notes: data.notes || null,
      harvestId: data.harvestId === "none" || !data.harvestId ? null : data.harvestId,
    },
  })

  revalidatePath(`/${tenantId}/contratos`)
}

export async function updateContract(id: string, data: Partial<ContractFormData>) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const updateData: any = {}
  if (data.contractNumber !== undefined) updateData.contractNumber = data.contractNumber
  if (data.siloName !== undefined) updateData.siloName = data.siloName
  if (data.grainType !== undefined) updateData.grainType = data.grainType
  if (data.quantity !== undefined) updateData.quantity = new Decimal(data.quantity)
  if (data.unit !== undefined) updateData.unit = data.unit
  if (data.pricePerUnit !== undefined) updateData.pricePerUnit = new Decimal(data.pricePerUnit)
  if (data.currency !== undefined) updateData.currency = data.currency
  if (data.status !== undefined) updateData.status = data.status
  if (data.deliveryDate !== undefined) updateData.deliveryDate = data.deliveryDate ? new Date(data.deliveryDate) : null
  if (data.notes !== undefined) updateData.notes = data.notes || null
  if (data.harvestId !== undefined) updateData.harvestId = data.harvestId === "none" || !data.harvestId ? null : data.harvestId

  await prisma.contract.updateMany({
    where: { id, tenantId },
    data: updateData,
  })

  revalidatePath(`/${tenantId}/contratos`)
}

export async function deleteContract(id: string) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.contract.deleteMany({
    where: { id, tenantId },
  })

  revalidatePath(`/${tenantId}/contratos`)
}
