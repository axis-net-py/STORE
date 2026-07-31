'use server'

import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'
import type { InventoryMovement, Product } from '@prisma/client'
import { ensureDefaultWarehouse, bumpWarehouseStock } from '@/lib/warehouse'

export type MovementWithDetails = InventoryMovement & {
  product: { id: string; sku: string; name: string }
}

export type ProductWithStock = Product & {
  movements: { id: string; type: string; quantity: number; createdAt: Date }[]
}

// Listar movimentações de estoque do tenant
export async function getInventoryMovements(productId?: string): Promise<MovementWithDetails[]> {
  const { tenantId } = await requirePermission('inventory:read')

  return prisma.inventoryMovement.findMany({
    where: {
      tenantId,
      ...(productId ? { productId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        select: { id: true, sku: true, name: true },
      },
    },
  }) as Promise<MovementWithDetails[]>
}

// Buscar extrato de um produto específico
export async function getProductStockHistory(productId: string): Promise<ProductWithStock | null> {
  const { tenantId } = await requirePermission('inventory:read')

  return prisma.product.findFirst({
    where: { id: productId, tenantId },
    include: {
      movements: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  }) as Promise<ProductWithStock | null>
}

// Ajuste manual de estoque (entrada ou saída)
export async function adjustStock(
  productId: string,
  type: 'ENTRADA' | 'SAIDA',
  quantity: number,
  reason?: string
) {
  // Ajustar estoque altera o inventário e alimenta a contabilidade: exige
  // permissão de escrita, não apenas uma sessão válida. Antes disto, um
  // AUDITOR — o papel de quem só confere — podia mexer no estoque.
  const { tenantId } = await requirePermission('inventory:write')

  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: { id: true, currentStock: true, cost: true, name: true },
  })
  if (!product) throw new Error('Produto não encontrado')

  if (type === 'SAIDA' && Number(product.currentStock) < quantity) {
    throw new Error(`Estoque insuficiente para o produto: ${product.name}. Disponível: ${product.currentStock}`)
  }

  await prisma.$transaction(async (tx: any) => {
    const warehouse = await ensureDefaultWarehouse(tx, tenantId)

    // Criar movimentação
    await tx.inventoryMovement.create({
      data: {
        tenantId,
        productId,
        type,
        quantity,
        unitCost: product.cost,
        totalCost: product.cost.mul(quantity),
        reason: reason ?? `Ajuste manual de estoque (${type})`,
        warehouseId: warehouse.id,
      },
    })

    // Atualizar estoque total + saldo do depósito
    await tx.product.updateMany({
      where: { id: productId, tenantId },
      data: {
        currentStock: {
          [type === 'ENTRADA' ? 'increment' : 'decrement']: quantity,
        },
      },
    })
    await bumpWarehouseStock(tx, warehouse.id, productId, type === 'ENTRADA' ? quantity : -quantity)
  })

  const path = `/dashboard/inventory`
  const { revalidatePath } = await import('next/cache')
  revalidatePath(path)
}
