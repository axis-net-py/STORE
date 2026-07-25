// Rodar: node --test src/lib/agenda.test.ts
// @ts-nocheck — node exige extensão .ts no import; tsconfig do Next não permite. Só teste.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { overlaps, startOfWeek, isWithinWorkingHours, blockPosition, DAY_TOTAL_MINUTES } from './agenda.ts'

const d = (s: string) => new Date(s)

test('overlaps: intervalos que se cruzam', () => {
  assert.ok(overlaps(d('2026-07-07T09:00'), d('2026-07-07T10:00'), d('2026-07-07T09:30'), d('2026-07-07T10:30')))
  assert.ok(overlaps(d('2026-07-07T09:00'), d('2026-07-07T10:00'), d('2026-07-07T08:00'), d('2026-07-07T11:00')))
})

test('overlaps: encostados não conflitam', () => {
  assert.equal(overlaps(d('2026-07-07T09:00'), d('2026-07-07T10:00'), d('2026-07-07T10:00'), d('2026-07-07T11:00')), false)
  assert.equal(overlaps(d('2026-07-07T09:00'), d('2026-07-07T10:00'), d('2026-07-07T08:00'), d('2026-07-07T09:00')), false)
})

test('startOfWeek: segunda-feira', () => {
  assert.equal(startOfWeek(d('2026-07-08T15:00')).getDay(), 1) // qua → seg
  assert.equal(startOfWeek(d('2026-07-12T09:00')).getDate(), 6) // dom 12 → seg 6
  assert.equal(startOfWeek(d('2026-07-06T00:00')).getDate(), 6) // seg → mesma seg
})

test('isWithinWorkingHours', () => {
  const wh = { tue: [['08:00', '12:00'], ['14:00', '18:00']] as [string, string][] }
  assert.ok(isWithinWorkingHours(wh, d('2026-07-07T09:00'))) // ter 9h
  assert.equal(isWithinWorkingHours(wh, d('2026-07-07T13:00')), false) // almoço
  assert.equal(isWithinWorkingHours(wh, d('2026-07-08T09:00')), false) // qua sem faixa
  assert.ok(isWithinWorkingHours(null, d('2026-07-08T09:00'))) // sem config = livre
})

test('blockPosition: clampa e tem altura mínima', () => {
  const p = blockPosition(d('2026-07-07T09:00'), d('2026-07-07T10:00'))
  assert.equal(p.topPct, ((2 * 60) / DAY_TOTAL_MINUTES) * 100)
  assert.ok(p.heightPct > 0)
})
