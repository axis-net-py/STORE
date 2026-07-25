'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { Decimal } from 'decimal.js'
import type { VehicleLog, VehicleLogType } from '@prisma/client'

export type VehicleLogFormData = {
  vehicleId: string
  type: VehicleLogType
  date: Date
  odometerOrHours?: number
  employeeId?: string
  notes?: string
  liters?: number
  fuelCost?: number
  description?: string
  maintenanceCost?: number
}

export async function getVehicleLogs(vehicleId: string): Promise<(VehicleLog & { employee: { id: string; name: string } | null })[]> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.vehicleLog.findMany({
    where: { tenantId, vehicleId },
    include: { employee: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
  })
}

export async function createVehicleLog(data: VehicleLogFormData) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const reading = data.odometerOrHours !== undefined ? new Decimal(data.odometerOrHours) : null

  await prisma.vehicleLog.create({
    data: {
      tenantId,
      vehicleId: data.vehicleId,
      type: data.type,
      date: new Date(data.date),
      odometerOrHours: reading,
      employeeId: data.employeeId || null,
      notes: data.notes || null,
      liters: data.liters !== undefined ? new Decimal(data.liters) : null,
      fuelCost: data.fuelCost !== undefined ? new Decimal(data.fuelCost) : null,
      description: data.description || null,
      maintenanceCost: data.maintenanceCost !== undefined ? new Decimal(data.maintenanceCost) : null,
    },
  })

  if (reading) {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, tenantId } })
    if (vehicle && (!vehicle.currentReading || reading.greaterThan(vehicle.currentReading))) {
      await prisma.vehicle.update({ where: { id: data.vehicleId }, data: { currentReading: reading } })
    }
  }

  revalidatePath(`/${tenantId}/frota/${data.vehicleId}`)
}

export async function updateVehicleLog(id: string, data: Partial<VehicleLogFormData>) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const updateData: any = {}
  if (data.type !== undefined) updateData.type = data.type
  if (data.date !== undefined) updateData.date = new Date(data.date)
  if (data.odometerOrHours !== undefined) updateData.odometerOrHours = new Decimal(data.odometerOrHours)
  if (data.employeeId !== undefined) updateData.employeeId = data.employeeId || null
  if (data.notes !== undefined) updateData.notes = data.notes || null
  if (data.liters !== undefined) updateData.liters = new Decimal(data.liters)
  if (data.fuelCost !== undefined) updateData.fuelCost = new Decimal(data.fuelCost)
  if (data.description !== undefined) updateData.description = data.description || null
  if (data.maintenanceCost !== undefined) updateData.maintenanceCost = new Decimal(data.maintenanceCost)

  const log = await prisma.vehicleLog.findFirst({ where: { id, tenantId } })
  if (!log) throw new Error('Registro não encontrado')

  await prisma.vehicleLog.updateMany({ where: { id, tenantId }, data: updateData })

  revalidatePath(`/${tenantId}/frota/${log.vehicleId}`)
}

export async function deleteVehicleLog(id: string) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const log = await prisma.vehicleLog.findFirst({ where: { id, tenantId } })
  if (!log) throw new Error('Registro não encontrado')

  await prisma.vehicleLog.deleteMany({ where: { id, tenantId } })

  revalidatePath(`/${tenantId}/frota/${log.vehicleId}`)
}

export async function getFuelConsumption(vehicleId: string): Promise<{ average: number | null; unit: 'h' | 'km'; deltas: number[] }> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const fuelLogs = await prisma.vehicleLog.findMany({
    where: { tenantId, vehicleId, type: 'FUEL', odometerOrHours: { not: null }, liters: { not: null } },
    orderBy: { date: 'asc' },
  })

  const deltas: number[] = []
  for (let i = 1; i < fuelLogs.length; i++) {
    const prev = fuelLogs[i - 1]
    const curr = fuelLogs[i]
    const readingDelta = Number(curr.odometerOrHours) - Number(prev.odometerOrHours)
    if (readingDelta > 0) {
      deltas.push(Number(curr.liters) / readingDelta)
    }
  }

  const average = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null

  return { average, unit: 'h', deltas }
}
