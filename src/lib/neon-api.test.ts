import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nomeDoProjeto, ligacaoDireta, criarProjeto, apagarProjeto } from './neon-api.ts'

const LIGACAO =
  'postgresql://user:senha@ep-frio-1234-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require'

function buscadorFalso(resposta: unknown, estado = 200) {
  const pedidos: { url: string; init: any }[] = []
  const fn = (async (url: any, init: any) => {
    pedidos.push({ url: String(url), init })
    return {
      ok: estado >= 200 && estado < 300,
      status: estado,
      json: async () => resposta,
      text: async () => JSON.stringify(resposta),
    } as any
  }) as typeof fetch
  return { fn, pedidos }
}

test('o nome do projeto diz de quem é sem abrir nada', () => {
  assert.equal(nomeDoProjeto('padaria-central'), 'axis-padaria-central')
})

test('a migração precisa da ligação direta, sem o pooler', () => {
  // O pooler fala PgBouncer em modo transação; `prisma migrate deploy` precisa
  // de sessões e falha com erros que não explicam nada.
  assert.equal(
    ligacaoDireta(LIGACAO),
    'postgresql://user:senha@ep-frio-1234.us-east-1.aws.neon.tech/neondb?sslmode=require'
  )
})

test('uma ligação já direta fica como está', () => {
  const direta = 'postgresql://u:s@ep-frio-1234.us-east-1.aws.neon.tech/neondb'
  assert.equal(ligacaoDireta(direta), direta)
})

test('criar um projeto devolve id e as duas ligações', async (t) => {
  process.env.NEON_API_KEY = 'napi_teste'
  const { fn, pedidos } = buscadorFalso({
    project: { id: 'proj-123' },
    connection_uris: [{ connection_uri: LIGACAO }],
  })

  const p = await criarProjeto('padaria-central', { buscador: fn })

  assert.equal(p.id, 'proj-123')
  assert.equal(p.connectionString, LIGACAO)
  assert.ok(!p.connectionStringDireta.includes('-pooler.'))

  const corpo = JSON.parse(pedidos[0].init.body)
  assert.equal(corpo.project.name, 'axis-padaria-central')
  assert.equal(corpo.project.pg_version, 17)
  assert.match(pedidos[0].init.headers.Authorization, /^Bearer napi_/)
})

test('sem chave não se tenta sequer o pedido', async () => {
  delete process.env.NEON_API_KEY
  const { fn, pedidos } = buscadorFalso({})
  await assert.rejects(() => criarProjeto('x', { buscador: fn }), /NEON_API_KEY/)
  assert.equal(pedidos.length, 0, 'não devia ter chegado a chamar a API')
})

test('um erro da API não passa em silêncio', async () => {
  process.env.NEON_API_KEY = 'napi_teste'
  const { fn } = buscadorFalso({ message: 'quota de projetos excedida' }, 422)
  await assert.rejects(
    () => criarProjeto("x", { buscador: fn }),
    (e: Error) => /422/.test(e.message) && /quota/.test(e.message)
  )
})

test('um projeto sem string de ligação é um projeto inútil', async () => {
  process.env.NEON_API_KEY = 'napi_teste'
  const { fn } = buscadorFalso({ project: { id: 'proj-123' }, connection_uris: [] })
  await assert.rejects(() => criarProjeto('x', { buscador: fn }), /não devolveu a string/)
})

test('apagar um projeto que já não existe não é um erro', async () => {
  process.env.NEON_API_KEY = 'napi_teste'
  const { fn } = buscadorFalso({}, 404)
  // Só é chamado para desfazer um provisionamento falhado. Se o projeto já lá
  // não está, o objetivo está cumprido — rebentar aqui só esconderia a falha
  // original que levou ao rollback.
  await assert.doesNotReject(() => apagarProjeto('proj-123', { buscador: fn }))
})

test('apagar com falha real avisa', async () => {
  process.env.NEON_API_KEY = 'napi_teste'
  const { fn } = buscadorFalso({}, 403)
  await assert.rejects(() => apagarProjeto('proj-123', { buscador: fn }), /403/)
})
