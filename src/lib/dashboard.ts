'use server'

import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function getDashboardStats(dateRange?: { start?: Date; end?: Date }) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("Tenant nao encontrado");
  const tenantId = session.user.tenantId;

  const [
    salesAggregate,
    purchasesAggregate,
    productsCount,
    customersCount,
    receivableAggregate,
    payableAggregate,
    pendingSifenCount,
    pendingInvoicesCount,
    stockProducts,
  ] = await Promise.all([
    prisma.commercialInvoice.aggregate({
      where: { tenantId, type: "SALES", status: "APPROVED" },
      _sum: { totalAmount: true },
    }),
    prisma.commercialInvoice.aggregate({
      where: { tenantId, type: "PURCHASE", status: "APPROVED" },
      _sum: { totalAmount: true },
    }),
    prisma.product.count({
      where: { tenantId, isActive: true },
    }),
    prisma.customer.count({
      where: { tenantId, isActive: true },
    }),
    // Contas a receber (normalizadas em PYG via totalPyg)
    prisma.transaction.aggregate({
      where: { tenantId, type: "RECEIVABLE" },
      _sum: { totalPyg: true },
    }),
    prisma.transaction.aggregate({
      where: { tenantId, type: "PAYABLE" },
      _sum: { totalPyg: true },
    }),
    // Faturas de venda aguardando envio/aprovação no SIFEN
    prisma.commercialInvoice.count({
      where: { tenantId, type: "SALES", sifenStatus: "PENDING" },
    }),
    // Faturas com status pendente (não aprovadas)
    prisma.commercialInvoice.count({
      where: { tenantId, status: "PENDING" },
    }),
    // Produtos físicos ativos para calcular estoque baixo
    prisma.product.findMany({
      where: { tenantId, isActive: true, isService: false },
      select: { currentStock: true, minStock: true },
    }),
  ]);

  // Estoque baixo: tem mínimo definido (> 0) e está no limite ou abaixo
  const lowStockCount = stockProducts.filter(
    (p) => Number(p.minStock) > 0 && Number(p.currentStock) <= Number(p.minStock)
  ).length;

  return {
    totalSales: Number(salesAggregate._sum.totalAmount || 0),
    totalPurchases: Number(purchasesAggregate._sum.totalAmount || 0),
    totalProducts: productsCount,
    totalCustomers: customersCount,
    receivables: Number(receivableAggregate._sum.totalPyg || 0),
    payables: Number(payableAggregate._sum.totalPyg || 0),
    lowStockCount,
    pendingSifenCount,
    pendingInvoicesCount,
  };
}

export async function getTrendData(dateRange?: { start?: Date; end?: Date }) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("Tenant nao encontrado");
  const tenantId = session.user.tenantId;

  const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = dateRange?.end || new Date();

  const invoices = await prisma.commercialInvoice.findMany({
    where: { tenantId, status: "APPROVED", issuedAt: { gte: startDate, lte: endDate } },
    orderBy: { issuedAt: "asc" },
    select: { issuedAt: true, totalAmount: true },
  });

  const grouped: Record<string, number> = {};
  for (const inv of invoices) {
    const date = inv.issuedAt.toISOString().split("T")[0];
    grouped[date] = (grouped[date] || 0) + Number(inv.totalAmount);
  }

  return Object.entries(grouped).map(([date, total]) => ({ date, total }));
}

export async function getTopProducts(dateRange?: { start?: Date; end?: Date }, limit = 5) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("Tenant nao encontrado");
  const tenantId = session.user.tenantId;

  const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = dateRange?.end || new Date();

  const items = await prisma.invoiceItem.findMany({
    where: {
      commercialInvoice: { tenantId, status: "APPROVED", issuedAt: { gte: startDate, lte: endDate } },
    },
    include: { product: true },
  });

  const grouped: Record<string, { name: string; quantity: number; revenue: number }> = {};
  for (const item of items) {
    if (!item.product) continue;
    const existing = grouped[item.product.id] || { name: item.product.name, quantity: 0, revenue: 0 };
    existing.quantity += Number(item.quantity);
    existing.revenue += Number(item.totalPrice);
    grouped[item.product.id] = existing;
  }

  return Object.values(grouped)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}



