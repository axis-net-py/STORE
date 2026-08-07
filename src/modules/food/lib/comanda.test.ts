import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  arredondar,
  totaisDaComanda,
  dividirConta,
  podeTransitar,
  estadoAoEnviar,
  podeFechar,
  filaDaCozinha,
  minutosDeEspera,
  estaAtrasado,
  distribuirDesconto,
  type LinhaComanda,
} from './comanda.ts'

const item = (
  quantidade: number,
  precoUnit: number,
  estado: LinhaComanda['estado'] = 'ENTREGUE'
): LinhaComanda => ({ quantidade, precoUnit, estado })

test('o guarani não tem cêntimos', () => {
  assert.equal(arredondar(1234.56, 'PYG'), 1235)
  assert.equal(arredondar(1234.4, 'PYG'), 1234)
  // Nas moedas com cêntimos, arredonda-se a duas casas — e o caso clássico de
  // vírgula flutuante tem de dar o valor certo.
  assert.equal(arredondar(2.675, 'USD'), 2.68)
  assert.equal(arredondar(10.005, 'BRL'), 10.01)
})

test('o total soma o consumo e ignora o que foi cancelado', () => {
  const t = totaisDaComanda([
    item(2, 25_000),
    item(1, 18_000),
    item(3, 9_000, 'CANCELADO'),
  ])
  assert.equal(t.subtotal, 68_000)
  assert.equal(t.total, 68_000)
})

test('o que ainda está na chapa já é do cliente', () => {
  const t = totaisDaComanda([item(1, 30_000, 'EM_PREPARO'), item(1, 20_000, 'PRONTO')])
  assert.equal(t.subtotal, 50_000)
})

test('o serviço incide sobre o consumo, não sobre o desconto', () => {
  // 100.000 de consumo, 10% de serviço = 10.000, menos 20.000 de desconto.
  // Se o serviço fosse calculado depois do desconto seriam 8.000, e a casa
  // estaria a descontar duas vezes a mesma cortesia.
  const t = totaisDaComanda([item(1, 100_000)], { servicoPct: 10, desconto: 20_000 })
  assert.equal(t.servico, 10_000)
  assert.equal(t.desconto, 20_000)
  assert.equal(t.total, 90_000)
})

test('o desconto não põe a conta negativa', () => {
  const t = totaisDaComanda([item(1, 10_000)], { desconto: 999_999 })
  assert.equal(t.desconto, 10_000)
  assert.equal(t.total, 0)
})

test('dividir a conta não perde nem inventa dinheiro', () => {
  const partes = dividirConta(10_001, 3)
  assert.deepEqual(partes, [3334, 3334, 3333])
  assert.equal(partes.reduce((a, b) => a + b, 0), 10_001)
})

test('a divisão bate certo para qualquer número de pessoas', () => {
  for (const total of [0, 1, 7, 99_999, 123_457]) {
    for (const pessoas of [1, 2, 3, 4, 5, 7, 12]) {
      const partes = dividirConta(total, pessoas)
      assert.equal(partes.length, pessoas)
      assert.equal(
        partes.reduce((a, b) => a + b, 0),
        total,
        `${total} por ${pessoas}`
      )
      // Ninguém paga mais do que a menor moeda acima de outro.
      assert.ok(Math.max(...partes) - Math.min(...partes) <= 1)
    }
  }
})

test('dividir em dólares mantém os cêntimos', () => {
  const partes = dividirConta(10, 3, 'USD')
  assert.deepEqual(partes, [3.34, 3.33, 3.33])
  assert.equal(arredondar(partes.reduce((a, b) => a + b, 0), 'USD'), 10)
})

test('zero pessoas não é uma divisão — é a conta toda', () => {
  assert.deepEqual(dividirConta(5_000, 0), [5_000])
})

test('o desconto reparte-se na proporção de cada linha', () => {
  // 30.000 de desconto sobre 100.000: cada linha perde 30% do que pesa.
  const partes = distribuirDesconto([60_000, 30_000, 10_000], 30_000)
  assert.deepEqual(partes, [18_000, 9_000, 3_000])
  assert.equal(partes.reduce((a, b) => a + b, 0), 30_000)
})

test('o resto do desconto não se perde nem se duplica', () => {
  for (const desconto of [1, 7, 999, 12_345]) {
    const partes = distribuirDesconto([33_333, 33_333, 33_334], desconto)
    assert.equal(
      partes.reduce((a, b) => a + b, 0),
      desconto,
      `desconto de ${desconto}`
    )
  }
})

test('um desconto maior que a conta é limitado à conta', () => {
  const partes = distribuirDesconto([10_000, 5_000], 999_999)
  assert.equal(partes.reduce((a, b) => a + b, 0), 15_000)
})

test('sem linhas ou sem desconto, ninguém desconta nada', () => {
  assert.deepEqual(distribuirDesconto([], 5_000), [])
  assert.deepEqual(distribuirDesconto([10_000], 0), [0])
  assert.deepEqual(distribuirDesconto([0, 0], 5_000), [0, 0])
})

test('o ciclo de vida do item não anda para trás', () => {
  assert.ok(podeTransitar('LANCADO', 'EM_PREPARO'))
  assert.ok(podeTransitar('EM_PREPARO', 'PRONTO'))
  assert.ok(podeTransitar('PRONTO', 'ENTREGUE'))

  assert.ok(!podeTransitar('PRONTO', 'EM_PREPARO'))
  assert.ok(!podeTransitar('ENTREGUE', 'CANCELADO'))
  assert.ok(!podeTransitar('CANCELADO', 'LANCADO'))
})

test('cancelar só é possível antes de a comida sair', () => {
  assert.ok(podeTransitar('LANCADO', 'CANCELADO'))
  assert.ok(podeTransitar('EM_PREPARO', 'CANCELADO'))
  assert.ok(!podeTransitar('PRONTO', 'CANCELADO'))
})

test('uma garrafa de água não passa pela cozinha', () => {
  assert.equal(estadoAoEnviar('SEM_PREPARO'), 'ENTREGUE')
  assert.equal(estadoAoEnviar('COZINHA'), 'EM_PREPARO')
  assert.equal(estadoAoEnviar('BAR'), 'EM_PREPARO')
})

test('não se fecha a conta com comida por entregar', () => {
  const r = podeFechar([item(1, 10_000), item(1, 20_000, 'EM_PREPARO')])
  assert.equal(r.pode, false)
  assert.match(r.motivo!, /por entregar/)
})

test('não se fecha uma comanda vazia', () => {
  assert.equal(podeFechar([]).pode, false)
  assert.equal(podeFechar([item(1, 10_000, 'CANCELADO')]).pode, false)
})

test('com tudo entregue, fecha', () => {
  assert.equal(podeFechar([item(1, 10_000), item(2, 5_000)]).pode, true)
})

const fila = [
  { id: 'novo', area: 'COZINHA' as const, estado: 'EM_PREPARO' as const, enviadoEm: new Date('2026-08-07T20:10:00Z') },
  { id: 'velho', area: 'COZINHA' as const, estado: 'EM_PREPARO' as const, enviadoEm: new Date('2026-08-07T20:00:00Z') },
  { id: 'pronto', area: 'COZINHA' as const, estado: 'PRONTO' as const, enviadoEm: new Date('2026-08-07T19:55:00Z') },
  { id: 'porEnviar', area: 'COZINHA' as const, estado: 'LANCADO' as const, enviadoEm: null },
  { id: 'bar', area: 'BAR' as const, estado: 'EM_PREPARO' as const, enviadoEm: new Date('2026-08-07T20:05:00Z') },
]

test('quem espera há mais tempo sai primeiro', () => {
  assert.deepEqual(
    filaDaCozinha(fila).map((i) => i.id),
    ['velho', 'bar', 'novo', 'pronto']
  )
})

test('o que ainda não foi enviado não está na fila', () => {
  assert.ok(!filaDaCozinha(fila).some((i) => i.id === 'porEnviar'))
})

test('cada área vê só o seu trabalho', () => {
  assert.deepEqual(
    filaDaCozinha(fila, 'BAR').map((i) => i.id),
    ['bar']
  )
})

test('a espera conta-se em minutos inteiros desde o envio', () => {
  const agora = new Date('2026-08-07T20:30:00Z')
  assert.equal(minutosDeEspera(new Date('2026-08-07T20:00:00Z'), agora), 30)
  assert.equal(minutosDeEspera(new Date('2026-08-07T20:29:30Z'), agora), 0)
  assert.equal(minutosDeEspera(null, agora), 0)
  // Relógio do servidor à frente do envio não produz espera negativa.
  assert.equal(minutosDeEspera(new Date('2026-08-07T20:31:00Z'), agora), 0)
})

test('vinte minutos é quando o ecrã muda de cor', () => {
  const agora = new Date('2026-08-07T20:30:00Z')
  assert.ok(estaAtrasado(new Date('2026-08-07T20:10:00Z'), agora))
  assert.ok(!estaAtrasado(new Date('2026-08-07T20:11:00Z'), agora))
})
