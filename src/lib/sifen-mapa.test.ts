import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapearParaSifen, DadosFiscaisIncompletos, type FaturaParaSifen } from './sifen-mapa.ts'
import { gerarCDC, TIPO_DE } from './cdc.ts'

// CDC válido para os testes: gerado por gerarCDC e conferido por cdcValido.
const CDC = gerarCDC({
  tipoDocumento: TIPO_DE.FACTURA,
  rucEmissor: '80012345',
  dvRucEmissor: 6,
  establecimiento: '001',
  puntoExpedicion: '001',
  numeroDocumento: '42',
  tipoContribuinte: '2',
  dataEmissao: new Date('2026-07-30'),
  tipoEmissao: '1',
  codigoSeguranca: '123456789',
})

function fatura(over: Partial<FaturaParaSifen> = {}): FaturaParaSifen {
  return {
    documentNumber: '001-001-0000042',
    timbrado: '12345678',
    sifenCdc: CDC,
    sifenSecurityCode: '123456789',
    issuedAt: new Date('2026-07-30T10:00:00Z'),
    totalAmount: '1100000',
    totalIva10: '90909',
    totalIva5: '0',
    totalExento: '0',
    currency: 'PYG',
    items: [
      {
        quantity: '2',
        unitPrice: '550000',
        totalPrice: '1100000',
        taxType: 'IVA_10',
        taxAmount: '90909',
        product: { name: 'Cimento 50kg', unit: 'sc' },
      },
    ],
    customer: { name: 'Smart Buy S.A.', document: '80012345-6', documentType: 'RUC' },
    ...over,
  }
}

test('o timbrado da fatura vai no documento, e não uma string vazia', () => {
  assert.equal(mapearParaSifen(fatura()).stamp, '12345678')
})

test('os totais de IVA vêm da fatura, e não fixos a zero', () => {
  const d = mapearParaSifen(
    fatura({ totalIva10: '90909', totalIva5: '4761', totalExento: '15000' })
  )
  assert.equal(d.totalIva10, 90909)
  assert.equal(d.totalIva5, 4761)
  assert.equal(d.totalExento, 15000)
})

test('cada item leva o seu próprio regime de imposto', () => {
  const d = mapearParaSifen(
    fatura({
      items: [
        { quantity: 1, unitPrice: 100, totalPrice: 100, taxType: 'IVA_5', taxAmount: 4.76, product: { name: 'Arroz', unit: 'kg' } },
        { quantity: 1, unitPrice: 200, totalPrice: 200, taxType: 'EXENTO', taxAmount: 0, product: { name: 'Livro', unit: 'un' } },
        { quantity: 1, unitPrice: 300, totalPrice: 300, taxType: 'IVA_10', taxAmount: 27.27, product: { name: 'Cadeira', unit: 'un' } },
      ],
    })
  )
  assert.deepEqual(d.items.map((i) => i.taxType), ['IVA_5', 'EXENTO', 'IVA_10'])
  assert.deepEqual(d.items.map((i) => i.taxAmount), [4.76, 0, 27.27])
})

test('um regime desconhecido cai em IVA_10 em vez de ir cru para a SET', () => {
  const d = mapearParaSifen(
    fatura({ items: [{ quantity: 1, unitPrice: 1, totalPrice: 1, taxType: 'IVA_99', taxAmount: 0, product: { name: 'X', unit: 'un' } }] })
  )
  assert.equal(d.items[0].taxType, 'IVA_10')
})

test('cliente com cédula é pessoa física, não jurídica', () => {
  const d = mapearParaSifen(
    fatura({ customer: { name: 'Ana', document: '1234567', documentType: 'CEDULA' } })
  )
  assert.equal(d.customerType, 'FISICA')
  assert.equal(d.customerDocType, 'CEDULA')
})

test('cliente com RUC é pessoa jurídica', () => {
  const d = mapearParaSifen(fatura())
  assert.equal(d.customerType, 'JURIDICA')
  assert.equal(d.customerDocType, 'RUC')
})

// ─── O que a transmissão tem de recusar ─────────────────────

test('recusa transmitir sem timbrado', () => {
  assert.throws(() => mapearParaSifen(fatura({ timbrado: null })), DadosFiscaisIncompletos)
  assert.throws(() => mapearParaSifen(fatura({ timbrado: '   ' })), DadosFiscaisIncompletos)
})

test('recusa inventar o documento do cliente', () => {
  // Antes, um cliente sem documento era declarado à SET como "00000000".
  assert.throws(
    () => mapearParaSifen(fatura({ customer: { name: 'Zé', document: null, documentType: 'RUC' } })),
    DadosFiscaisIncompletos
  )
})

test('recusa transmitir sem cliente, sem número e sem itens', () => {
  assert.throws(() => mapearParaSifen(fatura({ customer: null })), DadosFiscaisIncompletos)
  assert.throws(() => mapearParaSifen(fatura({ documentNumber: null })), DadosFiscaisIncompletos)
  assert.throws(() => mapearParaSifen(fatura({ items: [] })), DadosFiscaisIncompletos)
})

test('a mensagem enumera tudo o que falta, não só o primeiro', () => {
  try {
    mapearParaSifen(fatura({ timbrado: null, documentNumber: null, items: [] }))
    assert.fail('devia ter lançado')
  } catch (e) {
    assert.ok(e instanceof DadosFiscaisIncompletos)
    assert.equal(e.faltas.length, 3)
    assert.match(e.message, /timbrado/)
    assert.match(e.message, /número/)
  }
})

test('moeda desconhecida cai em PYG', () => {
  assert.equal(mapearParaSifen(fatura({ currency: 'EUR' })).currency, 'PYG')
})
