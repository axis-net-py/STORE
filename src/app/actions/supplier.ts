'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { Supplier } from '@prisma/client'

export type SupplierFormData = {
  name: string
  businessName?: string
  document?: string
  documentType?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  category?: string
  paymentTerms?: string
  isActive?: boolean
}

// Listar fornecedores do tenant
export async function getSuppliers(): Promise<Supplier[]> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.supplier.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  })
}

// Buscar fornecedor por ID
export async function getSupplierById(id: string): Promise<Supplier | null> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.supplier.findFirst({
    where: { id, tenantId },
  })
}

// Criar fornecedor
export async function createSupplier(data: SupplierFormData) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.supplier.create({
    data: {
      tenantId,
      name: data.name,
      businessName: data.businessName,
      document: data.document,
      documentType: data.documentType,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city,
      country: data.country ?? 'PY',
      category: data.category ?? 'fisica',
      paymentTerms: data.paymentTerms,
      isActive: true,
    },
  })

  revalidatePath(`/${tenantId}/suppliers`)
}

// Atualizar fornecedor
export async function updateSupplier(id: string, data: Partial<SupplierFormData>) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.supplier.updateMany({
    where: { id, tenantId },
    data: {
      name: data.name,
      businessName: data.businessName,
      document: data.document,
      documentType: data.documentType,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city,
      country: data.country,
      category: data.category,
      paymentTerms: data.paymentTerms,
      isActive: data.isActive,
    },
  })

  revalidatePath(`/${tenantId}/suppliers`)
}

// Excluir fornecedor
export async function deleteSupplier(id: string) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.supplier.deleteMany({
    where: { id, tenantId },
  })

  revalidatePath(`/${tenantId}/suppliers`)
}
