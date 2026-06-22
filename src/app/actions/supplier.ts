'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { Supplier } from '@prisma/client'
import { SupplierSchema, type SupplierFormData } from '@/lib/schemas'
import { AuthError, handleActionError } from '@/lib/errors'

function requireTenant(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user?.tenantId) throw new AuthError()
  return session.user.tenantId
}

export async function getSuppliers(): Promise<Supplier[]> {
  const session = await auth()
  const tenantId = requireTenant(session)
  return prisma.supplier.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const session = await auth()
  const tenantId = requireTenant(session)
  return prisma.supplier.findFirst({ where: { id, tenantId } })
}

export async function createSupplier(data: SupplierFormData) {
  try {
    const session = await auth()
    const tenantId = requireTenant(session)
    const parsed = SupplierSchema.parse(data)

    await prisma.supplier.create({
      data: { tenantId, ...parsed },
    })

    revalidatePath(`/${tenantId}/suppliers`)
  } catch (error) {
    handleActionError(error)
  }
}

export async function updateSupplier(id: string, data: Partial<SupplierFormData>) {
  try {
    const session = await auth()
    const tenantId = requireTenant(session)
    const parsed = SupplierSchema.partial().parse(data)

    await prisma.supplier.updateMany({
      where: { id, tenantId },
      data: parsed,
    })

    revalidatePath(`/${tenantId}/suppliers`)
  } catch (error) {
    handleActionError(error)
  }
}

export async function deleteSupplier(id: string) {
  try {
    const session = await auth()
    const tenantId = requireTenant(session)

    await prisma.supplier.deleteMany({ where: { id, tenantId } })
    revalidatePath(`/${tenantId}/suppliers`)
  } catch (error) {
    handleActionError(error)
  }
}
