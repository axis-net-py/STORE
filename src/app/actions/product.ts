'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import type { Product } from '@prisma/client'

export type ProductFormData = {
  sku: string
  name: string
  price: number | string
  cost: number | string
  unit?: string
  currentStock?: number
  minStock?: number
  isActive?: boolean
  tags?: string
  isService?: boolean
  currency?: 'PYG' | 'USD' | 'BRL'
}

// Listar produtos do tenant
export async function getProducts(): Promise<any[]> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const products = await prisma.product.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  })

  return products.map((p) => ({
    ...p,
    price: Number(p.price),
    cost: Number(p.cost),
    currentStock: Number(p.currentStock),
    minStock: Number(p.minStock),
  }))
}

// Buscar produto por ID
export async function getProductById(id: string): Promise<any | null> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const product = await prisma.product.findFirst({
    where: { id, tenantId },
    include: { movements: { orderBy: { createdAt: 'desc' }, take: 10 } },
  })

  if (!product) return null

  return {
    ...product,
    price: Number(product.price),
    cost: Number(product.cost),
    currentStock: Number(product.currentStock),
    minStock: Number(product.minStock),
    movements: product.movements.map((m) => ({
      ...m,
      quantity: Number(m.quantity),
      unitCost: m.unitCost ? Number(m.unitCost) : null,
      totalCost: m.totalCost ? Number(m.totalCost) : null,
    })),
  }
}

// Criar produto
export async function createProduct(data: ProductFormData) {
  const { tenantId } = await requirePermission('products:write')

  await prisma.product.create({
    data: {
      tenantId,
      sku: data.sku,
      name: data.name,
      price: new Prisma.Decimal(data.price),
      cost: new Prisma.Decimal(data.cost ?? 0),
      currency: data.currency ?? 'PYG',
      unit: data.unit ?? 'un',
      currentStock: data.isService ? 0 : (data.currentStock ?? 0),
      minStock: data.isService ? 0 : (data.minStock ?? 0),
      isActive: data.isActive ?? true,
      tags: data.tags,
      isService: data.isService ?? false,
    },
  })

  revalidatePath(`/${tenantId}/products`)
}

// Atualizar produto
export async function updateProduct(id: string, data: Partial<ProductFormData>) {
  const { tenantId } = await requirePermission('products:write')

  const updateData: any = {}
  if (data.sku !== undefined) updateData.sku = data.sku
  if (data.name !== undefined) updateData.name = data.name
  if (data.price !== undefined) updateData.price = new Prisma.Decimal(data.price)
  if (data.cost !== undefined) updateData.cost = new Prisma.Decimal(data.cost ?? 0)
  if (data.currency !== undefined) updateData.currency = data.currency
  if (data.unit !== undefined) updateData.unit = data.unit
  if (data.currentStock !== undefined) updateData.currentStock = data.isService ? 0 : data.currentStock
  if (data.minStock !== undefined) updateData.minStock = data.isService ? 0 : data.minStock
  if (data.isActive !== undefined) updateData.isActive = data.isActive
  if (data.tags !== undefined) updateData.tags = data.tags
  if (data.isService !== undefined) updateData.isService = data.isService

  await prisma.product.updateMany({
    where: { id, tenantId },
    data: updateData,
  })

  revalidatePath(`/${tenantId}/products`)
}

/**
 * Excluir produto.
 *
 * Produto com histórico (faturas, movimentações de estoque ou pedidos) NÃO pode
 * ser apagado — isso destruiria documentos fiscais já emitidos. Nesse caso ele é
 * arquivado (isActive = false) e some das listagens.
 * Sem histórico, é apagado de vez.
 */
export async function deleteProduct(id: string): Promise<{ archived: boolean }> {
  const { tenantId } = await requirePermission('products:delete')

  const product = await prisma.product.findFirst({
    where: { id, tenantId },
    select: { id: true },
  })
  if (!product) throw new Error('Produto não encontrado')

  const [invoiceItems, movements, orderItems] = await Promise.all([
    prisma.invoiceItem.count({ where: { productId: id } }),
    prisma.inventoryMovement.count({ where: { productId: id } }),
    prisma.orderItem.count({ where: { productId: id } }),
  ])

  if (invoiceItems > 0 || movements > 0 || orderItems > 0) {
    // Tem histórico fiscal — arquiva em vez de apagar
    await prisma.product.update({
      where: { id },
      data: { isActive: false, currentStock: 0 },
    })
    revalidatePath(`/${tenantId}/products`)
    revalidatePath(`/${tenantId}/inventory`)
    return { archived: true }
  }

  // Sem histórico — apaga de vez (limpa os saldos por depósito antes, FK RESTRICT)
  await prisma.$transaction(async (tx: any) => {
    await tx.warehouseStock.deleteMany({ where: { productId: id } })
    await tx.product.delete({ where: { id } })
  })

  revalidatePath(`/${tenantId}/products`)
  revalidatePath(`/${tenantId}/inventory`)
  return { archived: false }
}

// Buscar produto por SKU (para validação)
export async function getProductBySku(sku: string): Promise<Product | null> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.product.findFirst({
    where: { tenantId, sku },
  })
}
