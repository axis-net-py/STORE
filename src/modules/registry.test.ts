// Rodar: npm test
//
// Critério de aceitação da Fase 1 do Projeto 1: depois de extrair o `store`
// para módulo, o vertical tem de fazer exatamente o que fazia antes. Estes
// testes fixam a navegação que existia na lista fixa do Sidebar.tsx.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { navFor, isRotaBloqueada, CORE_NAV, MODULES, moduloDaAcao, acaoBloqueadaPorModulo } from './registry.ts'

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

// ─── Fase 2 — módulo farm ───────────────────────────────────────────────────

/** Ordem exata da barra lateral do FARM (Sidebar.tsx do repositório FARM). */
const ORDEM_FARM = [
  'dashboard', 'invoices', 'products', 'inventory', 'customers', 'suppliers',
  'safra', 'talhoes', 'silos', 'rebanho', 'frota', 'funcionarios',
  'contratos', 'certificacoes', 'finance', 'accounting', 'reports',
]

test('vertical farm reproduz a navegação do FARM, com o bloco agrícola no sítio', () => {
  const chaves = navFor(['farm']).map((n) => n.href)
  assert.deepEqual(chaves, ORDEM_FARM)
})

test('farm não traz o PDV nem os Pedidos do store', () => {
  const chaves = navFor(['farm']).map((n) => n.href)
  assert.ok(!chaves.includes('pos'))
  assert.ok(!chaves.includes('orders'))
})

test('store continua intacto depois de o farm existir', () => {
  const chaves = navFor(['store']).map((n) => n.href)
  assert.deepEqual(chaves, ORDEM_ORIGINAL)
})

test('rotas do farm bloqueadas para quem só tem store', () => {
  for (const rota of ['safra', 'talhoes', 'silos', 'rebanho', 'frota',
                      'funcionarios', 'contratos', 'certificacoes']) {
    assert.equal(isRotaBloqueada(rota, ['store']), true, `${rota} devia estar fechada`)
    assert.equal(isRotaBloqueada(rota, ['farm']), false, `${rota} devia abrir para o farm`)
  }
})

test('cliente misto acumula os dois conjuntos sem duplicar o núcleo', () => {
  const chaves = navFor(['store', 'farm']).map((n) => n.href)
  assert.ok(chaves.includes('pos') && chaves.includes('safra'))
  assert.equal(new Set(chaves).size, chaves.length, 'não pode haver entradas repetidas')
  assert.equal(chaves.filter((c) => c === 'dashboard').length, 1)
})

// ─── Fase 3 — módulo clinic ─────────────────────────────────────────────────

test('clinic coloca a Agenda logo a seguir ao Dashboard, como no CLINIC', () => {
  const chaves = navFor(['clinic']).map((n) => n.href)
  assert.equal(chaves[0], 'dashboard')
  assert.equal(chaves[1], 'agenda')
})

test('clinic mantém profissionais e serviços antes da Contabilidade', () => {
  const chaves = navFor(['clinic']).map((n) => n.href)
  const i = (h: string) => chaves.indexOf(h)
  assert.ok(i('suppliers') < i('profissionais'), 'profissionais vêm depois de fornecedores')
  assert.ok(i('profissionais') < i('servicos'))
  assert.ok(i('servicos') < i('accounting'), 'serviços vêm antes da contabilidade')
})

test('clinic renomeia Clientes para Pacientes, sem mudar a rota', () => {
  const clientes = navFor(['clinic']).find((n) => n.href === 'customers')
  assert.equal(clientes?.key, 'customersPatients', 'o override troca a chave de tradução')
  assert.equal(clientes?.href, 'customers', 'a rota tem de continuar a mesma')
})

test('a renomeação não escapa para os outros verticais', () => {
  for (const vertical of [['store'], ['farm'], []]) {
    const clientes = navFor(vertical).find((n) => n.href === 'customers')
    assert.equal(clientes?.key, 'customers', `vertical ${vertical.join()} não devia ver "Pacientes"`)
  }
})

test('rotas do clinic bloqueadas para quem não tem o módulo', () => {
  for (const rota of ['agenda', 'profissionais', 'servicos']) {
    assert.equal(isRotaBloqueada(rota, ['store']), true)
    assert.equal(isRotaBloqueada(rota, ['farm']), true)
    assert.equal(isRotaBloqueada(rota, ['clinic']), false)
  }
})

test('store e farm continuam intactos depois da Fase 3', () => {
  assert.deepEqual(navFor(['store']).map((n) => n.href), ORDEM_ORIGINAL)
  assert.deepEqual(navFor(['farm']).map((n) => n.href), ORDEM_FARM)
})

test('os três verticais coexistem sem duplicar o núcleo', () => {
  const chaves = navFor(['store', 'farm', 'clinic']).map((n) => n.href)
  assert.equal(new Set(chaves).size, chaves.length, 'não pode haver repetições')
  for (const esperado of ['pos', 'safra', 'agenda']) {
    assert.ok(chaves.includes(esperado), `${esperado} devia estar presente`)
  }
})

// ─── i18n ───────────────────────────────────────────────────────────────────
//
// A barra lateral traduz por chave (next-intl). Uma entrada sem tradução
// aparece ao utilizador como a chave crua — "safra" em vez de "Safras".

test('toda entrada de navegação tem tradução nos dois idiomas', async () => {
  const pt = (await import('../messages/pt-BR.json', { with: { type: 'json' } })).default as any
  const es = (await import('../messages/es-PY.json', { with: { type: 'json' } })).default as any

  const todas = new Set<string>()
  for (const e of navFor(Object.keys(MODULES))) todas.add(e.key)
  // Inclui o rótulo alternativo da clínica, que só aparece com esse módulo.
  for (const m of Object.values(MODULES)) {
    for (const k of Object.values(m.labelOverrides ?? {})) todas.add(k)
  }

  for (const chave of todas) {
    assert.ok(pt.nav?.[chave], `falta tradução pt-BR para nav.${chave}`)
    assert.ok(es.nav?.[chave], `falta tradução es-PY para nav.${chave}`)
  }
})

test('cada rota declarada no manifesto tem entrada de menu correspondente', () => {
  for (const m of Object.values(MODULES)) {
    // Uma rota sem entrada de menu ou é uma entrada esquecida — e fica
    // inalcançável — ou é uma rota a que se chega de dentro, e nesse caso tem
    // de estar declarada. Do código as duas são iguais; para quem usa não são.
    const alcancaveis = [...m.nav.map((n) => n.href), ...(m.routesSemMenu ?? [])]
    for (const rota of m.routes) {
      assert.ok(
        alcancaveis.includes(rota),
        `módulo ${m.name}: rota "${rota}" sem entrada de menu nem declaração em routesSemMenu`
      )
    }
  }
})

// ─── Ações de módulo não contratado ─────────────────────────
//
// O guarda de rotas fecha o URL, mas as server actions de um módulo eram
// chamáveis por HTTP à mesma. Como o SOVEREIGN passa sem consultar a matriz
// de permissões, o dono de um cliente só-store conseguia chamar as ações do
// farm. Auditoria de 2026-07-30.

test('uma ação de módulo é atribuída ao seu módulo', () => {
  assert.equal(moduloDaAcao('farm:write'), 'farm')
  assert.equal(moduloDaAcao('clinic:read'), 'clinic')
})

test('uma ação do núcleo não pertence a módulo nenhum', () => {
  assert.equal(moduloDaAcao('invoices:write'), null)
  assert.equal(moduloDaAcao('accounting:read'), null)
  assert.equal(moduloDaAcao('users:manage'), null)
})

test('ação de módulo não contratado é bloqueada', () => {
  assert.ok(acaoBloqueadaPorModulo('farm:write', ['store']))
  assert.ok(acaoBloqueadaPorModulo('clinic:read', ['store', 'farm']))
})

test('ação de módulo contratado passa', () => {
  assert.ok(!acaoBloqueadaPorModulo('farm:write', ['store', 'farm']))
})

test('o núcleo nunca é bloqueado por módulo', () => {
  // Um cliente sem módulo nenhum continua a faturar: o núcleo é de todos.
  assert.ok(!acaoBloqueadaPorModulo('invoices:write', []))
  assert.ok(!acaoBloqueadaPorModulo('dashboard:read', []))
})

test('toda ação declarada num manifesto é reconhecida como sendo dele', () => {
  for (const m of Object.values(MODULES)) {
    for (const acao of m.permissions) {
      assert.equal(moduloDaAcao(acao), m.name, acao)
      assert.ok(acaoBloqueadaPorModulo(acao, []), acao + ' devia ser bloqueada sem o módulo')
    }
  }
})
