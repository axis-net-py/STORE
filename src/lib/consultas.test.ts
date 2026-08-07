import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CONSULTAS,
  consultaPorNome,
  normalizarDias,
  normalizarDirecao,
  normalizarTipo,
  desdeDias,
  ateDias,
  consultaLocal,
  respostaSemModelo,
  LIMITE_LINHAS,
} from './consultas.ts'

test('cada consulta tem nome único, descrição e permissão', () => {
  const nomes = new Set<string>()
  for (const c of CONSULTAS) {
    assert.ok(!nomes.has(c.nome), `nome repetido: ${c.nome}`)
    nomes.add(c.nome)
    assert.ok(c.descricao.length > 30, `${c.nome}: descrição curta demais para o modelo escolher`)
    // Sem permissão, uma consulta seria uma porta lateral para dados que a
    // pessoa não pode abrir pelo ecrã.
    assert.match(c.permissao, /^[a-z]+:read$/, `${c.nome}: permissão inválida`)
  }
})

test('só se executa o que está no catálogo', () => {
  assert.ok(consultaPorNome('cliente'))
  assert.equal(consultaPorNome('DROP TABLE'), null)
  assert.equal(consultaPorNome('select * from User'), null)
  assert.equal(consultaPorNome(''), null)
})

test('dias fora do razoável caem no valor por omissão ou no teto', () => {
  assert.equal(normalizarDias(7, 30), 7)
  assert.equal(normalizarDias('15', 30), 15)
  assert.equal(normalizarDias(undefined, 30), 30)
  assert.equal(normalizarDias(0, 30), 30)
  assert.equal(normalizarDias(-5, 30), 30)
  assert.equal(normalizarDias('abc', 30), 30)
  // Dois anos é o teto: uma janela infinita é uma varredura à base inteira.
  assert.equal(normalizarDias(99999, 30), 730)
})

test('direção e tipo só aceitam os valores que existem', () => {
  assert.equal(normalizarDirecao('PAYABLE'), 'PAYABLE')
  assert.equal(normalizarDirecao('payable'), 'PAYABLE')
  assert.equal(normalizarDirecao('qualquer coisa'), 'RECEIVABLE')
  assert.equal(normalizarDirecao(undefined), 'RECEIVABLE')

  assert.equal(normalizarTipo('PURCHASE'), 'PURCHASE')
  assert.equal(normalizarTipo('lixo'), 'SALES')
})

test('as janelas apanham os dias inteiros nas duas pontas', () => {
  const agora = new Date('2026-08-07T15:30:00')
  const desde = desdeDias(7, agora)
  assert.equal(desde.getDate(), 31)
  assert.equal(desde.getHours(), 0)
  assert.equal(desde.getMinutes(), 0)

  const ate = ateDias(7, agora)
  assert.equal(ate.getDate(), 14)
  assert.equal(ate.getHours(), 23)
})

test('reconhece as perguntas de vencimento sem modelo', () => {
  assert.deepEqual(consultaLocal('quais contas vencem esta semana'), {
    consulta: 'vencimentos',
    params: { dias: 7, direcao: 'RECEIVABLE' },
  })
  assert.deepEqual(consultaLocal('o que tenho a pagar nos próximos 15 dias'), {
    consulta: 'vencimentos',
    params: { dias: 15, direcao: 'PAYABLE' },
  })
})

test('vencido não é o mesmo que a vencer', () => {
  const r = consultaLocal('quem está em atraso')
  assert.equal(r?.consulta, 'vencidas')
  const r2 = consultaLocal('próximos vencimentos')
  assert.equal(r2?.consulta, 'vencimentos')
})

test('reconhece a última compra de alguém', () => {
  const r = consultaLocal('quando foi a última compra do João Pereira')
  assert.equal(r?.consulta, 'faturas')
  assert.equal(r?.params.entidade, 'João Pereira')
  // A compra é do João: do lado da empresa, é uma venda. Só com "fornecedor"
  // na frase é que passa a ser uma compra nossa — e o servidor confirma pelo
  // nome antes de responder.
  assert.equal(r?.params.tipo, 'SALES')
})

test('com fornecedor na frase, aí sim é uma compra nossa', () => {
  const r = consultaLocal('última compra do fornecedor Distribuidora del Sur')
  assert.equal(r?.consulta, 'faturas')
  assert.equal(r?.params.tipo, 'PURCHASE')
})

test('reconhece rankings e estoque', () => {
  assert.equal(consultaLocal('quais os produtos mais vendidos do mês')?.consulta, 'ranking_produtos')
  assert.equal(consultaLocal('meus melhores clientes')?.consulta, 'ranking_clientes')
  assert.equal(consultaLocal('o que preciso comprar')?.consulta, 'estoque_baixo')
})

test('a janela sai da própria pergunta', () => {
  assert.equal(consultaLocal('quanto vendi hoje')?.params.dias, 1)
  assert.equal(consultaLocal('quanto vendi esta semana')?.params.dias, 7)
  assert.equal(consultaLocal('quanto vendi no mês')?.params.dias, 30)
  assert.equal(consultaLocal('resumo dos últimos 45 dias')?.params.dias, 45)
})

test('sem certeza, não se responde à pergunta errada', () => {
  assert.equal(consultaLocal('olá, tudo bem?'), null)
  assert.equal(consultaLocal('cadastre o cliente Maria'), null)
  assert.equal(consultaLocal(''), null)
})

test('sem modelo, a resposta traz os factos na mesma', () => {
  const texto = respostaSemModelo({
    consulta: 'vencimentos',
    titulo: 'Faturas a receber que vencem nos próximos 7 dias',
    linhas: [
      { cliente: 'Maria', vence: '2026-08-09', saldo: 1250000 },
      { cliente: 'João', vence: '2026-08-11', saldo: 480000 },
    ],
    totais: { 'Total em aberto': 1730000 },
  })
  assert.match(texto, /vencem nos próximos 7 dias/)
  assert.match(texto, /1\.730\.000/)
  assert.match(texto, /Maria/)
  assert.match(texto, /João/)
})

test('sem resultados, diz que não há — não inventa', () => {
  const texto = respostaSemModelo({ consulta: 'vencidas', titulo: 'Vencidas', linhas: [] })
  assert.match(texto, /Nada encontrado/)
})

test('num resumo, os totais são a resposta e não se diz que não há nada', () => {
  const texto = respostaSemModelo({
    consulta: 'resumo',
    titulo: 'Resumo dos últimos 30 dias',
    linhas: [],
    totais: { Vendas: 1499200, 'Faturas de venda': 3 },
  })
  assert.match(texto, /1\.499\.200/)
  assert.doesNotMatch(texto, /Nada encontrado/)
})

test('a lista cortada diz que foi cortada', () => {
  const texto = respostaSemModelo({
    consulta: 'faturas',
    titulo: 'Últimas faturas',
    linhas: [{ n: 1 }],
    truncado: true,
  })
  assert.match(texto, new RegExp(`${LIMITE_LINHAS}`))
})
