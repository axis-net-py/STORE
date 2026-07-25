// Rodar: npm test
//
// Critério de aceitação da Fase 1 do Projeto 1: depois de extrair o `store`
// para módulo, o vertical tem de fazer exatamente o que fazia antes. Estes
// testes fixam a navegação que existia na lista fixa do Sidebar.tsx.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { navFor, isRotaBloqueada, CORE_NAV, MODULES } from './registry.ts'

/** Ordem exata da barra lateral antes da extração (Sidebar.tsx, linhas 33-45). */
const ORDEM_ORIGINAL = [
  'dashboard', 'pos', 'orders', 'invoices', 'products',
  'inventory', 'customers', 'suppliers', 'finance', 'accounting', 'reports',
]

test('vertical store reproduz a navegação original, na mesma ordem', () => {
  const chaves = navFor(['store']).map((n) => n.href)
  assert.deepEqual(chaves, ORDEM_ORIGINAL)
})

test('sem módulos, restam apenas as entradas do núcleo', () => {
  const chaves = navFor([]).map((n) => n.href)
  assert.ok(!chaves.includes('pos'), 'pos pertence ao módulo store')
  assert.ok(!chaves.includes('orders'), 'orders pertence ao módulo store')
  assert.equal(chaves.length, CORE_NAV.length)
})

test('o núcleo continua completo sem módulo nenhum', () => {
  const chaves = navFor([]).map((n) => n.href)
  for (const esperado of ['dashboard', 'invoices', 'products', 'inventory',
                          'customers', 'suppliers', 'finance', 'accounting', 'reports']) {
    assert.ok(chaves.includes(esperado), `${esperado} é núcleo e não pode desaparecer`)
  }
})

test('módulo desconhecido é ignorado, não rebenta', () => {
  const chaves = navFor(['store', 'inexistente']).map((n) => n.href)
  assert.deepEqual(chaves, ORDEM_ORIGINAL)
})

test('rota de módulo inativo é bloqueada', () => {
  assert.equal(isRotaBloqueada('pos', []), true)
  assert.equal(isRotaBloqueada('orders', []), true)
})

test('rota de módulo ativo passa', () => {
  assert.equal(isRotaBloqueada('pos', ['store']), false)
  assert.equal(isRotaBloqueada('orders', ['store']), false)
})

test('rota de núcleo nunca é bloqueada', () => {
  for (const rota of ['invoices', 'products', 'accounting', 'reports']) {
    assert.equal(isRotaBloqueada(rota, []), false, `${rota} é núcleo`)
  }
})

test('cada rota declarada no manifesto tem entrada de menu correspondente', () => {
  for (const m of Object.values(MODULES)) {
    const hrefs = m.nav.map((n) => n.href)
    for (const rota of m.routes) {
      assert.ok(hrefs.includes(rota), `módulo ${m.name}: rota "${rota}" sem entrada de menu`)
    }
  }
})
