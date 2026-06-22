'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { Customer } from '@prisma/client'
import { CustomerSchema, type CustomerFormData } from '@/lib/schemas'
import { AuthError, handleActionError } from '@/lib/errors'

function requireTenant(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user?.tenantId) throw new AuthError()
  return session.user.tenantId
}

export async function getCustomers(): Promise<Customer[]> {
  const session = await auth()
  const tenantId = requireTenant(session)
  return prisma.customer.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const session = await auth()
  const tenantId = requireTenant(session)
  return prisma.customer.findFirst({ where: { id, tenantId } })
}

export async function createCustomer(data: CustomerFormData) {
  try {
    const session = await auth()
    const tenantId = requireTenant(session)
    const parsed = CustomerSchema.parse(data)

    await prisma.customer.create({
      data: { tenantId, ...parsed },
    })

    revalidatePath(`/${tenantId}/customers`)
  } catch (error) {
    handleActionError(error)
  }
}

export async function updateCustomer(id: string, data: Partial<CustomerFormData>) {
  try {
    const session = await auth()
    const tenantId = requireTenant(session)
    const parsed = CustomerSchema.partial().parse(data)

    await prisma.customer.updateMany({
      where: { id, tenantId },
      data: parsed,
    })

    revalidatePath(`/${tenantId}/customers`)
  } catch (error) {
    handleActionError(error)
  }
}

export async function deleteCustomer(id: string) {
  try {
    const session = await auth()
    const tenantId = requireTenant(session)

    await prisma.customer.deleteMany({ where: { id, tenantId } })
    revalidatePath(`/${tenantId}/customers`)
  } catch (error) {
    handleActionError(error)
  }
}
