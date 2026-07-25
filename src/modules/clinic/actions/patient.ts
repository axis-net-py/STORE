'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'

/**
 * Ficha do paciente com histórico de marcações.
 *
 * Extraída de actions/customer.ts do CLINIC: é uma consulta sobre models do
 * módulo clinic e por isso vive no módulo, não no núcleo (spec Projeto 1, §2.2).
 */
export async function getPatientWithHistory(id: string) {
  const session = await auth()
  const tenantId = session?.user?.tenantId
  if (!tenantId) throw new Error('Tenant não encontrado')

  return prisma.customer.findFirst({
    where: { id, tenantId },
    include: {
      appointments: {
        include: {
          professional: { select: { id: true, name: true, color: true } },
          service: { select: { id: true, name: true, durationMin: true } },
        },
        orderBy: { startsAt: 'desc' },
      },
    },
  })
}
