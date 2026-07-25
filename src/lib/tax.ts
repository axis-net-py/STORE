/**
 * Cálculo de IVA paraguaio.
 *
 * No Paraguai o IVA está INCLUÍDO no preço. Para extrair o imposto de um total:
 *   IVA 10% → total / 11   (total = base × 1,10 ⇒ imposto = total/11)
 *   IVA 5%  → total / 21   (total = base × 1,05 ⇒ imposto = total/21)
 *   EXENTO  → 0
 *
 * Arredondamento a zero casas decimais (ROUND_HALF_UP): o guarani não tem subdivisão.
 *
 * Extraído de `app/actions/invoice.ts` sem alteração de comportamento, para
 * permitir teste isolado sem base de dados. Ver `tax.test.ts`.
 */

import { Prisma } from '@prisma/client'

export type TaxType = 'IVA_10' | 'IVA_5' | 'EXENTO'

export function calculateTax(totalPrice: Prisma.Decimal, taxType: TaxType) {
  let taxAmount = new Prisma.Decimal(0)
  let taxBase = totalPrice

  if (taxType === 'IVA_10') {
    taxAmount = totalPrice.dividedBy(11).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
  } else if (taxType === 'IVA_5') {
    taxAmount = totalPrice.dividedBy(21).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
  } else {
    taxAmount = new Prisma.Decimal(0)
  }

  return { taxAmount, taxBase }
}
