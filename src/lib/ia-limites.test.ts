import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bytesDeBase64, anexoDemasiadoGrande, mimeAceite,
  excedeuLimite, registarPedido, limparRegistos,
  LIMITE_PEDIDOS, JANELA_MS, LIMITE_ANEXO_BYTES,
} from './ia-limites.ts'

test('mede o base64 sem o descodificar', () => {
  // "abc" -> "YWJj" (sem preenchimento), "ab" -> "YWI=" , "a" -> "YQ=="
  assert.equal(bytesDeBase64('YWJj'), 3)
  assert.equal(bytesDeBase64('YWI='), 2)
  assert.equal(bytesDeBase64('YQ=='), 1)
  assert.equal(bytesDeBase64(''), 0)
})

test('aceita o prefixo data: que o navegador produz', () => {
  assert.equal(bytesDeBase64('data:image/jpeg;base64,YWJj'), 3)
})

test('o anexo grande é recusado e o pequeno passa', () => {
  const grande = 'A'.repeat(Math.ceil(((LIMITE_ANEXO_BYTES + 1024) * 4) / 3))
  assert.equal(anexoDemasiadoGrande(grande), true)
  assert.equal(anexoDemasiadoGrande('YWJj'), false)
  // Sem anexo não há nada a recusar.
  assert.equal(anexoDemasiadoGrande(null), false)
  assert.equal(anexoDemasiadoGrande(undefined), false)
})

test('só passam PDF e imagem', () => {
  assert.equal(mimeAceite('application/pdf'), true)
  assert.equal(mimeAceite('image/jpeg'), true)
  assert.equal(mimeAceite('IMAGE/PNG'), true)
  assert.equal(mimeAceite('image/jpeg; charset=binary'), true)
  assert.equal(mimeAceite('video/mp4'), false)
  assert.equal(mimeAceite('application/zip'), false)
  assert.equal(mimeAceite(null), false)
  assert.equal(mimeAceite(''), false)
})

test('a janela deixa passar até ao teto e depois trava', () => {
  limparRegistos()
  const chave = 'utilizador-1'
  for (let i = 0; i < LIMITE_PEDIDOS; i++) {
    assert.equal(excedeuLimite(chave), false, `pedido ${i + 1} devia passar`)
    registarPedido(chave)
  }
  assert.equal(excedeuLimite(chave), true, 'o pedido seguinte devia ser travado')
})

test('a janela desliza: passado o intervalo volta a aceitar', () => {
  limparRegistos()
  const chave = 'utilizador-2'
  const t0 = 1_000_000
  for (let i = 0; i < LIMITE_PEDIDOS; i++) registarPedido(chave, t0)
  assert.equal(excedeuLimite(chave, t0), true)
  assert.equal(excedeuLimite(chave, t0 + JANELA_MS + 1), false)
})

test('o teto é por utilizador, não global', () => {
  limparRegistos()
  for (let i = 0; i < LIMITE_PEDIDOS; i++) registarPedido('ana')
  assert.equal(excedeuLimite('ana'), true)
  assert.equal(excedeuLimite('bruno'), false)
})
