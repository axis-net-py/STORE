'use server'

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { createPurchaseInvoice, createSalesInvoice } from './invoice'

const OrderSchema = z.object({
  type: z.enum(['PURCHASE', 'SALES']),
  entityId: z.string().min(1, 'Cliente/Fornecedor é obrigatório'),
  expectedAt: z.date().optional(),
  currency: z.enum(['PYG', 'USD', 'BRL']).optional(),
  notes: z.string().max(2000).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().positive('Quantidade deve ser maior que zero').finite(),
        unitPrice: z.number().nonnegative().finite(),
      })
    )
    .min(1, 'O pedido precisa de ao menos um item'),
})

export type OrderFormData = z.infer<typeof OrderSchema>

export type OrderListItem = {
  id: string
  type: 'PURCHASE' | 'SALES'
  status: 'DRAFT' | 'CONFIRMED' | 'INVOICED' | 'CANCELLED'
  orderNumber: string
  entityName: string
  expectedAt: Date | null
  totalAmount: number
  itemCount: number
  invoiceId: string | null
  createdAt: Date
}

async function nextOrderNumber(tenantId: string, type: 'PURCHASE' | 'SALES', tx: any) {
  const prefix = type === 'SALES' ? 'PV' : 'PC'
  const last = await tx.order.findFirst({
    where: { tenantId, type },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  })
  const lastNum = last ? parseInt(last.orderNumber.replace(/\D/g, ''), 10) || 0 : 0
  return `${prefix}-${String(lastNum + 1).padStart(6, '0')}`
}

export async function getOrders(): Promise<OrderListItem[]> {
  const { tenantId } = await requirePermission('invoices:read')

  const orders = await prisma.order.findMany({
    where: { tenantId },
    include: {
      customer: { select: { name: true } },
      supplier: { select: { name: true } },
      items: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return orders.map((o) => ({
    id: o.id,
    type: o.type as 'PURCHASE' | 'SALES',
    status: o.status as OrderListItem['status'],
    orderNumber: o.orderNumber,
    entityName: o.customer?.name || o.supplier?.name || '—',
    expectedAt: o.expectedAt,
    totalAmount: Number(o.totalAmount),
    itemCount: o.items.length,
    invoiceId: o.invoiceId,
    createdAt: o.createdAt,
  }))
}

export async function createOrder(data: OrderFormData) {
  const { tenantId, userId } = await requirePermission('invoices:write')

  const parsed = OrderSchema.safeParse(data)
  if (!parsed.success) throw new Error(`Dados inválidos: ${parsed.error.issues[0].message}`)

  const isSales = data.type === 'SALES'

  const order = await prisma.$transaction(async (tx) => {
    // Valida que produtos e entidade pertencem ao tenant
    for (const item of data.items) {
      const product = await tx.product.findFirst({
        where: { id: item.productId, tenantId },
        select: { id: true },
      })
      if (!product) throw new Error(`Produto ${item.productId} não encontrado`)
    }

    const entity = isSales
      ? await tx.customer.findFirst({ where: { id: data.entityId, tenantId }, select: { id: true } })
      : await tx.supplier.findFirst({ where: { id: data.entityId, tenantId }, select: { id: true } })
    if (!entity) throw new Error(isSales ? 'Cliente não encontrado' : 'Fornecedor não encontrado')

    const totalAmount = data.items.reduce(
      (s, i) => s.add(new Prisma.Decimal(i.unitPrice).mul(i.quantity)),
      new Prisma.Decimal(0)
    )

    const created = await tx.order.create({
      data: {
        tenantId,
        type: data.type,
        status: 'CONFIRMED',
        orderNumber: await nextOrderNumber(tenantId, data.type, tx),
        customerId: isSales ? data.entityId : null,
        supplierId: !isSales ? data.entityId : null,
        expectedAt: data.expectedAt,
        currency: (data.currency as any) ?? 'PYG',
        totalAmount,
        notes: data.notes,
        createdBy: userId,
        items: {
          create: data.items.map((i) => ({
            productId: i.productId,
            quantity: new Prisma.Decimal(i.quantity),
            unitPrice: new Prisma.Decimal(i.unitPrice),
          })),
        },
      },
    })

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'CREATE_ORDER',
        entity: 'Order',
        entityId: created.id,
        details: { orderNumber: created.orderNumber, type: data.type, total: totalAmount.toString() },
      },
    })

    return created
  })

  revalidatePath(`/${tenantId}/orders`)
  return { success: true, orderId: order.id, orderNumber: order.orderNumber }
}

export async function cancelOrder(orderId: string) {
  const { tenantId, userId } = await requirePermission('invoices:write')

  const order = await prisma.order.findFirst({ where: { id: orderId, tenantId } })
  if (!order) throw new Error('Pedido não encontrado')
  if (order.status === 'INVOICED') throw new Error('Pedido já faturado não pode ser cancelado')
  if (order.status === 'CANCELLED') throw new Error('Pedido já cancelado')

  await prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } })
  await prisma.auditLog.create({
    data: { tenantId, userId, action: 'CANCEL_ORDER', entity: 'Order', entityId: orderId },
  })

  revalidatePath(`/${tenantId}/orders`)
  return { success: true }
}

// Converte o pedido em fatura (usa todo o fluxo já existente: estoque, impostos, razão)
export async function convertOrderToInvoice(orderId: string) {
  const { tenantId, userId } = await requirePermission('invoices:write')

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
    include: { items: { include: { product: { select: { taxType: true } } } } },
  })
  if (!order) throw new Error('Pedido não encontrado')
  if (order.status === 'INVOICED') throw new Error('Pedido já foi faturado')
  if (order.status === 'CANCELLED') throw new Error('Pedido cancelado não pode ser faturado')

  const entityId = order.customerId || order.supplierId
  if (!entityId) throw new Error('Pedido sem cliente/fornecedor')

  const payload = {
    type: order.type as 'PURCHASE' | 'SALES',
    customerId: entityId,
    currency: order.currency as string,
    notes: order.notes ? `${order.notes} (Pedido ${order.orderNumber})` : `Gerada do pedido ${order.orderNumber}`,
    items: order.items.map((i) => ({
      productId: i.productId,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      taxType: i.product.taxType as 'IVA_10' | 'IVA_5' | 'EXENTO',
    })),
  }

  const invoice =
    order.type === 'SALES'
      ? await createSalesInvoice(payload)
      : await createPurchaseInvoice(payload)

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'INVOICED', invoiceId: invoice.id },
  })

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'CONVERT_ORDER_TO_INVOICE',
      entity: 'Order',
      entityId: orderId,
      details: { invoiceId: invoice.id, orderNumber: order.orderNumber },
    },
  })

  revalidatePath(`/${tenantId}/orders`)
  revalidatePath(`/${tenantId}/invoices`)
  return { success: true, invoiceId: invoice.id }
}
