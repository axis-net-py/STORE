// Rodar: npm test
//
// Princípio P1 (spec Projeto 1 §6.3): a IA não tem caminho de escrita próprio.
// Toda a escrita passa pelas mesmas server actions que um humano usa, herdando
// validação, verificação de permissão, regras de negócio e auditoria.
//
// Este teste é uma guarda estrutural, não de comportamento: lê o ficheiro e
// recusa qualquer prisma.*.create/update/delete na camada de IA. Existe porque
// foi exatamente por aí que, em 2026-07-25, o assistente emitiu uma fatura de
// 10 unidades de um produto que nunca existiu.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const FICHEIRO = 'src/app/api/ai/route.ts'
const ESCRITA = /prisma\.(\w+)\.(create|update|delete|createMany|updateMany|deleteMany|upsert)\s*\(/g

/**
 * Exceção declarada: `auditLog`.
 *
 * O registo de auditoria não é dado de negócio — é o registo de que a operação
 * aconteceu. Não tem regra de negócio a herdar de uma server action, e passá-lo
 * por uma só acrescentaria indireção. A exceção fica aqui, explícita e visível,
 * em vez de diluída no código.
 */
const PERMITIDOS = new Set(['auditLog'])

test('a camada de IA não escreve dados de negócio diretamente', () => {
  const codigo = readFileSync(FICHEIRO, 'utf8')
  const encontradas = [...codigo.matchAll(ESCRITA)].filter((m) => !PERMITIDOS.has(m[1]))

  const detalhe = encontradas.map((m) => {
    const linha = codigo.slice(0, m.index).split('\n').length
    return `  linha ${linha}: ${m[0]}`
  })

  assert.equal(
    encontradas.length,
    0,
    `Escrita direta na camada de IA — use a server action correspondente:\n${detalhe.join('\n')}`
  )
})

test('a camada de IA importa as server actions de escrita', () => {
  const codigo = readFileSync(FICHEIRO, 'utf8')
  for (const acao of [
    'createCustomer', 'createSupplier', 'createProduct',
    'createSalesInvoice', 'createPurchaseInvoice', 'createFinanceTransaction',
  ]) {
    assert.ok(codigo.includes(acao), `esperava a rota usar ${acao}`)
  }
})

test('a camada de IA regista auditoria das ações que executa', () => {
  const codigo = readFileSync(FICHEIRO, 'utf8')
  assert.ok(codigo.includes('prisma.auditLog.create'), 'esperava registo de auditoria')
  assert.ok(codigo.includes('confirmadoPeloUtilizador'), 'a auditoria tem de registar se houve confirmação')
  assert.ok(codigo.includes('comando'), 'a auditoria tem de guardar o comando original')
})

test('leituras diretas continuam permitidas', () => {
  // findFirst/findMany não alteram estado: a restrição é sobre escrita.
  const codigo = readFileSync(FICHEIRO, 'utf8')
  assert.ok(
    /prisma\.\w+\.(findFirst|findMany|count)\s*\(/.test(codigo),
    'a rota deve continuar a poder consultar dados'
  )
})
