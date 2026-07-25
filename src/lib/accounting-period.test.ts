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
// DEFEITO CONHECIDO — fuso horário
//
// `assertPeriodOpen` usa getFullYear()/getMonth(), que são hora LOCAL, sobre
// datas que frequentemente chegam em UTC. `new Date('2026-08-01')` é meia-noite
// UTC = 31/07 às 21h em America/Asuncion ou America/Sao_Paulo (UTC-3).
//
// Resultado: o primeiro dia de cada mês é tratado como pertencendo ao mês
// anterior. Fechado julho, uma fatura de 1 de agosto é recusada.
//
// Alcançável no caminho principal: `data.issuedAt` vindo de <input type="date">
// produz exatamente este valor (invoice.ts:112, 234), e `invoice.issuedAt` lido
// de volta do Postgres preserva-o (invoice.ts:390, 462, 593).
//
// NÃO corrigido aqui: nem UTC nem hora local estão certos isoladamente — com
// `new Date()` às 22h de 31/07 em Assunção, os getters UTC dariam agosto a um
// documento que fiscalmente é de julho. A correção exige normalizar como as
// datas são guardadas, com validação fiscal. Ver inventário §7.
//
// O teste abaixo fixa o comportamento ERRADO ATUAL para que a unificação não o
// altere por acidente antes de haver uma decisão.
// ─────────────────────────────────────────────────────────────────────────────

test('DEFEITO: dia 1 é atribuído ao mês anterior (fuso UTC-3)', async () => {
  const db = fakeDb([{ tenantId: TENANT, year: 2026, month: 7 }])
  await assert.rejects(
    () => assertPeriodOpen(db, TENANT, new Date('2026-08-01')),
    /07\/2026/,
    'comportamento atual, incorreto — ver bloco acima'
  )
})

test.todo('1 de agosto deve pertencer ao período de agosto, não ao de julho')

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
