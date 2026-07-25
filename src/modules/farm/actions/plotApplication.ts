'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { Decimal } from 'decimal.js'
import type { PlotApplication } from '@prisma/client'

export type PlotApplicationFormData = {
  plotId: string
  productId: string
  quantity: number
  date: Date
  employeeId?: string
  notes?: string
}

export async function getPlotApplications(
  plotId: string
): Promise<(PlotApplication & { product: { id: string; name: string; unit: string }; employee: { id: string; name: string } | null })[]> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.plotApplication.findMany({
    where: { tenantId, plotId },
    include: {
      product: { select: { id: true, name: true, unit: true } },
      employee: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  })
}

export async function createPlotApplication(data: PlotApplicationFormData) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const product = await prisma.product.findFirst({
    where: { id: data.productId, tenantId },
    select: { id: true, name: true, unit: true, cost: true, currentStock: true },
  })
  if (!product) throw new Error('Produto não encontrado')

  const plot = await prisma.plot.findFirst({
    where: { id: data.plotId, tenantId },
    select: { id: true, name: true, harvestId: true },
  })
  if (!plot) throw new Error('Talhão não encontrado')

  const quantity = new Decimal(data.quantity)
  if (quantity.greaterThan(product.currentStock)) {
    throw new Error(`Estoque insuficiente para o produto: ${product.name}. Disponível: ${product.currentStock} ${product.unit}`)
  }
  const totalCost = product.cost.mul(quantity)

  await prisma.$transaction(async (tx: any) => {
    await tx.inventoryMovement.create({
      data: {
        tenantId,
        productId: data.productId,
        type: 'SAIDA',
        quantity,
        unitCost: product.cost,
        totalCost,
        reason: `Aplicação em talhão ${plot.name}`,
      },
    })

    await tx.product.update({
      where: { id: data.productId },
      data: { currentStock: { decrement: quantity } },
    })

    await tx.plotApplication.create({
      data: {
        tenantId,
        plotId: data.plotId,
        harvestId: plot.harvestId,
        productId: data.productId,
        quantity,
        totalCost,
        date: new Date(data.date),
        employeeId: data.employeeId || null,
        notes: data.notes || null,
      },
    })
  })

  revalidatePath(`/${tenantId}/talhoes/${data.plotId}`)
}

export async function deletePlotApplication(id: string) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const application = await prisma.plotApplication.findFirst({ where: { id, tenantId } })
  if (!application) throw new Error('Aplicação não encontrada')

  await prisma.$transaction(async (tx: any) => {
    // Reverte a baixa de estoque (mesmo padrão de cancelInvoice)
    await tx.product.update({
      where: { id: application.productId },
      data: { currentStock: { increment: application.quantity } },
    })

    await tx.inventoryMovement.create({
      data: {
        tenantId,
        productId: application.productId,
        type: 'ENTRADA',
        quantity: application.quantity,
        reason: `Estorno de aplicação em talhão (registro excluído)`,
      },
    })

    await tx.plotApplication.delete({ where: { id } })
  })

  revalidatePath(`/${tenantId}/talhoes/${application.plotId}`)
}
