// Rodar: npm test
//
// Um certificado que expira em silêncio é um cliente sem poder faturar, a
// pensar que o sistema avariou. Estes testes fixam quando o aviso aparece.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diasAte, estadoDoCertificado, deveAvisar, mensagem, MARCOS } from './certificado-alerta.ts'

const AGORA = new Date('2026-07-26T15:30:00Z')
const emDias = (n: number) => new Date(Date.UTC(2026, 6, 26 + n))

// ─── Contagem de dias ───────────────────────────────────────────────────────

test('conta dias inteiros, não horas', () => {
  // Às 15h30 de hoje, um certificado que expira amanhã de madrugada ainda
  // conta como 1 dia — contar de hora a hora daria 0 e assustaria sem razão.
  assert.equal(diasAte(emDias(1), AGORA), 1)
  assert.equal(diasAte(emDias(0), AGORA), 0)
  assert.equal(diasAte(emDias(30), AGORA), 30)
})

test('data passada dá dias negativos', () => {
  assert.equal(diasAte(emDias(-5), AGORA), -5)
})

test('sem data de validade devolve null', () => {
  assert.equal(diasAte(null, AGORA), null)
  assert.equal(diasAte(undefined, AGORA), null)
})

// ─── Classificação ──────────────────────────────────────────────────────────

test('certificado com meses de vida está ok e não avisa', () => {
  const e = estadoDoCertificado(emDias(200), true, AGORA)
  assert.equal(e.severidade, 'ok')
  assert.equal(deveAvisar(e), false)
})

test('30 dias abre a janela de aviso', () => {
  const e = estadoDoCertificado(emDias(30), true, AGORA)
  assert.equal(e.severidade, 'aviso')
  assert.equal(e.marco, 30)
  assert.equal(deveAvisar(e), true)
})

test('31 dias ainda não avisa', () => {
  assert.equal(estadoDoCertificado(emDias(31), true, AGORA).severidade, 'ok')
})

test('sete dias ou menos passa a urgente', () => {
  for (const d of [7, 3, 1, 0]) {
    const e = estadoDoCertificado(emDias(d), true, AGORA)
    assert.equal(e.severidade, 'urgente', `${d} dias`)
    assert.equal(deveAvisar(e), true)
  }
})

test('expirado é expirado, e avisa', () => {
  const e = estadoDoCertificado(emDias(-1), true, AGORA)
  assert.equal(e.severidade, 'expirado')
  assert.equal(deveAvisar(e), true)
})

test('sem certificado é a pior situação e avisa', () => {
  const e = estadoDoCertificado(null, false, AGORA)
  assert.equal(e.severidade, 'sem-certificado')
  assert.equal(deveAvisar(e), true)
})

test('com certificado mas sem data não inventa aviso', () => {
  // Não sabemos quando expira: fingir que sabemos seria pior que calar.
  const e = estadoDoCertificado(null, true, AGORA)
  assert.equal(e.severidade, 'ok')
  assert.equal(deveAvisar(e), false)
})

test('o marco escolhido é o mais próximo que cobre os dias', () => {
  assert.equal(estadoDoCertificado(emDias(30), true, AGORA).marco, 30)
  assert.equal(estadoDoCertificado(emDias(20), true, AGORA).marco, 30)
  assert.equal(estadoDoCertificado(emDias(14), true, AGORA).marco, 14)
  assert.equal(estadoDoCertificado(emDias(10), true, AGORA).marco, 14)
  assert.equal(estadoDoCertificado(emDias(5), true, AGORA).marco, 7)
  assert.equal(estadoDoCertificado(emDias(1), true, AGORA).marco, 1)
})

test('os marcos estão por ordem decrescente e são coerentes', () => {
  const ordenados = [...MARCOS].sort((a, b) => b - a)
  assert.deepEqual([...MARCOS], ordenados)
  assert.ok(MARCOS.every((m) => m > 0))
})

// ─── Mensagens ──────────────────────────────────────────────────────────────

test('a mensagem de expirado diz que a emissão está bloqueada', () => {
  const m = mensagem(estadoDoCertificado(emDias(-3), true, AGORA), 'Smart Buy')
  assert.match(m, /Smart Buy/)
  assert.match(m, /EXPIRADO/)
  assert.match(m, /bloqueada/)
  assert.match(m, /3 dia/)
})

test('a mensagem de ausência explica a consequência', () => {
  const m = mensagem(estadoDoCertificado(null, false, AGORA), 'Ferretería Sur')
  assert.match(m, /não é possível emitir/)
})

test('a mensagem urgente pede renovação', () => {
  const m = mensagem(estadoDoCertificado(emDias(2), true, AGORA), 'AXIS')
  assert.match(m, /urgência/)
  assert.match(m, /2 dia/)
})
