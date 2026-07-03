'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/authz'

export type PeriodInfo = {
  year: number
  month: number
  closed: boolean
  closedAt: Date | null
}

// Últimos 12 meses com status de fechamento
export async function getPeriods(): Promise<PeriodInfo[]> {
  const { tenantId } = await requirePermission('accounting:read')

  const closed = await prisma.accountingPeriod.findMany({
    where: { tenantId },
    select: { year: true, month: true, closedAt: true },
  })
  const closedMap = new Map(closed.map((c) => [`${c.year}-${c.month}`, c.closedAt]))

  const periods: PeriodInfo[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const closedAt = closedMap.get(`${year}-${month}`) ?? null
    periods.push({ year, month, closed: !!closedAt, closedAt })
  }
  return periods
}

export async function closePeriod(year: number, month: number) {
  const { tenantId, userId } = await requirePermission('accounting:write')

  if (month < 1 || month > 12 || year < 2000 || year > 2100) throw new Error('Período inválido')

  // Não fechar o mês corrente ou futuro — travaria a operação do dia a dia
  const now = new Date()
  if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) {
    throw new Error('Só é possível fechar meses já encerrados')
  }

  await prisma.accountingPeriod.upsert({
    where: { tenantId_year_month: { tenantId, year, month } },
    update: {},
    create: { tenantId, year, month, closedBy: userId },
  })

  await prisma.auditLog.create({
    data: { tenantId, userId, action: 'CLOSE_PERIOD', entity: 'AccountingPeriod', details: { year, month } },
  })

  revalidatePath(`/${tenantId}/accounting`)
  return { success: true }
}

export async function reopenPeriod(year: number, month: number) {
  const { tenantId, userId, role } = await requirePermission('accounting:write')

  // Reabertura é mais sensível: restrita a ADMIN/SOVEREIGN
  if (role !== 'SOVEREIGN' && role !== 'ADMIN') {
    throw new Error('Somente administradores podem reabrir períodos')
  }

  await prisma.accountingPeriod.deleteMany({ where: { tenantId, year, month } })

  await prisma.auditLog.create({
    data: { tenantId, userId, action: 'REOPEN_PERIOD', entity: 'AccountingPeriod', details: { year, month } },
  })

  revalidatePath(`/${tenantId}/accounting`)
  return { success: true }
}
