'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'
import { revalidatePath } from 'next/cache'
import { Decimal } from 'decimal.js'
import type { SoilAnalysis } from '@prisma/client'

export type SoilAnalysisFormData = {
  plotId: string
  date: Date
  ph?: number
  phosphorus?: number
  potassium?: number
  organicMatter?: number
  recommendation?: string
  notes?: string
}

export async function getSoilAnalyses(plotId: string): Promise<SoilAnalysis[]> {
  const { tenantId } = await requirePermission('farm:read')

  return prisma.soilAnalysis.findMany({
    where: { tenantId, plotId },
    orderBy: { date: 'desc' },
  })
}

export async function createSoilAnalysis(data: SoilAnalysisFormData) {
  const { tenantId } = await requirePermission('farm:write')

  const plot = await prisma.plot.findFirst({ where: { id: data.plotId, tenantId } })
  if (!plot) throw new Error('Talhão não encontrado')

  await prisma.soilAnalysis.create({
    data: {
      tenantId,
      plotId: data.plotId,
      date: new Date(data.date),
      ph: data.ph !== undefined ? new Decimal(data.ph) : null,
      phosphorus: data.phosphorus !== undefined ? new Decimal(data.phosphorus) : null,
      potassium: data.potassium !== undefined ? new Decimal(data.potassium) : null,
      organicMatter: data.organicMatter !== undefined ? new Decimal(data.organicMatter) : null,
      recommendation: data.recommendation || null,
      notes: data.notes || null,
    },
  })

  revalidatePath(`/${tenantId}/talhoes/${data.plotId}`)
}

export async function deleteSoilAnalysis(id: string) {
  const { tenantId } = await requirePermission('farm:delete')

  const analysis = await prisma.soilAnalysis.findFirst({ where: { id, tenantId } })
  if (!analysis) throw new Error('Análise não encontrada')

  await prisma.soilAnalysis.deleteMany({ where: { id, tenantId } })

  revalidatePath(`/${tenantId}/talhoes/${analysis.plotId}`)
}
