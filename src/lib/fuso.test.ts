import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parteDataFiscal, dataFiscalAAAAMMDD, dataFiscalISO } from './fuso.ts'

// ─── Data de calendário: o que a pessoa escolheu no <input type="date"> ──────

test('1 de agosto escolhido no calendário é 1 de agosto', () => {
  // Este era o defeito: new Date('2026-08-01') é 31/07 às 21h em Assunção, e
  // com julho fechado a fatura de 1 de agosto era recusada.
  assert.deepEqual(parteDataFiscal(new Date('2026-08-01')), { ano: 2026, mes: 8, dia: 1 })
})

test('a string de um <input type="date"> dá a mesma data', () => {
  assert.deepEqual(parteDataFiscal('2026-08-01'), { ano: 2026, mes: 8, dia: 1 })
})

test('1 de janeiro não recua para o ano anterior', () => {
  assert.deepEqual(parteDataFiscal(new Date('2026-01-01')), { ano: 2026, mes: 1, dia: 1 })
})

// ─── Instante real: o relógio de Assunção ───────────────────────────────────

test('às 22h de 31 de julho em Assunção o documento ainda é de julho', () => {
  // 22h em Assunção (UTC−3) é 01h UTC do dia 1. Ler em UTC daria agosto a um
  // documento que fiscalmente é de julho.
  assert.deepEqual(parteDataFiscal(new Date('2026-08-01T01:00:00Z')), {
    ano: 2026,
    mes: 7,
    dia: 31,
  })
})

test('às 2h de 1 de agosto em Assunção o documento já é de agosto', () => {
  assert.deepEqual(parteDataFiscal(new Date('2026-08-01T05:00:00Z')), {
    ano: 2026,
    mes: 8,
    dia: 1,
  })
})

test('meio-dia UTC cai no mesmo dia nos dois fusos', () => {
  assert.deepEqual(parteDataFiscal(new Date('2026-07-15T12:00:00Z')), {
    ano: 2026,
    mes: 7,
    dia: 15,
  })
})

test('o Paraguai está em UTC−3 também em janeiro (não há horário de verão)', () => {
  assert.deepEqual(parteDataFiscal(new Date('2026-01-15T02:00:00Z')), {
    ano: 2026,
    mes: 1,
    dia: 14,
  })
})

// ─── Formatos ───────────────────────────────────────────────────────────────

test('AAAAMMDD é o formato dos documentos da SET', () => {
  assert.equal(dataFiscalAAAAMMDD(new Date('2026-08-01')), '20260801')
  assert.equal(dataFiscalAAAAMMDD(new Date('2026-08-01T01:00:00Z')), '20260731')
})

test('ISO para mostrar e gravar', () => {
  assert.equal(dataFiscalISO(new Date('2026-08-01')), '2026-08-01')
  assert.equal(dataFiscalISO(new Date('2026-12-05T15:00:00Z')), '2026-12-05')
})

test('recusa data inválida', () => {
  assert.throws(() => parteDataFiscal(new Date('nada')), /Data inválida/)
  assert.throws(() => parteDataFiscal('não é data'), /Data inválida/)
})
