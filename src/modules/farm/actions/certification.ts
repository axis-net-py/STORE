'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { Certification } from '@prisma/client'

export type CertificationFormData = {
  name: string
  issuingBody?: string
  certificateNumber?: string
  issueDate?: Date
  expiryDate?: Date
  status?: string // ACTIVE, EXPIRED, PENDING
  scope?: string
  notes?: string
}

export async function getCertifications(): Promise<Certification[]> {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  return prisma.certification.findMany({
    where: { tenantId },
    orderBy: { expiryDate: 'asc' },
  })
}

export async function createCertification(data: CertificationFormData) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.certification.create({
    data: {
      tenantId,
      name: data.name,
      issuingBody: data.issuingBody || null,
      certificateNumber: data.certificateNumber || null,
      issueDate: data.issueDate ? new Date(data.issueDate) : null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      status: data.status ?? 'ACTIVE',
      scope: data.scope || null,
      notes: data.notes || null,
    },
  })

  revalidatePath(`/${tenantId}/certificacoes`)
}

export async function updateCertification(id: string, data: Partial<CertificationFormData>) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  const updateData: any = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.issuingBody !== undefined) updateData.issuingBody = data.issuingBody || null
  if (data.certificateNumber !== undefined) updateData.certificateNumber = data.certificateNumber || null
  if (data.issueDate !== undefined) updateData.issueDate = data.issueDate ? new Date(data.issueDate) : null
  if (data.expiryDate !== undefined) updateData.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null
  if (data.status !== undefined) updateData.status = data.status
  if (data.scope !== undefined) updateData.scope = data.scope || null
  if (data.notes !== undefined) updateData.notes = data.notes || null

  await prisma.certification.updateMany({ where: { id, tenantId }, data: updateData })

  revalidatePath(`/${tenantId}/certificacoes`)
}

export async function deleteCertification(id: string) {
  const session = await auth()
  if (!session?.user?.tenantId) throw new Error('Tenant não encontrado')
  const tenantId = session.user.tenantId

  await prisma.certification.deleteMany({ where: { id, tenantId } })

  revalidatePath(`/${tenantId}/certificacoes`)
}
