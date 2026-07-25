'use server'

import prisma from "@/lib/prisma";
import { auth } from "@/auth";

/**
 * Consultas de dashboard específicas do agronegócio.
 *
 * Extraídas de lib/dashboard.ts do FARM: são queries sobre models do módulo
 * farm e por isso vivem no módulo, não no núcleo (spec Projeto 1, §2.2).
 */

export async function getPlotsBreakdown() {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("Tenant nao encontrado");
  const tenantId = session.user.tenantId;

  const plots = await prisma.plot.findMany({
    where: { tenantId },
    select: { area: true, unit: true, status: true, currentCrop: true }
  });

  // Calculate areas by status
  const byStatus: Record<string, number> = { PLANTED: 0, FALLOW: 0, PREPARING: 0 };
  const byCrop: Record<string, number> = {};

  for (const p of plots) {
    const areaVal = Number(p.area || 0);
    // Convert alqueires to hectares for standardized metrics breakdown
    const areaInHectares = p.unit === "ALQUEIRE" ? areaVal * 2.42 : areaVal;

    byStatus[p.status] = (byStatus[p.status] || 0) + areaInHectares;
    
    if (p.status === "PLANTED" && p.currentCrop) {
      const crop = p.currentCrop.toLowerCase();
      byCrop[crop] = (byCrop[crop] || 0) + areaInHectares;
    } else if (p.status === "FALLOW") {
      byCrop["pousio"] = (byCrop["pousio"] || 0) + areaInHectares;
    } else if (p.status === "PREPARING") {
      byCrop["preparação"] = (byCrop["preparação"] || 0) + areaInHectares;
    }
  }

  return {
    byStatus: Object.entries(byStatus).map(([status, area]) => ({ status, area })),
    byCrop: Object.entries(byCrop).map(([crop, area]) => ({ crop, area }))
  };
}

export async function getRecentContracts(limit = 5) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("Tenant nao encontrado");
  const tenantId = session.user.tenantId;

  const contracts = await prisma.contract.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { harvest: true }
  });

  return contracts.map(c => ({
    ...c,
    quantity: Number(c.quantity),
    pricePerUnit: Number(c.pricePerUnit),
  }));
}
