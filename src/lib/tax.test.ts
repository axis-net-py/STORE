// Rodar: npm test
//
// Testes de caracterização do cálculo de IVA paraguaio.
// Fixam o COMPORTAMENTO ATUAL para que a unificação (Projeto 1) não o altere
// em silêncio. Não afirmam que o comportamento está fiscalmente correto —
// ver a nota sobre `taxBase` no fim do ficheiro.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Prisma } from '@prisma/client'
import { calculateTax } from './tax.ts'

const d = (n: string | number) => new Prisma.Decimal(n)

test('IVA 10%: imposto é o total dividido por 11', () => {
  // 110.000 Gs com IVA incluído → base 100.000, imposto 10.000
  const { taxAmount } = calculateTax(d(110_000), 'IVA_10')
  assert.equal(taxAmount.toString(), '10000')
})

test('IVA 5%: imposto é o total dividido por 21', () => {
  // 105.000 Gs com IVA incluído → base 100.000, imposto 5.000
  const { taxAmount } = calculateTax(d(105_000), 'IVA_5')
  assert.equal(taxAmount.toString(), '5000')
})

test('EXENTO: imposto é zero', () => {
  const { taxAmount } = calculateTax(d(100_000), 'EXENTO')
  assert.equal(taxAmount.toString(), '0')
})

test('arredonda a zero casas decimais — o guarani não tem subdivisão', () => {
  // 100.000 / 11 = 9090,909... → 9091
  const { taxAmount } = calculateTax(d(100_000), 'IVA_10')
  assert.equal(taxAmount.toString(), '9091')
  assert.equal(taxAmount.decimalPlaces(), 0)
})

test('arredondamento é HALF_UP, não truncatura', () => {
  // 105 / 11 = 9,545... → 10 (truncar daria 9)
  assert.equal(calculateTax(d(105), 'IVA_10').taxAmount.toString(), '10')
  // 5 / 11 = 0,4545... → 0
  assert.equal(calculateTax(d(5), 'IVA_10').taxAmount.toString(), '0')
  // 6 / 11 = 0,5454... → 1
  assert.equal(calculateTax(d(6), 'IVA_10').taxAmount.toString(), '1')
})

test('total zero produz imposto zero em qualquer taxa', () => {
  for (const t of ['IVA_10', 'IVA_5', 'EXENTO'] as const) {
    assert.equal(calculateTax(d(0), t).taxAmount.toString(), '0', `taxa ${t}`)
  }
})

test('não perde precisão em valores grandes', () => {
  // 1.100.000.000 Gs → 100.000.000 de imposto, exato
  const { taxAmount } = calculateTax(d('1100000000'), 'IVA_10')
  assert.equal(taxAmount.toString(), '100000000')
})

// NOTA — comportamento atual documentado, não validado fiscalmente:
// `taxBase` é devolvido igual ao total, e não ao total menos o imposto.
// Se a SET esperar a base tributável líquida no XML da SIFEN, isto pode estar
// errado. Está fora do âmbito do Projeto 1 e precisa de confirmação com um
// contabilista antes de mudar. Estes testes fixam o comportamento atual.
test('taxBase é atualmente igual ao total (ver nota)', () => {
  const { taxBase } = calculateTax(d(110_000), 'IVA_10')
  assert.equal(taxBase.toString(), '110000')
})
