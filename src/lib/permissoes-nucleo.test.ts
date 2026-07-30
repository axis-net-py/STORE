// Rodar: npm test
//
// Matriz de permissões do núcleo.
//
// Auditoria de 2026-07-30: OPERATOR e AUDITOR não recebiam permissão nenhuma.
// requirePermission liberta SOVEREIGN e ADMIN por regra, mas exige uma linha
// para os outros dois — e o recurso legado só se aplica quando o cliente não
// tem matriz nenhuma. Resultado: os dois papéis estavam trancados fora de
// TUDO, e o utilizador operator@axis.erp não conseguia executar uma ação.
//
// Não basta não negar: é preciso conceder explicitamente.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { permissoesDoNucleo } from './permissoes-nucleo.ts'

const M = permissoesDoNucleo('t1')
const doPapel = (papel: string) => M.filter((l) => l.role === papel).map((l) => l.action)

test('os quatro papéis recebem permissões', () => {
  for (const papel of ['SOVEREIGN', 'ADMIN', 'OPERATOR', 'AUDITOR']) {
    assert.ok(doPapel(papel).length > 0, `${papel} sem permissão nenhuma — fica trancado fora`)
  }
})

test('SOVEREIGN recebe tudo', () => {
  const todas = new Set(M.map((l) => l.action))
  assert.equal(doPapel('SOVEREIGN').length, todas.size)
})

test('só o SOVEREIGN apaga', () => {
  for (const papel of ['ADMIN', 'OPERATOR', 'AUDITOR']) {
    const apaga = doPapel(papel).filter((a) => a.endsWith(':delete'))
    assert.deepEqual(apaga, [], `${papel} não pode apagar`)
  }
  assert.ok(doPapel('SOVEREIGN').some((a) => a.endsWith(':delete')))
})

test('só o SOVEREIGN gere utilizadores', () => {
  for (const papel of ['ADMIN', 'OPERATOR', 'AUDITOR']) {
    assert.ok(!doPapel(papel).includes('users:manage'), `${papel} não gere utilizadores`)
  }
  assert.ok(doPapel('SOVEREIGN').includes('users:manage'))
})

test('o OPERATOR opera mas não altera configurações', () => {
  const op = doPapel('OPERATOR')
  assert.ok(op.includes('invoices:write'), 'tem de poder faturar')
  assert.ok(op.includes('products:write'))
  assert.ok(op.includes('inventory:write'))
  assert.ok(!op.includes('settings:write'), 'configurações não são do operador')
})

test('o AUDITOR só lê', () => {
  const aud = doPapel('AUDITOR')
  assert.ok(aud.length > 0)
  assert.ok(aud.every((a) => a.endsWith(':read')), 'o auditor confere, não lança')
  assert.ok(aud.includes('accounting:read'), 'tem de ver a contabilidade')
  assert.ok(aud.includes('reports:read'))
})

test('leitura operacional está aberta a todos os papéis', () => {
  for (const acao of ['invoices:read', 'products:read', 'customers:read', 'accounting:read']) {
    for (const papel of ['SOVEREIGN', 'ADMIN', 'OPERATOR', 'AUDITOR']) {
      assert.ok(doPapel(papel).includes(acao), `${papel} devia poder ler ${acao}`)
    }
  }
})

test('não há linhas repetidas', () => {
  const chaves = M.map((l) => `${l.role}|${l.action}`)
  assert.equal(new Set(chaves).size, chaves.length)
})

test('todas as linhas pertencem ao cliente pedido', () => {
  for (const l of M) assert.equal(l.tenantId, 't1')
})
