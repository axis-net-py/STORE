// Rodar: npm test
//
// Imutabilidade do documento fiscal eletrónico.
//
// Um documento aceite pela SET não se corrige editando: corrige-se com nota de
// crédito ou evento de cancelamento. Editar o original faz os registos da
// empresa divergirem do que foi declarado — numa fiscalização, é uma
// divergência que alguém tem de explicar.
//
// Auditoria de 2026-07-30: updateInvoice não fazia esta verificação. O
// deletePurchaseInvoice fazia — a regra existia no código e não era aplicada
// ao caminho mais perigoso, que é o de alterar.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const FONTE = readFileSync('src/app/actions/invoice.ts', 'utf8')

/** Reimplementação da regra, para a testar sem carregar o Prisma. */
function ehDocumentoFiscalReal(inv: { sifenCdc?: string | null; sifenStatus?: string | null }) {
  return !!inv.sifenCdc || (!!inv.sifenStatus && inv.sifenStatus !== 'RECIBO_COMUN')
}

test('recibo comum não é documento fiscal — é venda avulsa, nunca transmitida', () => {
  assert.equal(ehDocumentoFiscalReal({ sifenStatus: 'RECIBO_COMUN', sifenCdc: null }), false)
  assert.equal(ehDocumentoFiscalReal({ sifenStatus: null, sifenCdc: null }), false)
})

test('com CDC é documento fiscal, seja qual for o estado', () => {
  assert.equal(ehDocumentoFiscalReal({ sifenCdc: '0180069560100100100100200201001001001001001001', sifenStatus: null }), true)
})

test('qualquer estado de envio conta como documento fiscal', () => {
  for (const estado of ['PENDING', 'APPROVED', 'REJECTED']) {
    assert.equal(ehDocumentoFiscalReal({ sifenStatus: estado, sifenCdc: null }), true, estado)
  }
})

// ─── Guardas presentes no código ────────────────────────────────────────────

test('updateInvoice recusa editar documento já registado na SET', () => {
  const bloco = FONTE.slice(FONTE.indexOf('export async function updateInvoice'))
  const ateTransacao = bloco.slice(0, bloco.indexOf('$transaction'))
  assert.match(
    ateTransacao,
    /assertDocumentoEditavel\(/,
    'updateInvoice tem de verificar a imutabilidade ANTES de abrir a transação'
  )
})

test('deletePurchaseInvoice mantém a mesma guarda', () => {
  const bloco = FONTE.slice(FONTE.indexOf('export async function deletePurchaseInvoice'))
  assert.match(bloco.slice(0, 2000), /ehDocumentoFiscalReal\(/)
})

test('a regra tem uma só definição', () => {
  // Duplicá-la é como as duas versões passam a divergir com o tempo.
  const definicoes = FONTE.match(/sifenStatus !== 'RECIBO_COMUN'/g) ?? []
  assert.equal(definicoes.length, 1, 'a condição só pode estar escrita num sítio')
})

test('cancelInvoice avisa que o cancelamento na SET fica por fazer', () => {
  const bloco = FONTE.slice(FONTE.indexOf('export async function cancelInvoice'))
  const ate = bloco.slice(0, bloco.indexOf('export async function deletePurchase'))
  assert.match(ate, /exigeCancelamentoNaSet/, 'quem chama tem de saber que falta cancelar na SET')
  assert.match(ate, /CANCELAMENTO_PENDENTE_SET/, 'o documento tem de ficar marcado')
})
