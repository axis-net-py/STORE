"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { CurrencyEngine } from "@axis/currency";
import { Prisma } from "@prisma/client";

export async function getJournalEntries(filters?: any) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("Tenant nao encontrado");
  const tenantId = session.user.tenantId;

  const where: any = { tenantId };
  if (filters?.status) where.status = filters.status;
  if (filters?.startDate && filters?.endDate) {
    where.date = {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate),
    };
  }

  return prisma.journalEntry.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      lines: {
        include: { account: true },
      },
    },
  });
}

export async function getLedgerEntries(filters?: any) {
  return getJournalEntries(filters);
}

export async function getLedgerEntriesWithShadow(filters?: any) {
  return getJournalEntries(filters);
}

export async function getTrialBalance(filters?: any) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("Tenant nao encontrado");
  const tenantId = session.user.tenantId;

  const entries = await prisma.journalEntry.findMany({
    where: { tenantId, status: "POSTED" },
    include: { lines: { include: { account: true } } },
  });

  const balances: Record<string, { debit: number; credit: number; account: any }> = {};

  for (const entry of entries) {
    for (const line of entry.lines) {
      if (!balances[line.accountId]) {
        balances[line.accountId] = { debit: 0, credit: 0, account: line.account };
      }
      if (line.type === "DEBIT") {
        balances[line.accountId].debit += Number(line.amount);
      } else {
        balances[line.accountId].credit += Number(line.amount);
      }
    }
  }

  return balances;
}

/**
 * Automates the creation of Journal Entries from Invoices.
 * Handles Sales and Purchases with appropriate tax (IVA) and entity accounts.
 */
export async function postInvoiceToLedger(invoiceId: string, tx?: any) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("Tenant nao encontrado");
  const tenantId = session.user.tenantId;

  const db = tx || prisma;

  const invoice = await db.commercialInvoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: { items: true, customer: true, supplier: true },
  });

  if (!invoice) throw new Error("Fatura nao encontrada");

  // Get exchange rates for currency conversion
  const rates = await db.exchangeRate.findFirst({
    where: { tenantId },
    orderBy: { date: "desc" },
  });

  const engine = rates ? CurrencyEngine.fromPrisma(rates as any) : null;
  const amountUSD = engine ? new Prisma.Decimal(engine.convert(invoice.totalAmount, "PYG", "USD").amount) : null;

  // 1. Check if a Journal Entry already exists for this invoice
  const existingEntry = await db.journalEntry.findFirst({
    where: { tenantId, referenceType: "invoice", referenceId: invoice.id },
  });

  if (existingEntry) {
    // Delete existing lines so they can be recreated
    await db.journalLine.deleteMany({
      where: { journalEntryId: existingEntry.id },
    });
  }

  const entryData = {
    tenantId,
    number: existingEntry?.number || await getNextJournalEntryNumber(tenantId, invoice.type, db),
    date: invoice.issuedAt,
    description: `${invoice.type === "SALES" ? "Venda" : "Compra"} - Fatura #${invoice.documentNumber || invoice.id.slice(-6)}`,
    status: "POSTED",
    referenceType: "invoice",
    referenceId: invoice.id,
    postedAt: new Date(),
    createdBy: session.user.id,
  };

  const entry = existingEntry
    ? await db.journalEntry.update({
        where: { id: existingEntry.id },
        data: entryData,
      })
    : await db.journalEntry.create({
        data: entryData,
      });

  // 2. Define Journal Lines (Simplified logic for common ERP flow)
  const lines: Prisma.JournalLineCreateManyInput[] = [];

  const isCredit = invoice.dueDate && new Date(invoice.dueDate).toDateString() !== new Date(invoice.issuedAt).toDateString();

  if (invoice.type === "SALES") {
    // SALES FLOW
    // DEBIT: Accounts Receivable (Customer) or Cash (Caixa)
    const debitAccountCode = isCredit ? "1.1.2.01" : "1.1.1.01";
    const debitAccountNamePt = isCredit ? "Contas a Receber" : "Caixa";
    const debitAccountNameEs = isCredit ? "Cuentas a Cobrar" : "Caja";

    lines.push({
      journalEntryId: entry.id,
      accountId: (await getOrCreateAccount(tenantId, debitAccountCode, debitAccountNamePt, debitAccountNameEs, "ASSET", db)).id,
      type: "DEBIT",
      amount: invoice.totalAmount,
      currency: "PYG",
      exchangeRate: invoice.exchangeRate,
      amountUSD,
    });

    // CREDIT: Sales Revenue
    const revenueAmount = invoice.totalAmount.minus(invoice.totalIva10).minus(invoice.totalIva5);
    lines.push({
      journalEntryId: entry.id,
      accountId: (await getOrCreateAccount(tenantId, "4.1.1.01", "Receita de Vendas", "Ventas de Mercaderias", "REVENUE", db)).id,
      type: "CREDIT",
      amount: revenueAmount,
      currency: "PYG",
      exchangeRate: invoice.exchangeRate,
      amountUSD: engine ? new Prisma.Decimal(engine.convert(revenueAmount, "PYG", "USD").amount) : null,
    });

    // CREDIT: IVA Payable (10% and 5%)
    if (invoice.totalIva10.gt(0) || invoice.totalIva5.gt(0)) {
      lines.push({
        journalEntryId: entry.id,
        accountId: (await getOrCreateAccount(tenantId, "2.1.3.01", "IVA a Pagar", "IVA por Pagar", "LIABILITY", db)).id,
        type: "CREDIT",
        amount: invoice.totalIva10.plus(invoice.totalIva5),
        currency: "PYG",
        exchangeRate: invoice.exchangeRate,
        amountUSD: engine ? new Prisma.Decimal(engine.convert(invoice.totalIva10.plus(invoice.totalIva5), "PYG", "USD").amount) : null,
      });
    }
  } else {
    // PURCHASE FLOW
    // DEBIT: Inventory or Expense
    const expenseAmount = invoice.totalAmount.minus(invoice.totalIva10).minus(invoice.totalIva5);
    lines.push({
      journalEntryId: entry.id,
      accountId: (await getOrCreateAccount(tenantId, "1.1.3.01", "Estoque de Mercadorias", "Mercaderias", "ASSET", db)).id,
      type: "DEBIT",
      amount: expenseAmount,
      currency: "PYG",
      exchangeRate: invoice.exchangeRate,
      amountUSD: engine ? new Prisma.Decimal(engine.convert(expenseAmount, "PYG", "USD").amount) : null,
    });

    // DEBIT: IVA Receivable (Recoverable)
    if (invoice.totalIva10.gt(0) || invoice.totalIva5.gt(0)) {
      lines.push({
        journalEntryId: entry.id,
        accountId: (await getOrCreateAccount(tenantId, "1.1.4.01", "IVA a Recuperar", "IVA Crédito Fiscal", "ASSET", db)).id,
        type: "DEBIT",
        amount: invoice.totalIva10.plus(invoice.totalIva5),
        currency: "PYG",
        exchangeRate: invoice.exchangeRate,
        amountUSD: engine ? new Prisma.Decimal(engine.convert(invoice.totalIva10.plus(invoice.totalIva5), "PYG", "USD").amount) : null,
      });
    }

    // CREDIT: Accounts Payable (Supplier) or Cash (Caixa)
    const creditAccountCode = isCredit ? "2.1.1.01" : "1.1.1.01";
    const creditAccountNamePt = isCredit ? "Contas a Pagar" : "Caixa";
    const creditAccountNameEs = isCredit ? "Cuentas a Pagar" : "Caja";

    lines.push({
      journalEntryId: entry.id,
      accountId: (await getOrCreateAccount(tenantId, creditAccountCode, creditAccountNamePt, creditAccountNameEs, "LIABILITY", db)).id,
      type: "CREDIT",
      amount: invoice.totalAmount,
      currency: "PYG",
      exchangeRate: invoice.exchangeRate,
      amountUSD,
    });
  }

  // Bulk create lines
  await db.journalLine.createMany({ data: lines });

  return { success: true, entry };
}

/**
 * Helper to ensure a specific account exists in the tenant's chart of accounts.
 */
async function getOrCreateAccount(
  tenantId: string,
  code: string,
  namePt: string,
  nameEs: string,
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE",
  db: any
) {
  let account = await db.account.findFirst({
    where: { tenantId, code },
  });

  if (!account) {
    account = await db.account.create({
      data: { tenantId, code, namePt, nameEs, type },
    });
  }

  return account;
}

async function getNextJournalEntryNumber(tenantId: string, type: "SALES" | "PURCHASE", db: any) {
  const lastEntry = await db.journalEntry.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });

  if (!lastEntry || !lastEntry.number) {
    return "0001";
  }

  const numericMatch = lastEntry.number.match(/\d+$/);
  if (!numericMatch) {
    return "0001";
  }

  const currentNum = parseInt(numericMatch[0], 10);
  const nextNum = currentNum + 1;
  return String(nextNum).padStart(4, "0");
}

export async function voidJournalEntry(entryId: string, reason: string) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("Tenant nao encontrado");
  const tenantId = session.user.tenantId;

  const entry = await prisma.journalEntry.update({
    where: { id: entryId, tenantId },
    data: { status: "VOIDED" },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user.id,
      action: "VOID_JOURNAL_ENTRY",
      entity: "JournalEntry",
      entityId: entryId,
      details: { reason },
    },
  });

  return { success: true, entry };
}

export async function getAccounts(tenantId?: string) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("Tenant nao encontrado");
  const tId = tenantId || session.user.tenantId;

  return prisma.account.findMany({
    where: { tenantId: tId, isActive: true },
    orderBy: { code: "asc" },
  });
}
