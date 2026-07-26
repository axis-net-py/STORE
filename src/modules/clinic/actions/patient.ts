'use server'

import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'

/**
 * Ficha do paciente com histórico de marcações.
 *
 * Extraída de actions/customer.ts do CLINIC: é uma consulta sobre models do
 * módulo clinic e por isso vive no módulo, não no núcleo (spec Projeto 1, §2.2).
 *
 * Devolve observações de saúde — dado sensível, sempre atrás de permissão.
 */
export async function getPatientWithHistory(id: string) {
  const { tenantId } = await requirePermission('clinic:read')

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
