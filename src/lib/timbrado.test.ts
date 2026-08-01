import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  timbradoAutoriza,
  numeroTimbradoValido,
  restantesNoTimbrado,
  diasAteExpirar,
  escolherTimbrado,
  type Timbrado,
} from './timbrado.ts'

function t(over: Partial<Timbrado> = {}): Timbrado {
  return {
    numero: '12345678',
    establishment: '001',
    emissionPoint: '001',
    validFrom: new Date('2026-01-01'),
    validTo: new Date('2026-12-31'),
    rangeFrom: 1,
    rangeTo: 1000,
    isActive: true,
    ...over,
  }
}

const EM_JULHO = new Date('2026-07-15')

test('autoriza dentro da validade e do intervalo', () => {
  assert.deepEqual(timbradoAutoriza(t(), EM_JULHO, 42), { ok: true })
})

// ─── Validade ───────────────────────────────────────────────

test('recusa timbrado expirado, e diz quando expirou', () => {
  const r = timbradoAutoriza(t({ validTo: new Date('2026-06-30') }), EM_JULHO, 42)
  assert.equal(r.ok, false)
  assert.match(r.motivo, /expirou em 30\/06\/2026/)
  assert.match(r.motivo, /Solicite um novo timbrado/)
})

test('recusa emissão com data anterior ao início da validade', () => {
  const r = timbradoAutoriza(t({ validFrom: new Date('2026-08-01') }), EM_JULHO, 42)
  assert.equal(r.ok, false)
  assert.match(r.motivo, /só é válido a partir de 01\/08\/2026/)
})

test('o último dia de validade ainda autoriza', () => {
  assert.ok(timbradoAutoriza(t({ validTo: new Date('2026-07-15') }), EM_JULHO, 42).ok)
})

test('o primeiro dia de validade já autoriza', () => {
  assert.ok(timbradoAutoriza(t({ validFrom: new Date('2026-07-15') }), EM_JULHO, 42).ok)
})

test('a hora não conta, só o dia fiscal', () => {
  // 22h de 15/07 em Assunção é 01h UTC de 16/07. Comparar instantes recusaria.
  const dataTarde = new Date('2026-07-16T01:00:00Z')
  assert.ok(timbradoAutoriza(t({ validTo: new Date('2026-07-15') }), dataTarde, 42).ok)
})

test('sem data de fim, não expira', () => {
  assert.ok(timbradoAutoriza(t({ validTo: null }), new Date('2030-01-01'), 42).ok)
})

// ─── Intervalo autorizado ───────────────────────────────────

test('recusa número acima do intervalo, e diz qual é o intervalo', () => {
  const r = timbradoAutoriza(t({ rangeFrom: 1, rangeTo: 100 }), EM_JULHO, 101)
  assert.equal(r.ok, false)
  assert.match(r.motivo, /fora do intervalo autorizado/)
  assert.match(r.motivo, /1 a 100/)
})

test('recusa número abaixo do intervalo', () => {
  assert.equal(timbradoAutoriza(t({ rangeFrom: 500, rangeTo: 1000 }), EM_JULHO, 499).ok, false)
})

test('os extremos do intervalo são autorizados', () => {
  assert.ok(timbradoAutoriza(t({ rangeFrom: 5, rangeTo: 7 }), EM_JULHO, 5).ok)
  assert.ok(timbradoAutoriza(t({ rangeFrom: 5, rangeTo: 7 }), EM_JULHO, 7).ok)
})

test('recusa sequencial inválido', () => {
  assert.equal(timbradoAutoriza(t(), EM_JULHO, 0).ok, false)
  assert.equal(timbradoAutoriza(t(), EM_JULHO, -1).ok, false)
  assert.equal(timbradoAutoriza(t(), EM_JULHO, 1.5).ok, false)
})

// ─── Estado e formato ───────────────────────────────────────

test('recusa timbrado desativado', () => {
  const r = timbradoAutoriza(t({ isActive: false }), EM_JULHO, 42)
  assert.equal(r.ok, false)
  assert.match(r.motivo, /desativado/)
})

test('o número do timbrado tem 8 algarismos', () => {
  assert.ok(numeroTimbradoValido('12345678'))
  assert.ok(!numeroTimbradoValido('1234567'))
  assert.ok(!numeroTimbradoValido('123456789'))
  assert.ok(!numeroTimbradoValido('1234567a'))
  assert.ok(!numeroTimbradoValido(null))
})

// ─── Avisos antes de esgotar ────────────────────────────────

test('conta quantos documentos faltam', () => {
  assert.equal(restantesNoTimbrado(t({ rangeFrom: 1, rangeTo: 1000 }), 991), 10)
  assert.equal(restantesNoTimbrado(t({ rangeTo: 1000 }), 1001), 0)
})

test('conta os dias até expirar', () => {
  assert.equal(diasAteExpirar(t({ validTo: new Date('2026-07-25') }), EM_JULHO), 10)
  assert.equal(diasAteExpirar(t({ validTo: new Date('2026-07-10') }), EM_JULHO), -5)
  assert.equal(diasAteExpirar(t({ validTo: null }), EM_JULHO), null)
})

// ─── Escolha entre vários ───────────────────────────────────

test('usa primeiro o timbrado que expira mais cedo', () => {
  const cedo = t({ numero: '11111111', validTo: new Date('2026-08-31') })
  const tarde = t({ numero: '22222222', validTo: new Date('2026-12-31') })
  const r = escolherTimbrado([tarde, cedo], '001', '001', EM_JULHO, 42)
  assert.ok('timbrado' in r)
  assert.equal(r.timbrado.numero, '11111111')
})

test('só considera o timbrado do estabelecimento e ponto de emissão pedidos', () => {
  const outroPonto = t({ numero: '11111111', emissionPoint: '002' })
  const r = escolherTimbrado([outroPonto], '001', '001', EM_JULHO, 42)
  assert.ok('erro' in r)
  assert.match(r.erro, /ponto de emissão 001/)
})

test('sem timbrado cadastrado, diz onde cadastrar', () => {
  const r = escolherTimbrado([], '001', '001', EM_JULHO, 42)
  assert.ok('erro' in r)
  assert.match(r.erro, /Configurações › Fiscal/)
})

test('havendo só timbrados expirados, devolve o motivo e não um erro genérico', () => {
  const r = escolherTimbrado([t({ validTo: new Date('2026-01-31') })], '001', '001', EM_JULHO, 42)
  assert.ok('erro' in r)
  assert.match(r.erro, /expirou em 31\/01\/2026/)
})

test('ignora o expirado e escolhe o válido', () => {
  const expirado = t({ numero: '11111111', validTo: new Date('2026-01-31') })
  const valido = t({ numero: '22222222', validTo: new Date('2026-12-31') })
  const r = escolherTimbrado([expirado, valido], '001', '001', EM_JULHO, 42)
  assert.ok('timbrado' in r)
  assert.equal(r.timbrado.numero, '22222222')
})
