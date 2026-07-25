'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { Vehicle } from '@prisma/client'

export type VehicleFormData = {
  name: string
  type: string
  plate?: string
  status?: string // OPERATIONAL, MAINTENANCE, OUT_OF_SERVICE
}

export async function getVehicles(): Promise<Vehicle[]> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.vehicle.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  })
}

export async function getVehicleById(id: string): Promise<Vehicle | null> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.vehicle.findFirst({
    where: { id, tenantId },
  })
}

export async function createVehicle(data: VehicleFormData) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.vehicle.create({
    data: {
      tenantId,
      name: data.name,
      type: data.type,
      plate: data.plate || null,
      status: data.status ?? 'OPERATIONAL',
    },
  })

  revalidatePath(`/${tenantId}/frota`)
}

export async function updateVehicle(id: string, data: Partial<VehicleFormData>) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const updateData: any = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.type !== undefined) updateData.type = data.type
  if (data.plate !== undefined) updateData.plate = data.plate || null
  if (data.status !== undefined) updateData.status = data.status

  await prisma.vehicle.updateMany({
    where: { id, tenantId },
    data: updateData,
  })

  revalidatePath(`/${tenantId}/frota`)
}

export async function deleteVehicle(id: string) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.vehicle.deleteMany({
    where: { id, tenantId },
  })

  revalidatePath(`/${tenantId}/frota`)
}
