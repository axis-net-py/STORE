'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import type { Product } from '@prisma/client'
import { ProductSchema, type ProductFormData } from '@/lib/schemas'
import { AuthError, handleActionError } from '@/lib/errors'

function requireTenant(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user?.tenantId) throw new AuthError()
  return session.user.tenantId
}

function serializeProduct(p: Product & { movements?: any[] }) {
  return {
    ...p,
    price: Number(p.price),
    cost: Number(p.cost),
    currentStock: Number(p.currentStock),
    minStock: Number(p.minStock),
    movements: p.movements?.map(m => ({
      ...m,
      quantity: Number(m.quantity),
      unitCost: m.unitCost ? Number(m.unitCost) : null,
      totalCost: m.totalCost ? Number(m.totalCost) : null,
    })),
  }
}

export async function getProducts(): Promise<any[]> {
  const session = await auth()
  const tenantId = requireTenant(session)
  const products = await prisma.product.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  return products.map(p => serializeProduct(p))
}

export async function getProductById(id: string): Promise<any | null> {
  const session = await auth()
  const tenantId = requireTenant(session)
  const product = await prisma.product.findFirst({
    where: { id, tenantId },
    include: { movements: { orderBy: { createdAt: 'desc' }, take: 10 } },
  })
  if (!product) return null
  return serializeProduct(product)
}

export async function createProduct(data: ProductFormData) {
  try {
    const session = await auth()
    const tenantId = requireTenant(session)
    const parsed = ProductSchema.parse(data)

    await prisma.product.create({
      data: {
        tenantId,
        sku: parsed.sku,
        name: parsed.name,
        price: new Prisma.Decimal(parsed.price),
        cost: new Prisma.Decimal(parsed.cost ?? 0),
        currency: parsed.currency,
        unit: parsed.unit,
        currentStock: parsed.isService ? 0 : (parsed.currentStock ?? 0),
        minStock: parsed.isService ? 0 : (parsed.minStock ?? 0),
        isActive: parsed.isActive,
        tags: parsed.tags,
        isService: parsed.isService,
      },
    })

    revalidatePath(`/${tenantId}/products`)
  } catch (error) {
    handleActionError(error)
  }
}

export async function updateProduct(id: string, data: Partial<ProductFormData>) {
  try {
    const session = await auth()
    const tenantId = requireTenant(session)
    const parsed = ProductSchema.partial().parse(data)

    const updateData: Record<string, unknown> = {}
    if (parsed.sku !== undefined) updateData.sku = parsed.sku
    if (parsed.name !== undefined) updateData.name = parsed.name
    if (parsed.price !== undefined) updateData.price = new Prisma.Decimal(parsed.price)
    if (parsed.cost !== undefined) updateData.cost = new Prisma.Decimal(parsed.cost ?? 0)
    if (parsed.currency !== undefined) updateData.currency = parsed.currency
    if (parsed.unit !== undefined) updateData.unit = parsed.unit
    if (parsed.currentStock !== undefined) updateData.currentStock = parsed.isService ? 0 : parsed.currentStock
    if (parsed.minStock !== undefined) updateData.minStock = parsed.isService ? 0 : parsed.minStock
    if (parsed.isActive !== undefined) updateData.isActive = parsed.isActive
    if (parsed.tags !== undefined) updateData.tags = parsed.tags
    if (parsed.isService !== undefined) updateData.isService = parsed.isService

    await prisma.product.updateMany({ where: { id, tenantId }, data: updateData })
    revalidatePath(`/${tenantId}/products`)
  } catch (error) {
    handleActionError(error)
  }
}

export async function deleteProduct(id: string) {
  try {
    const session = await auth()
    const tenantId = requireTenant(session)
    await prisma.product.deleteMany({ where: { id, tenantId } })
    revalidatePath(`/${tenantId}/products`)
  } catch (error) {
    handleActionError(error)
  }
}

export async function getProductBySku(sku: string): Promise<Product | null> {
  const session = await auth()
  const tenantId = requireTenant(session)
  return prisma.product.findFirst({ where: { tenantId, sku } })
}
