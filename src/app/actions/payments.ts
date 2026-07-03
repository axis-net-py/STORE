'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'
import { assertPeriodOpen } from '@/lib/accounting-period'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'

export type PaymentMethodType = 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'CARD' | 'OTHER'

export type OpenInvoice = {
  id: string
  type: 'SALES' | 'PURCHASE'
  documentNumber: string | null
  entityName: string
  issuedAt: Date
  dueDate: Date | null
  totalAmount: number
  paidAmount: number
  balance: number
  isOverdue: boolean
  daysOverdue: number
}

export type FinanceSummary = {
  receivableOpen: number
  receivableOverdue: number
  payableOpen: number
  payableOverdue: number
  receivedThisMonth: number
  paidThisMonth: number
}

async function requireTenant() {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  return { tenantId: session.user.tenantId as string, userId: session.user.id as string }
}

async function getOrCreateAccount(
  tenantId: string,
  code: string,
  namePt: string,
  nameEs: string,
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE',
  db: any
) {
  let account = await db.account.findFirst({ where: { tenantId, code } })
  if (!account) {
    account = await db.account.create({ data: { tenantId, code, namePt, nameEs, type } })
  }
  return account
}

// Listar faturas em aberto (com saldo devedor) de um tipo
export async function getOpenInvoices(type: 'SALES' | 'PURCHASE'): Promise<OpenInvoice[]> {
  const { tenantId } = await requireTenant()

  const invoices = await prisma.commercialInvoice.findMany({
    where: { tenantId, type, status: 'APPROVED' },
    include: {
      customer: { select: { name: true } },
      supplier: { select: { name: true } },
      payments: { select: { amount: true } },
    },
    orderBy: [{ dueDate: 'asc' }, { issuedAt: 'asc' }],
  })

  const now = new Date()
  const result: OpenInvoice[] = []

  for (const inv of invoices) {
    const total = Number(inv.totalAmount)
    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0)
    const balance = total - paid
    if (balance <= 0.009) continue

    const due = inv.dueDate ? new Date(inv.dueDate) : null
    const isOverdue = !!due && due < now
    result.push({
      id: inv.id,
      type: inv.type as 'SALES' | 'PURCHASE',
      documentNumber: inv.documentNumber,
      entityName: inv.customer?.name || inv.supplier?.name || '—',
      issuedAt: inv.issuedAt,
      dueDate: inv.dueDate,
      totalAmount: total,
      paidAmount: paid,
      balance,
      isOverdue,
      daysOverdue: isOverdue && due ? Math.floor((now.getTime() - due.getTime()) / 86400000) : 0,
    })
  }

  return result
}

// Resumo financeiro (KPIs de AR/AP)
export async function getFinanceSummary(): Promise<FinanceSummary> {
  const { tenantId } = await requireTenant()

  const [receivables, payables] = await Promise.all([
    getOpenInvoicesInternal(tenantId, 'SALES'),
    getOpenInvoicesInternal(tenantId, 'PURCHASE'),
  ])

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const monthPayments = await prisma.payment.findMany({
    where: { tenantId, paidAt: { gte: startOfMonth } },
    include: { commercialInvoice: { select: { type: true } } },
  })

  let receivedThisMonth = 0
  let paidThisMonth = 0
  for (const p of monthPayments) {
    if (p.commercialInvoice.type === 'SALES') receivedThisMonth += Number(p.amount)
    else paidThisMonth += Number(p.amount)
  }

  return {
    receivableOpen: receivables.reduce((s, i) => s + i.balance, 0),
    receivableOverdue: receivables.filter((i) => i.isOverdue).reduce((s, i) => s + i.balance, 0),
    payableOpen: payables.reduce((s, i) => s + i.balance, 0),
    payableOverdue: payables.filter((i) => i.isOverdue).reduce((s, i) => s + i.balance, 0),
    receivedThisMonth,
    paidThisMonth,
  }
}

async function getOpenInvoicesInternal(tenantId: string, type: 'SALES' | 'PURCHASE') {
  const invoices = await prisma.commercialInvoice.findMany({
    where: { tenantId, type, status: 'APPROVED' },
    include: { payments: { select: { amount: true } } },
  })
  const now = new Date()
  return invoices
    .map((inv) => {
      const balance = Number(inv.totalAmount) - inv.payments.reduce((s, p) => s + Number(p.amount), 0)
      return { balance, isOverdue: !!inv.dueDate && new Date(inv.dueDate) < now }
    })
    .filter((i) => i.balance > 0.009)
}

// Histórico de pagamentos de uma fatura
export async function getInvoicePayments(invoiceId: string) {
  const { tenantId } = await requireTenant()
  return prisma.payment.findMany({
    where: { tenantId, commercialInvoiceId: invoiceId },
    orderBy: { paidAt: 'desc' },
  })
}

// Registrar baixa (recebimento ou pagamento) com lançamento contábil
export async function registerPayment(data: {
  invoiceId: string
  amount: number
  method?: PaymentMethodType
  paidAt?: Date
  notes?: string
}) {
  const { tenantId, userId } = await requirePermission('accounting:write')

  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new Error('Valor do pagamento deve ser maior que zero')
  }
  await assertPeriodOpen(prisma, tenantId, data.paidAt ?? new Date())

  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.commercialInvoice.findFirst({
      where: { id: data.invoiceId, tenantId },
      include: { payments: { select: { amount: true } } },
    })
    if (!invoice) throw new Error('Fatura não encontrada')
    if (invoice.status !== 'APPROVED') throw new Error('Somente faturas aprovadas podem receber baixa')

    const paid = invoice.payments.reduce((s, p) => s.add(p.amount), new Prisma.Decimal(0))
    const balance = new Prisma.Decimal(invoice.totalAmount).minus(paid)
    const amount = new Prisma.Decimal(data.amount)

    if (amount.gt(balance)) {
      throw new Error(`Valor excede o saldo em aberto (${balance.toFixed(0)} Gs.)`)
    }

    const isSales = invoice.type === 'SALES'

    // Lançamento contábil: recebimento debita Caixa e credita Contas a Receber;
    // pagamento debita Contas a Pagar e credita Caixa
    const cashAccount = await getOrCreateAccount(tenantId, '1.1.1.01', 'Caixa', 'Caja', 'ASSET', tx)
    const counterAccount = isSales
      ? await getOrCreateAccount(tenantId, '1.1.2.01', 'Contas a Receber', 'Cuentas a Cobrar', 'ASSET', tx)
      : await getOrCreateAccount(tenantId, '2.1.1.01', 'Contas a Pagar', 'Cuentas a Pagar', 'LIABILITY', tx)

    const lastEntry = await tx.journalEntry.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { number: true },
    })
    const nextNum = String((parseInt(lastEntry?.number?.match(/\d+$/)?.[0] || '0', 10) || 0) + 1).padStart(4, '0')

    const entry = await tx.journalEntry.create({
      data: {
        tenantId,
        number: nextNum,
        date: data.paidAt ?? new Date(),
        description: `${isSales ? 'Recebimento' : 'Pagamento'} - Fatura #${invoice.documentNumber || invoice.id.slice(-6)}`,
        status: 'POSTED',
        referenceType: 'payment',
        postedAt: new Date(),
        createdBy: userId,
      },
    })

    await tx.journalLine.createMany({
      data: [
        {
          journalEntryId: entry.id,
          accountId: isSales ? cashAccount.id : counterAccount.id,
          type: 'DEBIT',
          amount,
          currency: 'PYG',
        },
        {
          journalEntryId: entry.id,
          accountId: isSales ? counterAccount.id : cashAccount.id,
          type: 'CREDIT',
          amount,
          currency: 'PYG',
        },
      ],
    })

    const payment = await tx.payment.create({
      data: {
        tenantId,
        commercialInvoiceId: invoice.id,
        amount,
        currency: 'PYG',
        method: data.method ?? 'CASH',
        paidAt: data.paidAt ?? new Date(),
        notes: data.notes,
        journalEntryId: entry.id,
        createdBy: userId,
      },
    })

    // Amarrar o lançamento ao pagamento para permitir estorno
    await tx.journalEntry.update({ where: { id: entry.id }, data: { referenceId: payment.id } })

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: isSales ? 'REGISTER_RECEIPT' : 'REGISTER_PAYMENT',
        entity: 'Payment',
        entityId: payment.id,
        details: { invoiceId: invoice.id, amount: amount.toString(), method: data.method ?? 'CASH' },
      },
    })

    return payment
  })

  revalidatePath(`/${tenantId}/finance`)
  revalidatePath(`/${tenantId}/accounting`)
  return { success: true, paymentId: result.id }
}

// Estornar uma baixa (remove o pagamento e anula o lançamento)
export async function cancelPayment(paymentId: string) {
  const { tenantId, userId } = await requirePermission('accounting:write')

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id: paymentId, tenantId } })
    if (!payment) throw new Error('Pagamento não encontrado')
    await assertPeriodOpen(tx, tenantId, payment.paidAt)

    if (payment.journalEntryId) {
      await tx.journalEntry.updateMany({
        where: { id: payment.journalEntryId, tenantId },
        data: { status: 'VOIDED' },
      })
    }

    await tx.payment.delete({ where: { id: paymentId } })

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'CANCEL_PAYMENT',
        entity: 'Payment',
        entityId: paymentId,
        details: { amount: payment.amount.toString(), invoiceId: payment.commercialInvoiceId },
      },
    })
  })

  revalidatePath(`/${tenantId}/finance`)
  revalidatePath(`/${tenantId}/accounting`)
  return { success: true }
}
