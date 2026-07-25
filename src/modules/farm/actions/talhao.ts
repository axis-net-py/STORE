'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
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
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

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
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.plot.findFirst({
    where: { id, tenantId },
    include: { harvest: { select: { name: true } } },
  }) as any
}

export async function createPlot(data: PlotFormData) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

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
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

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
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.plot.deleteMany({
    where: { id, tenantId },
  })

  revalidatePath(`/${tenantId}/talhoes`)
}
