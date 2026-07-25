'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { Employee } from '@prisma/client'

export type EmployeeFormData = {
  name: string
  role: string
  phone?: string
  status?: string // ACTIVE, INACTIVE, LEAVE
}

export async function getEmployees(): Promise<Employee[]> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.employee.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  })
}

export async function createEmployee(data: EmployeeFormData) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.employee.create({
    data: {
      tenantId,
      name: data.name,
      role: data.role,
      phone: data.phone || null,
      status: data.status ?? 'ACTIVE',
    },
  })

  revalidatePath(`/${tenantId}/funcionarios`)
}

export async function updateEmployee(id: string, data: Partial<EmployeeFormData>) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const updateData: any = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.role !== undefined) updateData.role = data.role
  if (data.phone !== undefined) updateData.phone = data.phone || null
  if (data.status !== undefined) updateData.status = data.status

  await prisma.employee.updateMany({
    where: { id, tenantId },
    data: updateData,
  })

  revalidatePath(`/${tenantId}/funcionarios`)
}

export async function deleteEmployee(id: string) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.employee.deleteMany({
    where: { id, tenantId },
  })

  revalidatePath(`/${tenantId}/funcionarios`)
}
