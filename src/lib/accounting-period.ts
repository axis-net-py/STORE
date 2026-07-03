/**
 * Fechamento contábil por período (mês).
 *
 * Uma linha em AccountingPeriod significa que aquele mês está FECHADO:
 * nenhuma operação que altere o razão naquela data pode ser executada
 * (faturas, baixas, estornos, anulações).
 */

export async function assertPeriodOpen(db: any, tenantId: string, date: Date | string) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1

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
