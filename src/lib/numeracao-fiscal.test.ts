// Rodar: npm test
//
// A numeração de documentos fiscais é matéria legal, não detalhe de formato.
// Auditoria de 2026-07-30: o prefixo estava fixo em "001-001", ignorando o
// estabelecimento e o ponto de emissão do cliente — um cliente com segunda
// loja emitiria todos os documentos como se fossem da primeira.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  prefixoFiscal, formatarNumero, numeroValido, extrairSequencial,
  proximoNumero, SEQUENCIAL_MAXIMO,
} from './numeracao-fiscal.ts'

// ─── Prefixo ────────────────────────────────────────────────────────────────

test('o prefixo vem do cadastro do cliente, não fixo', () => {
  assert.equal(prefixoFiscal('002', '005'), '002-005-')
  assert.equal(prefixoFiscal('010', '001'), '010-001-')
})

test('sem configuração, assume o primeiro estabelecimento e ponto', () => {
  assert.equal(prefixoFiscal(null, null), '001-001-')
  assert.equal(prefixoFiscal(undefined, undefined), '001-001-')
  assert.equal(prefixoFiscal('', ''), '001-001-')
})

test('completa com zeros à esquerda — a SET exige três dígitos', () => {
  assert.equal(prefixoFiscal('2', '7'), '002-007-')
  assert.equal(prefixoFiscal(' 2 ', ' 7 '), '002-007-')
})

// ─── Formato ────────────────────────────────────────────────────────────────

test('o número tem sete dígitos no sequencial', () => {
  assert.equal(formatarNumero('001-001-', 1), '001-001-0000001')
  assert.equal(formatarNumero('001-001-', 42), '001-001-0000042')
  assert.equal(formatarNumero('002-003-', 1234567), '002-003-1234567')
})

test('só o formato EEE-PPP-NNNNNNN é aceite', () => {
  assert.equal(numeroValido('001-001-0000001'), true)
  for (const mau of [
    '1-1-1', '001-001-1', '001-001-00000001', 'AAA-001-0000001',
    '001-001-0000001 ', ' 001-001-0000001', '001/001/0000001', '',
  ]) {
    assert.equal(numeroValido(mau), false, mau)
  }
})

// ─── Sequência ──────────────────────────────────────────────────────────────

test('a primeira fatura de um ponto de emissão é a número 1', () => {
  assert.equal(proximoNumero('001-001-', null), '001-001-0000001')
  assert.equal(proximoNumero('003-002-', undefined), '003-002-0000001')
})

test('incrementa de um em um, sem saltos', () => {
  assert.equal(proximoNumero('001-001-', '001-001-0000001'), '001-001-0000002')
  assert.equal(proximoNumero('001-001-', '001-001-0000099'), '001-001-0000100')
  assert.equal(proximoNumero('001-001-', '001-001-0999999'), '001-001-1000000')
})

test('mantém o prefixo pedido, mesmo que o último seja de outro ponto', () => {
  // Ao mudar de ponto de emissão, a sequência do novo começa do próprio último.
  assert.equal(proximoNumero('002-001-', '002-001-0000010'), '002-001-0000011')
})

test('número corrompido recomeça em 1, com o prefixo certo', () => {
  // Melhor recomeçar de forma previsível do que propagar lixo para a SET.
  assert.equal(proximoNumero('004-002-', 'lixo'), '004-002-0000001')
  assert.equal(proximoNumero('004-002-', ''), '004-002-0000001')
})

test('extrai o sequencial de um número válido', () => {
  assert.equal(extrairSequencial('001-001-0000042'), 42)
  assert.equal(extrairSequencial('002-003-1234567'), 1234567)
  assert.equal(extrairSequencial('inválido'), null)
})

test('esgotar a sequência é erro explícito, não overflow silencioso', () => {
  // 9.999.999 é o último número possível num ponto de emissão. Passar disso
  // exige um timbrado novo — continuar a numerar seria irregular.
  assert.throws(
    () => proximoNumero('001-001-', formatarNumero('001-001-', SEQUENCIAL_MAXIMO)),
    /esgotada|timbrado/i
  )
})

test('o penúltimo número ainda funciona', () => {
  const penultimo = formatarNumero('001-001-', SEQUENCIAL_MAXIMO - 1)
  assert.equal(proximoNumero('001-001-', penultimo), '001-001-9999999')
})
