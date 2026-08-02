import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acentoDoCliente, acentoValido, ACENTOS } from './tema.ts'

test('cada vertical recupera a cor que tinha antes da unificação', () => {
  assert.equal(acentoDoCliente(null, ['store']), 'blue')
  assert.equal(acentoDoCliente(null, ['farm']), 'green')
  assert.equal(acentoDoCliente(null, ['clinic']), 'offwhite')
})

test('a escolha do cliente ganha ao vertical', () => {
  assert.equal(acentoDoCliente('red', ['farm']), 'red')
  assert.equal(acentoDoCliente('offwhite', ['store']), 'offwhite')
})

test('cliente com vários módulos herda a cor do primeiro', () => {
  assert.equal(acentoDoCliente(null, ['farm', 'store']), 'green')
})

test('sem módulos conhecidos cai no azul, e nunca em nulo', () => {
  assert.equal(acentoDoCliente(null, []), 'blue')
  assert.equal(acentoDoCliente(null, null), 'blue')
  assert.equal(acentoDoCliente(null, ['modulo-que-nao-existe']), 'blue')
})

test('valor inválido na base não deixa a aplicação sem paleta', () => {
  // Migração a meio, edição manual, cor removida numa versão futura: em
  // qualquer destes casos vale o vertical, não um ecrã sem cores.
  assert.equal(acentoDoCliente('roxo', ['clinic']), 'offwhite')
  assert.equal(acentoDoCliente('', ['farm']), 'green')
  assert.equal(acentoDoCliente(undefined, ['store']), 'blue')
})

test('acentoValido aceita exatamente as quatro cores', () => {
  for (const cor of ACENTOS) assert.equal(acentoValido(cor), true)
  assert.equal(acentoValido('roxo'), false)
  assert.equal(acentoValido(null), false)
  assert.equal(acentoValido(123), false)
})
