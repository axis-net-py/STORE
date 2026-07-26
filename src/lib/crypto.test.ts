// Rodar: npm test
//
// Esta cifra protege certificados fiscais e strings de ligação. Um erro aqui
// não dá erro visível — dá segredos legíveis por quem não devia. Daí testar
// não só o caminho feliz, mas sobretudo o que tem de FALHAR.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cifrar, decifrar, CHAVE_TENANT, CHAVE_LIGACOES } from './crypto.ts'

const VAR = 'CHAVE_DE_TESTE'
const OUTRA = 'CHAVE_DE_TESTE_2'

process.env[VAR] = 'uma-frase-passe-suficientemente-longa-para-teste'
process.env[OUTRA] = 'outra-frase-passe-completamente-diferente-aqui'

test('o que se cifra volta igual', () => {
  const original = 'certificado-p12-em-base64-com-acentuação-e-símbolos-€'
  const c = cifrar(original, VAR)
  assert.equal(decifrar(c, VAR), original)
})

test('o texto cifrado não contém o original', () => {
  const c = cifrar('senha-do-certificado', VAR)
  assert.ok(!c.cipher.includes('senha'))
  assert.ok(!Buffer.from(c.cipher, 'base64').toString('utf8').includes('senha'))
})

test('cifrar duas vezes dá resultados diferentes', () => {
  // IV novo por operação: sem isto, textos iguais dariam cifrados iguais e
  // revelariam que dois clientes têm o mesmo segredo.
  const a = cifrar('mesmo-texto', VAR)
  const b = cifrar('mesmo-texto', VAR)
  assert.notEqual(a.cipher, b.cipher)
  assert.notEqual(a.iv, b.iv)
  assert.equal(decifrar(a, VAR), decifrar(b, VAR))
})

test('adulterar o texto cifrado faz a decifra FALHAR', () => {
  const c = cifrar('dados-fiscais-sensíveis', VAR)
  const bytes = Buffer.from(c.cipher, 'base64')
  bytes[0] = bytes[0] ^ 0xff
  const adulterado = { ...c, cipher: bytes.toString('base64') }

  // Isto é o ponto do GCM: falha em vez de devolver lixo silenciosamente.
  assert.throws(() => decifrar(adulterado, VAR))
})

test('adulterar a etiqueta de autenticação faz falhar', () => {
  const c = cifrar('dados', VAR)
  const t = Buffer.from(c.tag, 'base64')
  t[0] = t[0] ^ 0xff
  assert.throws(() => decifrar({ ...c, tag: t.toString('base64') }, VAR))
})

test('trocar o IV faz falhar', () => {
  const a = cifrar('dados', VAR)
  const b = cifrar('outros', VAR)
  assert.throws(() => decifrar({ ...a, iv: b.iv }, VAR))
})

test('a chave errada não decifra', () => {
  const c = cifrar('certificado', VAR)
  assert.throws(() => decifrar(c, OUTRA))
})

test('chave em falta dá erro explícito, não silencioso', () => {
  assert.throws(
    () => cifrar('x', 'VARIAVEL_QUE_NAO_EXISTE'),
    /em falta/
  )
})

test('chave demasiado curta é recusada', () => {
  process.env.CHAVE_CURTA = 'curta'
  assert.throws(() => cifrar('x', 'CHAVE_CURTA'), /curta/i)
})

test('as duas chaves do sistema são distintas', () => {
  // Comprometer o registo de clientes não pode dar acesso aos certificados.
  assert.notEqual(CHAVE_LIGACOES, CHAVE_TENANT)
})

test('aguenta texto grande — um .p12 em base64', () => {
  const grande = 'A'.repeat(200_000)
  const c = cifrar(grande, VAR)
  assert.equal(decifrar(c, VAR), grande)
})

test('aguenta texto vazio', () => {
  const c = cifrar('', VAR)
  assert.equal(decifrar(c, VAR), '')
})
