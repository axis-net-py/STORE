// Rodar: npm test
//
// O limitador de força bruta no login existe apenas no STORE e será propagado
// aos outros verticais na Fase 4. Estes testes fixam o contrato antes disso.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isRateLimited, recordFailedAttempt, clearAttempts } from './rate-limit.ts'

// MAX_ATTEMPTS = 5, WINDOW_MS = 15 min (rate-limit.ts)

test('chave nunca vista não está limitada', () => {
  assert.equal(isRateLimited('nunca-vista@exemplo.py'), false)
})

test('permite 5 tentativas e bloqueia à quinta', () => {
  const key = 'bloqueio@exemplo.py'
  clearAttempts(key)

  for (let i = 0; i < 4; i++) {
    recordFailedAttempt(key)
    assert.equal(isRateLimited(key), false, `não devia bloquear à tentativa ${i + 1}`)
  }

  recordFailedAttempt(key)
  assert.equal(isRateLimited(key), true, 'devia bloquear à 5ª tentativa')
})

test('continua bloqueado depois de mais tentativas', () => {
  const key = 'insistente@exemplo.py'
  clearAttempts(key)
  for (let i = 0; i < 10; i++) recordFailedAttempt(key)
  assert.equal(isRateLimited(key), true)
})

test('clearAttempts liberta a chave — login bem-sucedido', () => {
  const key = 'recuperado@exemplo.py'
  clearAttempts(key)
  for (let i = 0; i < 5; i++) recordFailedAttempt(key)
  assert.equal(isRateLimited(key), true)

  clearAttempts(key)
  assert.equal(isRateLimited(key), false)
})

test('chaves são independentes entre si', () => {
  const a = 'cliente-a@exemplo.py'
  const b = 'cliente-b@exemplo.py'
  clearAttempts(a)
  clearAttempts(b)

  for (let i = 0; i < 5; i++) recordFailedAttempt(a)

  assert.equal(isRateLimited(a), true)
  assert.equal(isRateLimited(b), false, 'bloquear A não pode bloquear B')
})
