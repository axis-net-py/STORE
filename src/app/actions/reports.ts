"use server";

import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";

export type ReportItem = {
  id: string;
  date: string;
  total: number;
  currency: string;
  details?: string;
};

export async function getReportData(
  type: "sales" | "purchases" | "inventory",
  startDateStr?: string,
  endDateStr?: string
): Promise<ReportItem[]> {
  const { tenantId } = await requirePermission("reports:read");

  const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 30 * 86400000);
  const endDate = endDateStr ? new Date(endDateStr) : new Date();

  // Set time bounds correctly
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  if (type === "sales") {
    const invoices = await prisma.commercialInvoice.findMany({
      where: {
        tenantId,
        type: "SALES",
        issuedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { issuedAt: "desc" },
      include: { customer: { select: { name: true } } },
    });

    return invoices.map((inv) => ({
      id: inv.id,
      date: inv.issuedAt.toISOString().split("T")[0],
      total: Number(inv.totalAmount),
      currency: inv.currency as string,
      details: inv.customer?.name || "Cliente Final",
    }));
  } else if (type === "purchases") {
    const invoices = await prisma.commercialInvoice.findMany({
      where: {
        tenantId,
        type: "PURCHASE",
        issuedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { issuedAt: "desc" },
      include: { supplier: { select: { name: true } } },
    });

    return invoices.map((inv) => ({
      id: inv.id,
      date: inv.issuedAt.toISOString().split("T")[0],
      total: Number(inv.totalAmount),
      currency: inv.currency as string,
      details: inv.supplier?.name || "Fornecedor",
    }));
  } else if (type === "inventory") {
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: "desc" },
      include: { product: { select: { name: true, sku: true } } },
    });

    return movements.map((mov) => ({
      id: mov.id,
      date: mov.createdAt.toISOString().split("T")[0],
      total: Number(mov.quantity),
      currency: mov.type === "ENTRADA" ? "ENTRADA" : "SAÍDA",
      details: `${mov.product?.sku} - ${mov.product?.name}`,
    }));
  } else {
    return [];
  }
}
