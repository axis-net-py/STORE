import { test } from 'node:test'
import assert from 'node:assert/strict'
import { destinoPermitido } from './destino-login.ts'

const BASE = 'https://axisnetpy.vercel.app'

test('o destino é sempre absoluto, porque o next-auth faz new URL() sem base', () => {
  // Esta é a regressão que trancou toda a gente à porta: devolver "/" fazia o
  // signIn atirar TypeError DEPOIS de a autenticação ter corrido bem.
  for (const url of ['/', '/dashboard', '/qualquer/coisa?x=1', 'http://outro.com', 'nao-e-url']) {
    const destino = destinoPermitido(url, BASE)
    assert.doesNotThrow(() => new URL(destino), `new URL falhou para ${url}`)
  }
})

test('caminho relativo ganha a origem da aplicação', () => {
  assert.equal(destinoPermitido('/', BASE), `${BASE}/`)
  assert.equal(destinoPermitido('/cliente/dashboard', BASE), `${BASE}/cliente/dashboard`)
  assert.equal(destinoPermitido('/login?callbackUrl=%2F', BASE), `${BASE}/login?callbackUrl=%2F`)
})

test('destino na própria origem passa intacto', () => {
  assert.equal(destinoPermitido(`${BASE}/dashboard`, BASE), `${BASE}/dashboard`)
})

test('destino noutra origem cai na raiz — não se sai daqui com sessão aberta', () => {
  assert.equal(destinoPermitido('https://cooper-antigo.vercel.app/dashboard', BASE), BASE)
  assert.equal(destinoPermitido('http://axisnetpy.vercel.app/', BASE), BASE) // esquema diferente
  assert.equal(destinoPermitido('https://axisnetpy.vercel.app.mau.com/', BASE), BASE)
})

test('URL ilegível cai na raiz em vez de rebentar', () => {
  assert.equal(destinoPermitido('nao-e-url', BASE), BASE)
  assert.equal(destinoPermitido('', BASE), BASE)
})
