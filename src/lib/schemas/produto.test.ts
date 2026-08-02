import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ProductSchema } from './index.ts'

/**
 * Os parâmetros de uma server action chegam por HTTP. O tipo do TypeScript
 * desaparece na compilação e não protege nada em tempo de execução — quem
 * chamar o endpoint diretamente manda o que quiser.
 *
 * createProduct e updateProduct não validavam nada: existia um ProductSchema
 * e nunca era usado. Auditoria de 2026-07-30.
 */

const base = { sku: 'CIM-50', name: 'Cimento 50kg', price: 55000, cost: 40000 }

test('aceita um produto válido e aplica os valores por omissão', () => {
  const r = ProductSchema.parse(base)
  assert.equal(r.unit, 'un')
  assert.equal(r.currency, 'PYG')
  assert.equal(r.taxType, 'IVA_10')
  assert.equal(r.isActive, true)
  assert.equal(r.isService, false)
  assert.equal(r.currentStock, 0)
})

test('preço negativo é recusado', () => {
  // Um preço negativo distorce todas as faturas que usem o produto, e o razão
  // que delas resulta.
  const r = ProductSchema.safeParse({ ...base, price: -100 })
  assert.equal(r.success, false)
  assert.match(r.error!.issues[0].message, /negativo/)
})

test('custo negativo é recusado', () => {
  assert.equal(ProductSchema.safeParse({ ...base, cost: -1 }).success, false)
})

test('preço em texto é convertido para número', () => {
  // O formulário manda string; o resto do código conta com número.
  const r = ProductSchema.parse({ ...base, price: '55000', cost: '40000' })
  assert.equal(r.price, 55000)
  assert.equal(r.cost, 40000)
})

test('SKU vazio é recusado', () => {
  assert.equal(ProductSchema.safeParse({ ...base, sku: '' }).success, false)
})

test('nome demasiado curto é recusado', () => {
  assert.equal(ProductSchema.safeParse({ ...base, name: 'X' }).success, false)
})

test('regime de imposto fora dos três válidos é recusado', () => {
  // Chega por HTTP: nada impede alguém de mandar "IVA_0".
  assert.equal(ProductSchema.safeParse({ ...base, taxType: 'IVA_0' }).success, false)
})

test('moeda fora das três válidas é recusada', () => {
  assert.equal(ProductSchema.safeParse({ ...base, currency: 'EUR' }).success, false)
})

test('estoque mínimo negativo é recusado', () => {
  assert.equal(ProductSchema.safeParse({ ...base, minStock: -5 }).success, false)
})

test('na edição parcial, as mesmas regras valem para o que veio', () => {
  const parcial = ProductSchema.partial()
  assert.equal(parcial.safeParse({ price: -1 }).success, false)
  assert.equal(parcial.safeParse({ name: 'Cimento 25kg' }).success, true)
  // E não exige os campos que não vieram.
  assert.equal(parcial.safeParse({}).success, true)
})
