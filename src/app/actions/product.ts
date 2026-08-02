'use server'

import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import type { Product } from '@prisma/client'
import { z } from 'zod'
import { ProductSchema } from '@/lib/schemas'

/** Valida e normaliza. Não é exportada: este ficheiro é 'use server'. */
function validarProduto(data: unknown) {
  const r = ProductSchema.safeParse(data)
  if (!r.success) throw new Error(`Dados inválidos: ${r.error.issues[0].message}`)
  return r.data
}

/**
 * Um só ProductFormData, derivado do ProductSchema.
 *
 * Havia um segundo, escrito à mão aqui, com o aviso de que "podem divergir".
 * Divergiam: o daqui aceitava `price` negativo, e nada nesta ação chegava
 * sequer a olhar para o ProductSchema.
 *
 * E isso importa mais do que parece. Os parâmetros de uma server action chegam
 * por HTTP: o tipo do TypeScript desaparece na compilação e não protege nada
 * em tempo de execução. `createProduct({ price: -100 })` ia direto para o
 * banco, e um preço negativo distorce todas as faturas que usem o produto e o
 * razão que delas resulta. Auditoria de 2026-07-30.
 */
export type ProductFormData = z.input<typeof ProductSchema>

// Listar produtos do tenant
export async function getProducts(): Promise<any[]> {
  const { tenantId } = await requirePermission('products:read')

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
  const { tenantId } = await requirePermission('products:read')

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

  // O schema faz mais do que recusar: converte preço e custo de texto para
  // número e aplica os valores por omissão. É por isso que o resto da função
  // deixa de precisar de `?? 'un'` e afins.
  const d = validarProduto(data)

  const criado = await prisma.product.create({
    data: {
      tenantId,
      sku: d.sku,
      name: d.name,
      price: new Prisma.Decimal(d.price),
      cost: new Prisma.Decimal(d.cost),
      currency: d.currency,
      unit: d.unit,
      currentStock: d.isService ? 0 : d.currentStock,
      minStock: d.isService ? 0 : d.minStock,
      isActive: d.isActive,
      tags: d.tags,
      isService: d.isService,
      taxType: d.taxType,
    },
  })

  revalidatePath(`/${tenantId}/products`)
  return criado
}

// Atualizar produto
export async function updateProduct(id: string, data: Partial<ProductFormData>) {
  const { tenantId } = await requirePermission('products:write')

  // Edição parcial: só se valida o que veio. `.partial()` mantém as mesmas
  // regras — preço não negativo, SKU não vazio — sem exigir os campos ausentes.
  const parsed = ProductSchema.partial().safeParse(data)
  if (!parsed.success) {
    throw new Error(`Dados inválidos: ${parsed.error.issues[0].message}`)
  }
  const d = parsed.data

  const updateData: any = {}
  if (d.sku !== undefined) updateData.sku = d.sku
  if (d.name !== undefined) updateData.name = d.name
  if (d.price !== undefined) updateData.price = new Prisma.Decimal(d.price)
  if (d.cost !== undefined) updateData.cost = new Prisma.Decimal(d.cost)
  if (d.currency !== undefined) updateData.currency = d.currency
  if (d.unit !== undefined) updateData.unit = d.unit
  if (d.currentStock !== undefined) updateData.currentStock = d.isService ? 0 : d.currentStock
  if (d.minStock !== undefined) updateData.minStock = d.isService ? 0 : d.minStock
  if (d.isActive !== undefined) updateData.isActive = d.isActive
  if (d.tags !== undefined) updateData.tags = d.tags
  if (d.isService !== undefined) updateData.isService = d.isService

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
  const { tenantId } = await requirePermission('products:read')

  return prisma.product.findFirst({
    where: { tenantId, sku },
  })
}
