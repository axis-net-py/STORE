// Rodar: npm test
//
// Fase 4 do Projeto 1: o farm e o clinic não tinham autorização nenhuma nas
// server actions — 0 de 15 e 0 de 4 ficheiros. Estes testes fixam a matriz de
// permissões que passou a existir.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { permissionsFor, seedModulePermissions } from './permissions.ts'
import { MODULES } from './registry.ts'

test('cada módulo declara read, write e delete', () => {
  for (const m of Object.values(MODULES)) {
    for (const nivel of ['read', 'write', 'delete']) {
      assert.ok(
        m.permissions.includes(`${m.name}:${nivel}`),
        `módulo ${m.name} não declara ${m.name}:${nivel}`
      )
    }
  }
})

test('as permissões seguem o formato modulo:nivel', () => {
  for (const acao of permissionsFor(Object.keys(MODULES))) {
    assert.match(acao, /^[a-z]+:(read|write|delete)$/, `formato inválido: ${acao}`)
  }
})

test('sem módulos não há permissões de módulo', () => {
  assert.deepEqual(permissionsFor([]), [])
})

test('um cliente só recebe as permissões dos módulos que tem', () => {
  const doFarm = permissionsFor(['farm'])
  assert.ok(doFarm.includes('farm:write'))
  assert.ok(!doFarm.includes('clinic:write'), 'não pode receber permissões de módulo alheio')
  assert.ok(!doFarm.includes('store:write'))
})

/** Duplo que regista o que seria escrito, sem base de dados. */
function fakeDb() {
  const escritas: any[] = []
  return {
    escritas,
    permission: {
      createMany: async ({ data }: { data: any[] }) => {
        escritas.push(...data)
        return { count: data.length }
      },
    },
  }
}

test('semeia SOVEREIGN, ADMIN e OPERATOR — mas OPERATOR não apaga', () => {
  const db = fakeDb()
  return seedModulePermissions(db, 't1', ['farm']).then(() => {
    const del = db.escritas.filter((l) => l.action === 'farm:delete').map((l) => l.role).sort()
    assert.deepEqual(del, ['ADMIN', 'SOVEREIGN'], 'OPERATOR não pode ter delete')

    const write = db.escritas.filter((l) => l.action === 'farm:write').map((l) => l.role).sort()
    assert.deepEqual(write, ['ADMIN', 'OPERATOR', 'SOVEREIGN'])
  })
})

test('todas as linhas semeadas pertencem ao tenant pedido', async () => {
  const db = fakeDb()
  await seedModulePermissions(db, 'tenant-x', ['farm', 'clinic'])
  assert.ok(db.escritas.length > 0)
  for (const l of db.escritas) assert.equal(l.tenantId, 'tenant-x')
})

test('cliente sem módulos não gera escrita nenhuma', async () => {
  const db = fakeDb()
  const n = await seedModulePermissions(db, 't1', [])
  assert.equal(n, 0)
  assert.equal(db.escritas.length, 0)
})
