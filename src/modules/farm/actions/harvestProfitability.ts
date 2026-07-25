'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export type PlotCost = {
  plotId: string
  plotName: string
  area: number
  unit: string
  totalCost: number
}

export type RevenueByCurrency = {
  currency: string
  total: number
}

export type HarvestProfitability = {
  plotCosts: PlotCost[]
  costByCurrency: RevenueByCurrency[]
  revenueByCurrency: RevenueByCurrency[]
}

export async function getHarvestProfitability(harvestId: string): Promise<HarvestProfitability> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const [plots, applications, contracts] = await Promise.all([
    prisma.plot.findMany({
      where: { tenantId, harvestId },
      select: { id: true, name: true, area: true, unit: true },
    }),
    prisma.plotApplication.findMany({
      where: { tenantId, harvestId },
      select: { plotId: true, totalCost: true, product: { select: { currency: true } } },
    }),
    prisma.contract.findMany({
      where: { tenantId, harvestId, status: { not: 'CANCELLED' } },
      select: { quantity: true, pricePerUnit: true, currency: true },
    }),
  ])

  const costByPlot = new Map<string, number>()
  const costByCurrencyMap = new Map<string, number>()
  for (const app of applications) {
    if (!app.totalCost) continue
    const cost = Number(app.totalCost)
    costByPlot.set(app.plotId, (costByPlot.get(app.plotId) ?? 0) + cost)
    costByCurrencyMap.set(app.product.currency, (costByCurrencyMap.get(app.product.currency) ?? 0) + cost)
  }

  const plotCosts: PlotCost[] = plots.map((p) => ({
    plotId: p.id,
    plotName: p.name,
    area: Number(p.area),
    unit: p.unit,
    totalCost: costByPlot.get(p.id) ?? 0,
  }))

  const costByCurrency: RevenueByCurrency[] = Array.from(costByCurrencyMap.entries()).map(([currency, total]) => ({
    currency,
    total,
  }))

  const revenueByCurrencyMap = new Map<string, number>()
  for (const c of contracts) {
    const value = Number(c.quantity) * Number(c.pricePerUnit)
    revenueByCurrencyMap.set(c.currency, (revenueByCurrencyMap.get(c.currency) ?? 0) + value)
  }
  const revenueByCurrency: RevenueByCurrency[] = Array.from(revenueByCurrencyMap.entries()).map(([currency, total]) => ({
    currency,
    total,
  }))

  return { plotCosts, costByCurrency, revenueByCurrency }
}
