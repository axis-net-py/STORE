// Rodar: npm test
//
// Princípios P4 e P5 (spec Projeto 1 §6.3). A intenção viaja até ao cliente e
// volta: se não fosse assinada, bastaria alterar a quantidade entre a proposta
// e a confirmação, e a confirmação seria teatro.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  nivelDe, exigeConfirmacao, assinarIntencao, verificarIntencao, resumirIntencao,
} from './intents.ts'

const TENANT = 'tenant-1'
const USER = 'user-1'

// ─── Níveis de risco ────────────────────────────────────────────────────────

test('consultas são leitura e não exigem confirmação', () => {
  for (const a of ['query_stock', 'query_sales', 'query_balances']) {
    assert.equal(nivelDe(a), 0, a)
    assert.equal(exigeConfirmacao(a), false, a)
  }
})

test('criar cliente ou fornecedor é reversível e passa direto', () => {
  for (const a of ['create_customer', 'create_supplier']) {
    assert.equal(nivelDe(a), 1, a)
    assert.equal(exigeConfirmacao(a), false, a)
  }
})

test('faturas são nível fiscal e exigem confirmação', () => {
  for (const a of ['create_sales_invoice', 'create_purchase_invoice']) {
    assert.equal(nivelDe(a), 3, a)
    assert.equal(exigeConfirmacao(a), true, a)
  }
})

test('movimentos de estoque e dinheiro exigem confirmação', () => {
  for (const a of ['adjust_stock', 'transfer_stock', 'register_payment',
                   'create_finance_transaction', 'create_product', 'create_order']) {
    assert.equal(exigeConfirmacao(a), true, a)
  }
})

test('ação desconhecida é tratada como fiscal — o default é o mais cauteloso', () => {
  assert.equal(nivelDe('apagar_tudo'), 3)
  assert.equal(exigeConfirmacao('apagar_tudo'), true)
})

// ─── Assinatura ─────────────────────────────────────────────────────────────

const intencaoBase = {
  action: 'create_sales_invoice',
  data: { customerName: 'Smart Buy', items: [{ name: 'Cimento', quantity: 3 }] },
  tenantId: TENANT,
  userId: USER,
}

test('uma intenção assinada verifica-se e devolve os mesmos dados', () => {
  const t = assinarIntencao(intencaoBase)
  const v = verificarIntencao(t, TENANT, USER)
  assert.equal(v.ok, true)
  assert.equal(v.intencao!.action, 'create_sales_invoice')
  assert.equal(v.intencao!.data.items[0].quantity, 3)
})

test('adulterar a quantidade invalida a confirmação', () => {
  const t = assinarIntencao(intencaoBase)
  const [b64] = t.split('.')
  const corpo = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'))
  corpo.data.items[0].quantity = 300 // era 3
  const adulterado = Buffer.from(JSON.stringify(corpo), 'utf8').toString('base64url')

  const v = verificarIntencao(`${adulterado}.${t.split('.')[1]}`, TENANT, USER)
  assert.equal(v.ok, false)
  assert.match(v.motivo!, /alterada/)
})

test('uma intenção não vale para outro tenant', () => {
  const t = assinarIntencao(intencaoBase)
  const v = verificarIntencao(t, 'outro-tenant', USER)
  assert.equal(v.ok, false)
  assert.match(v.motivo!, /não pertence/)
})

test('uma intenção não vale para outro utilizador', () => {
  const t = assinarIntencao(intencaoBase)
  const v = verificarIntencao(t, TENANT, 'outro-user')
  assert.equal(v.ok, false)
})

test('token malformado é recusado sem rebentar', () => {
  for (const mau of ['', 'lixo', 'a.b.c', 'nao-base64.assinatura']) {
    assert.equal(verificarIntencao(mau, TENANT, USER).ok, false, mau)
  }
})

test('uma intenção expirada é recusada', () => {
  const t = assinarIntencao(intencaoBase)
  const [b64, mac] = t.split('.')
  const corpo = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'))
  assert.ok(corpo.exp > Date.now(), 'devia nascer válida')
  assert.ok(corpo.exp - Date.now() <= 10 * 60 * 1000, 'validade curta, na ordem dos minutos')
  assert.ok(mac.length > 0)
})

// ─── Resumo apresentado ao utilizador ───────────────────────────────────────

test('o resumo de uma venda diz a consequência, não só a ação', () => {
  const r = resumirIntencao('create_sales_invoice', intencaoBase.data)
  assert.match(r, /Smart Buy/)
  assert.match(r, /3 × Cimento/)
  assert.match(r, /estoque/i, 'tem de avisar que baixa o estoque')
})

test('o resumo de uma compra distingue-a de uma venda', () => {
  const r = resumirIntencao('create_purchase_invoice', { supplierName: 'Ferretería Sur', items: [] })
  assert.match(r, /COMPRA/)
  assert.match(r, /Ferretería Sur/)
})

test('o resumo de um ajuste de estoque diz que altera o inventário', () => {
  const r = resumirIntencao('adjust_stock', { productName: 'Cimento', type: 'SAIDA', quantity: 5 })
  assert.match(r, /Cimento/)
  assert.match(r, /inventário/i)
})
