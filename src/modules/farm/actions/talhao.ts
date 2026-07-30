'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'
import { assertRefDoTenant } from '@/lib/tenant-ref'
import { PlotPartialSchema, PlotSchema } from '@/modules/farm/schemas'
import { revalidatePath } from 'next/cache'
import type { Plot } from '@prisma/client'
import { Decimal } from 'decimal.js'

export type PlotFormData = {
  name: string
  area: number
  unit?: string // HECTARE, ALQUEIRE
  currentCrop?: string
  status?: string // FALLOW, PLANTED, PREPARING
  harvestId?: string
}

export async function getPlots(): Promise<(Plot & { harvest?: { name: string } | null })[]> {
  const { tenantId } = await requirePermission('farm:read')

  return prisma.plot.findMany({
    where: { tenantId },
    include: {
      harvest: {
        select: { name: true }
      }
    },
    orderBy: { name: 'asc' },
  }) as any
}

export async function getPlotById(id: string): Promise<(Plot & { harvest?: { name: string } | null }) | null> {
  const { tenantId } = await requirePermission('farm:read')

  return prisma.plot.findFirst({
    where: { id, tenantId },
    include: { harvest: { select: { name: true } } },
  }) as any
}

export async function createPlot(data: PlotFormData) {
  const { tenantId } = await requirePermission('farm:write')

  const parsed = PlotSchema.safeParse(data)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  await assertRefDoTenant(prisma, tenantId, 'harvest', data.harvestId)

  await prisma.plot.create({
    data: {
      tenantId,
      name: data.name,
      area: new Decimal(data.area),
      unit: data.unit ?? 'HECTARE',
      currentCrop: data.currentCrop || null,
      status: data.status ?? 'PLANTED',
      harvestId: data.harvestId || null,
    },
  })

  revalidatePath(`/${tenantId}/talhoes`)
}

export async function updatePlot(id: string, data: Partial<PlotFormData>) {
  const { tenantId } = await requirePermission('farm:write')

  const parsed = PlotPartialSchema.safeParse(data)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  await assertRefDoTenant(prisma, tenantId, 'harvest', data.harvestId)

  const updateData: any = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.area !== undefined) updateData.area = new Decimal(data.area)
  if (data.unit !== undefined) updateData.unit = data.unit
  if (data.currentCrop !== undefined) updateData.currentCrop = data.currentCrop || null
  if (data.status !== undefined) updateData.status = data.status
  if (data.harvestId !== undefined) updateData.harvestId = data.harvestId || null

  await prisma.plot.updateMany({
    where: { id, tenantId },
    data: updateData,
  })

  revalidatePath(`/${tenantId}/talhoes`)
}

export async function deletePlot(id: string) {
  const { tenantId } = await requirePermission('farm:delete')

  await prisma.plot.deleteMany({
    where: { id, tenantId },
  })

  revalidatePath(`/${tenantId}/talhoes`)
}
