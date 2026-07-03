'use server'

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { ensureDefaultWarehouse, bumpWarehouseStock } from '@/lib/warehouse'

export type WarehouseInfo = {
  id: string
  name: string
  code: string
  isDefault: boolean
}

export type WarehouseStockRow = {
  productId: string
  sku: string
  name: string
  unit: string
  quantity: number
  totalStock: number
}

export async function getWarehouses(): Promise<WarehouseInfo[]> {
  const { tenantId } = await requirePermission('inventory:read')

  // Garante que o depósito padrão exista mesmo em tenants antigos
  const warehouses = await prisma.$transaction(async (tx) => {
    await ensureDefaultWarehouse(tx, tenantId)
    return tx.warehouse.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    })
  })

  return warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code, isDefault: w.isDefault }))
}

const WarehouseSchema = z.object({
  name: z.string().min(2, 'Nome muito curto').max(60),
  code: z
    .string()
    .min(2)
    .max(12)
    .regex(/^[A-Z0-9-]+$/i, 'Código deve conter apenas letras, números e hífen'),
})

export async function createWarehouse(data: { name: string; code: string }) {
  const { tenantId, userId } = await requirePermission('inventory:write')

  const parsed = WarehouseSchema.safeParse(data)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  const code = data.code.toUpperCase()
  const existing = await prisma.warehouse.findFirst({ where: { tenantId, code } })
  if (existing) throw new Error(`Já existe um depósito com o código ${code}`)

  const warehouse = await prisma.warehouse.create({
    data: { tenantId, name: data.name, code },
  })

  await prisma.auditLog.create({
    data: { tenantId, userId, action: 'CREATE_WAREHOUSE', entity: 'Warehouse', entityId: warehouse.id, details: { name: data.name, code } },
  })

  revalidatePath(`/${tenantId}/inventory`)
  return { success: true, warehouseId: warehouse.id }
}

// Saldos de um depósito (produtos com estoque ou movimentados)
export async function getWarehouseStock(warehouseId: string): Promise<WarehouseStockRow[]> {
  const { tenantId } = await requirePermission('inventory:read')

  const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, tenantId } })
  if (!warehouse) throw new Error('Depósito não encontrado')

  const stocks = await prisma.warehouseStock.findMany({
    where: { warehouseId },
    include: { product: { select: { id: true, sku: true, name: true, unit: true, currentStock: true, isService: true } } },
  })

  return stocks
    .filter((s) => !s.product.isService)
    .map((s) => ({
      productId: s.product.id,
      sku: s.product.sku,
      name: s.product.name,
      unit: s.product.unit,
      quantity: Number(s.quantity),
      totalStock: Number(s.product.currentStock),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const TransferSchema = z.object({
  productId: z.string().min(1),
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  quantity: z.number().positive('Quantidade deve ser maior que zero').finite(),
})

// Transferência entre depósitos (não altera o estoque total do produto)
export async function transferStock(data: z.infer<typeof TransferSchema>) {
  const { tenantId, userId } = await requirePermission('inventory:write')

  const parsed = TransferSchema.safeParse(data)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)
  if (data.fromWarehouseId === data.toWarehouseId) {
    throw new Error('Depósito de origem e destino devem ser diferentes')
  }

  await prisma.$transaction(async (tx) => {
    const [from, to] = await Promise.all([
      tx.warehouse.findFirst({ where: { id: data.fromWarehouseId, tenantId } }),
      tx.warehouse.findFirst({ where: { id: data.toWarehouseId, tenantId } }),
    ])
    if (!from || !to) throw new Error('Depósito não encontrado')

    const product = await tx.product.findFirst({
      where: { id: data.productId, tenantId },
      select: { id: true, name: true, cost: true, isService: true },
    })
    if (!product) throw new Error('Produto não encontrado')
    if (product.isService) throw new Error('Serviços não possuem estoque')

    const qty = new Prisma.Decimal(data.quantity)

    // Decremento condicional na origem — impede transferir mais do que há no depósito
    const updated = await tx.warehouseStock.updateMany({
      where: { warehouseId: from.id, productId: product.id, quantity: { gte: qty } },
      data: { quantity: { decrement: qty } },
    })
    if (updated.count === 0) {
      throw new Error(`Saldo insuficiente de "${product.name}" no depósito ${from.name}`)
    }

    await bumpWarehouseStock(tx, to.id, product.id, qty)

    const reason = `Transferência ${from.code} → ${to.code}`
    await tx.inventoryMovement.createMany({
      data: [
        { tenantId, productId: product.id, type: 'SAIDA', quantity: qty, unitCost: product.cost, totalCost: product.cost.mul(qty), reason, warehouseId: from.id },
        { tenantId, productId: product.id, type: 'ENTRADA', quantity: qty, unitCost: product.cost, totalCost: product.cost.mul(qty), reason, warehouseId: to.id },
      ],
    })

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'TRANSFER_STOCK',
        entity: 'Product',
        entityId: product.id,
        details: { from: from.code, to: to.code, quantity: qty.toString() },
      },
    })
  })

  revalidatePath(`/${tenantId}/inventory`)
  return { success: true }
}
