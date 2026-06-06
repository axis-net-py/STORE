'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import type { CommercialInvoice, InvoiceItem } from '@prisma/client'
import { postInvoiceToLedger } from './accounting'
import { submitInvoiceToSifen } from './sifen'

export type InvoiceFormData = {
  type: 'PURCHASE' | 'SALES'
  customerId: string
  issuedAt?: Date
  dueDate?: Date
  currency?: string
  exchangeRate?: number
  notes?: string
  isSifen?: boolean
  documentNumber?: string
  timbrado?: string
  attachmentUrl?: string
  items: {
    productId: string
    quantity: number
    unitPrice: number
    taxType?: 'IVA_10' | 'IVA_5' | 'EXENTO'
    cost?: number
  }[]
}

export type InvoiceWithDetails = CommercialInvoice & {
  customer: { id: string; name: string; document?: string | null }
  items: (InvoiceItem & { product: { id: string; sku: string; name: string } })[]
  movements: { id: string; type: string; quantity: number; product: { name: string } }[]
}

// Helper para cálculo de impostos paraguaios
function calculateTax(totalPrice: Prisma.Decimal, taxType: 'IVA_10' | 'IVA_5' | 'EXENTO') {
  let taxAmount = new Prisma.Decimal(0)
  let taxBase = totalPrice

  if (taxType === 'IVA_10') {
    taxAmount = totalPrice.dividedBy(11).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
  } else if (taxType === 'IVA_5') {
    taxAmount = totalPrice.dividedBy(21).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
  } else {
    taxAmount = new Prisma.Decimal(0)
  }

  return { taxAmount, taxBase }
}

// Listar faturas do tenant
export async function getInvoices() {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.commercialInvoice.findMany({
    where: { tenantId },
    orderBy: { issuedAt: 'desc' },
    include: { 
      customer: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      items: true
    },
  })
}

// Buscar fatura por ID com detalhes
export async function getInvoiceById(id: string) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.commercialInvoice.findFirst({
    where: { id, tenantId },
    include: {
      customer: { select: { id: true, name: true, document: true } },
      supplier: { select: { id: true, name: true, document: true } },
      items: {
        include: { product: { select: { id: true, sku: true, name: true } } },
      },
      movements: {
        include: { product: { select: { name: true } } },
      },
    },
  })
}

// Criar Fatura de Compra (incrementa estoque) — transação atômica
export async function createPurchaseInvoice(data: InvoiceFormData) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const result = await prisma.$transaction(async (tx: any) => {
    // 1. Criar a fatura
    const invoice = await tx.commercialInvoice.create({
      data: {
        tenantId,
        type: 'PURCHASE',
        status: 'APPROVED',
        customerId: null,
        supplierId: data.customerId,
        documentNumber: data.documentNumber,
        timbrado: data.timbrado,
        issuedAt: data.issuedAt ?? new Date(),
        dueDate: data.dueDate,
        currency: data.currency as any ?? 'PYG',
        exchangeRate: new Prisma.Decimal(data.exchangeRate ?? 1),
        notes: data.notes,
        attachmentUrl: data.attachmentUrl,
        totalAmount: new Prisma.Decimal(0),
      },
    })

    let totalAmount = new Prisma.Decimal(0)
    let totalIva10 = new Prisma.Decimal(0)
    let totalIva5 = new Prisma.Decimal(0)
    let totalExento = new Prisma.Decimal(0)

    // 2. Criar itens e movimentações de estoque (ENTRADA)
    for (const item of data.items) {
      const product = await tx.product.findFirst({
        where: { id: item.productId, tenantId },
        select: { id: true, currentStock: true, name: true, taxType: true, isService: true },
      })
      if (!product) throw new Error(`Produto ${item.productId} não encontrado`)

      const quantity = item.quantity
      const unitPrice = new Prisma.Decimal(item.unitPrice)
      const totalPrice = unitPrice.mul(quantity)
      const cost = new Prisma.Decimal(item.cost ?? item.unitPrice)
      const taxType = item.taxType ?? product.taxType

      const { taxAmount, taxBase } = calculateTax(totalPrice, taxType)

      // Criar item da fatura
      await tx.invoiceItem.create({
        data: {
          commercialInvoiceId: invoice.id,
          productId: item.productId,
          quantity,
          unitPrice,
          totalPrice,
          taxType,
          taxBase,
          taxAmount,
          cost,
        },
      })

      if (!product.isService) {
        // Criar movimentação de estoque (ENTRADA)
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            type: 'ENTRADA',
            quantity,
            unitCost: cost,
            totalCost: cost.mul(quantity),
            reason: `Fatura de Compra #${invoice.id.slice(-6)}`,
            commercialInvoiceId: invoice.id,
          },
        })

        // Atualizar estoque do produto (incrementar)
        await tx.product.updateMany({
          where: { id: item.productId, tenantId },
          data: { currentStock: { increment: quantity } },
        })
      }

      totalAmount = totalAmount.add(totalPrice)
      if (taxType === 'IVA_10') totalIva10 = totalIva10.add(taxAmount)
      else if (taxType === 'IVA_5') totalIva5 = totalIva5.add(taxAmount)
      else totalExento = totalExento.add(totalPrice)
    }

    // 3. Atualizar total da fatura
    const latestRate = await getOrFetchExchangeRate(tenantId)
    const rateUSD = latestRate ? Number(latestRate.ratePYGtoUSD) : 7800
    const totalUSD = totalAmount.dividedBy(rateUSD)

    await tx.commercialInvoice.update({
      where: { id: invoice.id },
      data: { 
        totalAmount,
        totalUSD,
        totalIva10,
        totalIva5,
        totalExento
      },
    })

    // 4. Automatizar lançamento contábil
    await postInvoiceToLedger(invoice.id, tx)

    return invoice
  })

  revalidatePath(`/${tenantId}/invoices`)
  revalidatePath(`/${tenantId}/products`)
  return result
}

// Criar Fatura de Venda (valida estoque, decrementa) — transação atômica
export async function createSalesInvoice(data: InvoiceFormData) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const result = await prisma.$transaction(async (tx: any) => {
    // 1. Validar estoque para todos os itens antes de qualquer operação
    for (const item of data.items) {
      const product = await tx.product.findFirst({
        where: { id: item.productId, tenantId },
        select: { id: true, currentStock: true, name: true, isService: true },
      })
      if (!product) throw new Error(`Produto ${item.productId} não encontrado`)
      if (!product.isService && product.currentStock < item.quantity) {
        throw new Error(`Estoque insuficiente para o produto: ${product.name}. Disponível: ${product.currentStock}, Solicitado: ${item.quantity}`)
      }
    }

    // 2. Obter número sequencial se não fornecido
    const docNum = data.documentNumber || await getNextSalesInvoiceNumber(tenantId, tx);

    // 3. Criar a fatura
    const invoice = await tx.commercialInvoice.create({
      data: {
        tenantId,
        type: 'SALES',
        status: 'APPROVED',
        customerId: data.customerId,
        documentNumber: docNum,
        timbrado: data.timbrado,
        issuedAt: data.issuedAt ?? new Date(),
        dueDate: data.dueDate,
        currency: data.currency as any ?? 'PYG',
        exchangeRate: new Prisma.Decimal(data.exchangeRate ?? 1),
        notes: data.notes,
        sifenStatus: data.isSifen ? 'PENDING' : 'RECIBO_COMUN',
        attachmentUrl: data.attachmentUrl,
        totalAmount: new Prisma.Decimal(0),
      },
    })

    let totalAmount = new Prisma.Decimal(0)
    let totalIva10 = new Prisma.Decimal(0)
    let totalIva5 = new Prisma.Decimal(0)
    let totalExento = new Prisma.Decimal(0)

    // 3. Criar itens e movimentações de estoque (SAIDA)
    for (const item of data.items) {
      const product = await tx.product.findFirst({
        where: { id: item.productId, tenantId },
        select: { id: true, currentStock: true, name: true, cost: true, taxType: true, isService: true },
      })
      if (!product) throw new Error(`Produto ${item.productId} não encontrado`)

      const quantity = item.quantity
      const unitPrice = new Prisma.Decimal(item.unitPrice)
      const totalPrice = unitPrice.mul(quantity)
      const cost = product.cost ?? new Prisma.Decimal(item.cost ?? 0)
      const taxType = item.taxType ?? product.taxType

      const { taxAmount, taxBase } = calculateTax(totalPrice, taxType)

      // Criar item da fatura
      await tx.invoiceItem.create({
        data: {
          commercialInvoiceId: invoice.id,
          productId: item.productId,
          quantity,
          unitPrice,
          totalPrice,
          taxType,
          taxBase,
          taxAmount,
          cost,
        },
      })

      if (!product.isService) {
        // Criar movimentação de estoque (SAIDA)
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            type: 'SAIDA',
            quantity,
            unitCost: cost,
            totalCost: cost.mul(quantity),
            reason: `Fatura de Venda #${invoice.id.slice(-6)}`,
            commercialInvoiceId: invoice.id,
          },
        })

        // Atualizar estoque do produto (decrementar)
        await tx.product.updateMany({
          where: { id: item.productId, tenantId },
          data: { currentStock: { decrement: quantity } },
        })
      }

      totalAmount = totalAmount.add(totalPrice)
      if (taxType === 'IVA_10') totalIva10 = totalIva10.add(taxAmount)
      else if (taxType === 'IVA_5') totalIva5 = totalIva5.add(taxAmount)
      else totalExento = totalExento.add(totalPrice)
    }

    // 4. Atualizar total da fatura
    const latestRate = await getOrFetchExchangeRate(tenantId)
    const rateUSD = latestRate ? Number(latestRate.ratePYGtoUSD) : 7800
    const totalUSD = totalAmount.dividedBy(rateUSD)

    await tx.commercialInvoice.update({
      where: { id: invoice.id },
      data: { 
        totalAmount,
        totalUSD,
        totalIva10,
        totalIva5,
        totalExento
      },
    })

    // 5. Automatizar lançamento contábil
    await postInvoiceToLedger(invoice.id, tx)

    return invoice
  })

  // 6. Integração SIFEN (Real-time, non-blocking)
  // Executado fora da transação para não travar o banco em caso de timeout do Sifen
  if (data.isSifen) {
    try {
      submitInvoiceToSifen(tenantId, result.id)
    } catch (err) {
      console.error('[SIFEN] Background submission trigger failed:', err)
    }
  }

  revalidatePath(`/${tenantId}/invoices`)
  revalidatePath(`/${tenantId}/products`)
  return result
}

// Cancelar fatura (reverte estoque)
export async function cancelInvoice(id: string) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const invoice = await prisma.commercialInvoice.findFirst({
    where: { id, tenantId },
    include: { items: true, movements: true },
  })
  if (!invoice) throw new Error('Fatura não encontrada')
  if (invoice.status === 'CANCELLED') throw new Error('Fatura já cancelada')

  await prisma.$transaction(async (tx: any) => {
    // Reverter movimentações de estoque
    for (const movement of invoice.movements) {
      const reverseType = movement.type === 'ENTRADA' ? 'SAIDA' : 'ENTRADA'
      await tx.product.updateMany({
        where: { id: movement.productId, tenantId },
        data: {
          currentStock: {
            [reverseType === 'ENTRADA' ? 'increment' : 'decrement']: movement.quantity,
          },
        },
      })
    }

    // Marcar fatura como cancelada
    await tx.commercialInvoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })
  })

  revalidatePath(`/${tenantId}/invoices`)
  revalidatePath(`/${tenantId}/products`)
}

import { getOrFetchExchangeRate } from '@/lib/exchange'

// Obter última taxa de câmbio (com atualização automática)
export async function getLatestExchangeRate() {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return getOrFetchExchangeRate(tenantId)
}

// Forçar atualização manual das taxas de câmbio
export async function fetchExchangeRatesAction(tenantId: string) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  if (session.user.tenantId !== tenantId) throw new Error('Forbidden')

  await getOrFetchExchangeRate(tenantId, true)
  revalidatePath(`/${tenantId}/settings/exchange-rates`)
}

// Obter próximo número sequencial de fatura de venda (001-001-0000001)
export async function getNextSalesInvoiceNumber(tenantId: string, tx?: any) {
  const db = tx || prisma
  const lastInvoice = await db.commercialInvoice.findFirst({
    where: { 
      tenantId, 
      type: 'SALES',
      documentNumber: { startsWith: '001-001-' }
    },
    orderBy: { createdAt: 'desc' }
  })

  if (!lastInvoice || !lastInvoice.documentNumber) {
    return '001-001-0000001'
  }

  const parts = lastInvoice.documentNumber.split('-')
  if (parts.length === 3) {
    const nextNum = parseInt(parts[2], 10) + 1
    const paddedNum = String(nextNum).padStart(7, '0')
    return `${parts[0]}-${parts[1]}-${paddedNum}`
  }

  return '001-001-0000001'
}

// Atualizar Fatura (Compra/Venda) com recálculo de estoque e ledger
export async function updateInvoice(id: string, data: InvoiceFormData) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  // Obter fatura original com itens e movimentações para reverter
  const originalInvoice = await prisma.commercialInvoice.findFirst({
    where: { id, tenantId },
    include: { items: true, movements: true }
  })
  if (!originalInvoice) throw new Error('Fatura não encontrada')
  if (originalInvoice.status === 'CANCELLED') throw new Error('Fatura cancelada não pode ser editada')

  const result = await prisma.$transaction(async (tx: any) => {
    // 1. Reverter estoque antigo
    for (const movement of originalInvoice.movements) {
      const reverseType = movement.type === 'ENTRADA' ? 'SAIDA' : 'ENTRADA'
      await tx.product.updateMany({
        where: { id: movement.productId, tenantId },
        data: {
          currentStock: {
            [reverseType === 'ENTRADA' ? 'increment' : 'decrement']: movement.quantity,
          },
        },
      })
    }

    // 2. Deletar itens e movimentações anteriores
    await tx.inventoryMovement.deleteMany({ where: { commercialInvoiceId: id } })
    await tx.invoiceItem.deleteMany({ where: { commercialInvoiceId: id } })

    // 3. Validar estoque do novo lote se for venda
    if (data.type === 'SALES') {
      for (const item of data.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId },
          select: { id: true, currentStock: true, name: true, isService: true },
        })
        if (!product) throw new Error(`Produto ${item.productId} não encontrado`)
        if (!product.isService && product.currentStock < item.quantity) {
          throw new Error(`Estoque insuficiente para o produto: ${product.name}. Disponível: ${product.currentStock}, Solicitado: ${item.quantity}`)
        }
      }
    }

    // 4. Atualizar cabeçalho da fatura
    const isSales = data.type === 'SALES'
    const docNum = data.documentNumber || (isSales ? await getNextSalesInvoiceNumber(tenantId, tx) : undefined)

    await tx.commercialInvoice.update({
      where: { id },
      data: {
        type: data.type,
        customerId: isSales ? data.customerId : null,
        supplierId: !isSales ? data.customerId : null,
        documentNumber: docNum,
        timbrado: data.timbrado,
        issuedAt: data.issuedAt ?? originalInvoice.issuedAt,
        dueDate: data.dueDate,
        currency: data.currency as any ?? 'PYG',
        exchangeRate: new Prisma.Decimal(data.exchangeRate ?? 1),
        notes: data.notes,
        attachmentUrl: data.attachmentUrl,
        sifenStatus: isSales ? (data.isSifen ? 'PENDING' : 'RECIBO_COMUN') : null,
      }
    })

    let totalAmount = new Prisma.Decimal(0)
    let totalIva10 = new Prisma.Decimal(0)
    let totalIva5 = new Prisma.Decimal(0)
    let totalExento = new Prisma.Decimal(0)

    // 5. Inserir novos itens e registrar novos movimentos de estoque
    for (const item of data.items) {
      const product = await tx.product.findFirst({
        where: { id: item.productId, tenantId },
        select: { id: true, currentStock: true, cost: true, taxType: true, isService: true },
      })
      if (!product) throw new Error(`Produto ${item.productId} não encontrado`)

      const quantity = item.quantity
      const unitPrice = new Prisma.Decimal(item.unitPrice)
      const totalPrice = unitPrice.mul(quantity)
      const cost = data.type === 'PURCHASE' ? new Prisma.Decimal(item.cost ?? item.unitPrice) : (product.cost ?? new Prisma.Decimal(0))
      const taxType = item.taxType ?? product.taxType

      const { taxAmount, taxBase } = calculateTax(totalPrice, taxType)

      await tx.invoiceItem.create({
        data: {
          commercialInvoiceId: id,
          productId: item.productId,
          quantity,
          unitPrice,
          totalPrice,
          taxType,
          taxBase,
          taxAmount,
          cost,
        }
      })

      if (!product.isService) {
        const mvType = data.type === 'PURCHASE' ? 'ENTRADA' : 'SAIDA'
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            type: mvType,
            quantity,
            unitCost: cost,
            totalCost: cost.mul(quantity),
            reason: `Fatura de ${data.type === 'PURCHASE' ? 'Compra' : 'Venda'} (Editada) #${id.slice(-6)}`,
            commercialInvoiceId: id,
          }
        })

        await tx.product.updateMany({
          where: { id: item.productId, tenantId },
          data: {
            currentStock: {
              [mvType === 'ENTRADA' ? 'increment' : 'decrement']: quantity
            }
          }
        })
      }

      totalAmount = totalAmount.add(totalPrice)
      if (taxType === 'IVA_10') totalIva10 = totalIva10.add(taxAmount)
      else if (taxType === 'IVA_5') totalIva5 = totalIva5.add(taxAmount)
      else totalExento = totalExento.add(totalPrice)
    }

    // 6. Recalcular valores totais
    const latestRate = await getOrFetchExchangeRate(tenantId)
    const rateUSD = latestRate ? Number(latestRate.ratePYGtoUSD) : 7800
    const totalUSD = totalAmount.dividedBy(rateUSD)

    const updated = await tx.commercialInvoice.update({
      where: { id },
      data: {
        totalAmount,
        totalUSD,
        totalIva10,
        totalIva5,
        totalExento
      }
    })

    // 7. Atualizar lançamento contábil no ledger
    await postInvoiceToLedger(id, tx)

    return updated
  })

  if (data.type === 'SALES' && data.isSifen) {
    try {
      submitInvoiceToSifen(tenantId, id)
    } catch (err) {
      console.error('[SIFEN] Background submission trigger failed:', err)
    }
  }

  revalidatePath(`/${tenantId}/invoices`)
  revalidatePath(`/${tenantId}/products`)
  revalidatePath(`/${tenantId}/accounting`)
  return result
}


