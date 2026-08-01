import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  gerarCDC,
  cdcValido,
  lerCDC,
  gerarCodigoSeguranca,
  digitoVerificadorCDC,
  CDCInvalido,
  TIPO_DE,
  type DadosCDC,
} from './cdc.ts'

function dados(over: Partial<DadosCDC> = {}): DadosCDC {
  return {
    tipoDocumento: TIPO_DE.FACTURA,
    rucEmissor: '80012345',
    dvRucEmissor: 6,
    establecimiento: '001',
    puntoExpedicion: '001',
    numeroDocumento: '0000042',
    tipoContribuinte: '2',
    dataEmissao: new Date('2026-07-30T14:00:00Z'),
    tipoEmissao: '1',
    codigoSeguranca: '123456789',
    ...over,
  }
}

test('o CDC tem 44 algarismos', () => {
  const cdc = gerarCDC(dados())
  assert.equal(cdc.length, 44)
  assert.match(cdc, /^\d{44}$/)
})

test('o CDC gerado passa na própria verificação', () => {
  assert.ok(cdcValido(gerarCDC(dados())))
})

test('cada campo fica na posição certa', () => {
  const p = lerCDC(gerarCDC(dados()))
  assert.equal(p.tipoDocumento, '01')
  assert.equal(p.rucEmissor, '80012345')
  assert.equal(p.dvRucEmissor, '6')
  assert.equal(p.establecimiento, '001')
  assert.equal(p.puntoExpedicion, '001')
  assert.equal(p.numeroDocumento, '0000042')
  assert.equal(p.tipoContribuinte, '2')
  assert.equal(p.dataEmissao, '20260730')
  assert.equal(p.tipoEmissao, '1')
  assert.equal(p.codigoSeguranca, '123456789')
})

test('a data vai no fuso do Paraguai, não em UTC', () => {
  // 2026-07-31T02:00Z é ainda dia 30 em Assunção (UTC-4). Em UTC seria 31, e o
  // CDC ficaria com a data de emissão de outro dia.
  const p = lerCDC(gerarCDC(dados({ dataEmissao: new Date('2026-07-31T02:00:00Z') })))
  assert.equal(p.dataEmissao, '20260730')
})

test('campos curtos são preenchidos com zeros à esquerda', () => {
  const p = lerCDC(gerarCDC(dados({ numeroDocumento: '42', establecimiento: '1' })))
  assert.equal(p.numeroDocumento, '0000042')
  assert.equal(p.establecimiento, '001')
})

test('o número do documento aceita o formato EEE-PPP-NNNNNNN por partes', () => {
  const cdc = gerarCDC(dados({ establecimiento: '002', puntoExpedicion: '003', numeroDocumento: '0001234' }))
  const p = lerCDC(cdc)
  assert.equal(p.establecimiento, '002')
  assert.equal(p.puntoExpedicion, '003')
  assert.equal(p.numeroDocumento, '0001234')
})

// ─── Dígito verificador ─────────────────────────────────────

test('o dígito verificador muda quando um algarismo muda', () => {
  const cdc = gerarCDC(dados())
  const adulterado = cdc.slice(0, 20) + (cdc[20] === '9' ? '0' : '9') + cdc.slice(21)
  assert.ok(!cdcValido(adulterado), 'um CDC adulterado tinha de falhar a verificação')
})

test('o DV do CDC usa multiplicadores 2..9, não 2..7 como o RUC', () => {
  // 43 uns. Com o ciclo 2..9: 5 voltas completas (2+…+9 = 44) mais 2+3+4,
  // soma 229; 229 mod 11 = 9, logo 11−9 = 2.
  // Com o ciclo do RUC (2..7) daria 7. O teste distingue os dois algoritmos:
  // usar um no lugar do outro produz um CDC que a SET rejeita.
  const base = '1'.repeat(43)
  assert.equal(digitoVerificadorCDC(base), 2)
})

test('resto 0 ou 1 dá dígito 0', () => {
  assert.equal(digitoVerificadorCDC('0'.repeat(43)), 0)
})

test('cdcValido recusa comprimentos errados e lixo', () => {
  assert.ok(!cdcValido(''))
  assert.ok(!cdcValido(null))
  assert.ok(!cdcValido('123'))
  assert.ok(!cdcValido('1'.repeat(44)))
})

// ─── Código de segurança ────────────────────────────────────

test('o código de segurança tem 9 algarismos', () => {
  for (let i = 0; i < 50; i++) {
    assert.match(gerarCodigoSeguranca(), /^\d{9}$/)
  }
})

test('o código de segurança não se repete', () => {
  const vistos = new Set<string>()
  for (let i = 0; i < 200; i++) vistos.add(gerarCodigoSeguranca())
  // Com 10^9 possibilidades, 200 sorteios repetidos seriam um gerador partido.
  assert.ok(vistos.size > 195, `demasiadas repetições: ${200 - vistos.size}`)
})

// ─── O que tem de recusar ───────────────────────────────────

test('recusa sem RUC da empresa', () => {
  assert.throws(() => gerarCDC(dados({ rucEmissor: '' })), CDCInvalido)
})

test('recusa RUC com mais de 8 algarismos', () => {
  assert.throws(() => gerarCDC(dados({ rucEmissor: '123456789' })), CDCInvalido)
})

test('recusa sem número de documento', () => {
  assert.throws(() => gerarCDC(dados({ numeroDocumento: '' })), CDCInvalido)
})

test('recusa número de documento acima de 7 algarismos', () => {
  assert.throws(() => gerarCDC(dados({ numeroDocumento: '12345678' })), CDCInvalido)
})

test('recusa código de segurança que não tenha 9 algarismos', () => {
  assert.throws(() => gerarCDC(dados({ codigoSeguranca: '123' })), CDCInvalido)
  assert.throws(() => gerarCDC(dados({ codigoSeguranca: '1234567890' })), CDCInvalido)
})

test('recusa data inválida', () => {
  assert.throws(() => gerarCDC(dados({ dataEmissao: new Date('nada') })), CDCInvalido)
})
