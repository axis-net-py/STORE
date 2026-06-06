'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
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
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

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
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

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

// Excluir produto
export async function deleteProduct(id: string) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.product.deleteMany({
    where: { id, tenantId },
  })

  revalidatePath(`/${tenantId}/products`)
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
