// Rodar: npm test
//
// `assertPeriodOpen` recebe o cliente de base de dados como parâmetro, o que
// permite testá-lo com um duplo em memória — sem Postgres, sem Prisma gerado.
// É a guarda que impede lançamentos num período contabilístico já fechado.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertPeriodOpen } from './accounting-period.ts'

/** Duplo mínimo: devolve uma linha se (year, month) constar dos períodos fechados. */
function fakeDb(fechados: Array<{ tenantId: string; year: number; month: number }>) {
  return {
    accountingPeriod: {
      findFirst: async ({ where }: { where: { tenantId: string; year: number; month: number } }) => {
        const achou = fechados.some(
          (p) => p.tenantId === where.tenantId && p.year === where.year && p.month === where.month
        )
        return achou ? { id: 'periodo-fechado' } : null
      },
    },
  }
}

const TENANT = 'tenant-teste'

test('período aberto: não lança', async () => {
  const db = fakeDb([])
  await assertPeriodOpen(db, TENANT, new Date('2026-07-15'))
})

test('período fechado: lança e nomeia o mês', async () => {
  const db = fakeDb([{ tenantId: TENANT, year: 2026, month: 7 }])
  await assert.rejects(
    () => assertPeriodOpen(db, TENANT, new Date('2026-07-15')),
    /07\/2026.*fechado/
  )
})

test('fecho de um mês não afeta os outros', async () => {
  const db = fakeDb([{ tenantId: TENANT, year: 2026, month: 7 }])
  await assertPeriodOpen(db, TENANT, new Date('2026-06-15T12:00:00'))
  await assertPeriodOpen(db, TENANT, new Date('2026-08-15T12:00:00'))
})

// ─────────────────────────────────────────────────────────────────────────────
// Fuso horário — CORRIGIDO em 2026-07-31
//
// `assertPeriodOpen` usava getFullYear()/getMonth(), que leem o fuso do
// servidor. Na Vercel isso é UTC, e `new Date('2026-08-01')` — o que um
// <input type="date"> produz — é 31/07 às 21h em Assunção. O primeiro dia de
// cada mês era tratado como pertencendo ao mês anterior: fechado julho, uma
// fatura de 1 de agosto era recusada.
//
// Nem UTC nem hora local estão certos isoladamente. A regra e o porquê estão
// em lib/fuso.ts; aqui ficam os dois casos que a correção tem de acertar ao
// mesmo tempo.
// ─────────────────────────────────────────────────────────────────────────────

test('uma fatura de 1 de agosto passa com julho fechado', async () => {
  const db = fakeDb([{ tenantId: TENANT, year: 2026, month: 7 }])
  await assertPeriodOpen(db, TENANT, new Date('2026-08-01'))
})

test('e continua a ser recusada se for agosto que está fechado', async () => {
  const db = fakeDb([{ tenantId: TENANT, year: 2026, month: 8 }])
  await assert.rejects(() => assertPeriodOpen(db, TENANT, new Date('2026-08-01')), /08\/2026/)
})

test('às 22h de 31 de julho em Assunção o lançamento ainda é de julho', async () => {
  // O outro lado do mesmo problema: 22h em Assunção é 01h UTC do dia 1. Ler
  // em UTC daria agosto a um lançamento que fiscalmente é de julho, e ele
  // passaria com julho fechado.
  const db = fakeDb([{ tenantId: TENANT, year: 2026, month: 7 }])
  await assert.rejects(
    () => assertPeriodOpen(db, TENANT, new Date('2026-08-01T01:00:00Z')),
    /07\/2026/
  )
})

test('fecho de um tenant não afeta outro tenant', async () => {
  const db = fakeDb([{ tenantId: 'outro-tenant', year: 2026, month: 7 }])
  await assertPeriodOpen(db, TENANT, new Date('2026-07-15'))
})

test('aceita data em string', async () => {
  const db = fakeDb([{ tenantId: TENANT, year: 2026, month: 7 }])
  await assert.rejects(() => assertPeriodOpen(db, TENANT, '2026-07-15'), /fechado/)
})

test('fronteira de mês: 31/07 fechado, 01/08 aberto', async () => {
  const db = fakeDb([{ tenantId: TENANT, year: 2026, month: 7 }])
  await assert.rejects(() => assertPeriodOpen(db, TENANT, new Date('2026-07-31T12:00:00')), /fechado/)
  await assertPeriodOpen(db, TENANT, new Date('2026-08-01T12:00:00'))
})

test('fronteira de ano: 12/2025 fechado não fecha 12/2026', async () => {
  const db = fakeDb([{ tenantId: TENANT, year: 2025, month: 12 }])
  await assert.rejects(() => assertPeriodOpen(db, TENANT, new Date('2025-12-10')), /12\/2025/)
  await assertPeriodOpen(db, TENANT, new Date('2026-12-10'))
})
