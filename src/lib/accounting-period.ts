/**
 * Fechamento contábil por período (mês).
 *
 * Uma linha em AccountingPeriod significa que aquele mês está FECHADO:
 * nenhuma operação que altere o razão naquela data pode ser executada
 * (faturas, baixas, estornos, anulações).
 */

import { parteDataFiscal } from './fuso.ts'

export async function assertPeriodOpen(db: any, tenantId: string, date: Date | string) {
  // A que mês pertence a data — ver lib/fuso.ts. Usava getFullYear/getMonth,
  // que leem o fuso do servidor: na Vercel isso é UTC, e o dia 1 de cada mês
  // caía no mês anterior. Fechado julho, uma fatura de 1 de agosto era
  // recusada (auditoria de 2026-07-30).
  const { ano: year, mes: month } = parteDataFiscal(date)

  const closed = await db.accountingPeriod.findFirst({
    where: { tenantId, year, month },
    select: { id: true },
  })

  if (closed) {
    throw new Error(
      `Período contábil ${String(month).padStart(2, '0')}/${year} está fechado. ` +
        'Reabra o período em Contabilidade para lançar nesta data.'
    )
  }
}
