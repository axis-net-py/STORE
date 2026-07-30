// Rodar: npm test
//
// Guarda estrutural contra referências cruzadas entre clientes.
//
// Um identificador que vem do formulário é input do utilizador: nada impede
// que seja o de outra empresa. Em 2026-07-30 uma auditoria encontrou 12 chaves
// estrangeiras gravadas sem verificação — incluindo o cliente de uma fatura de
// VENDA, o que permitia emitir um documento fiscal apontando a um cliente de
// outra empresa e, ao abri-lo, ler-lhe o nome e o RUC.
//
// Este teste lê o código e recusa que o padrão volte.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = 'src'

/**
 * Campos que TERMINAM em "Id" mas não são chaves estrangeiras.
 * Cada exceção precisa de justificação — a lista não é para crescer sozinha.
 */
const NAO_SAO_CHAVES = new Set([
  // Transaction.entityId é texto livre no schema (nome da contraparte avulsa),
  // não uma relação. Não há tabela onde o verificar.
  'entityId',
])

/** Formas de verificação aceites. */
const VERIFICADORES = [
  'assertRefDoTenant',
  'assertRefsDoTenant',
  'assertContraparteDoTenant',
]

function ficheiros(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...ficheiros(p))
    else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p)
  }
  return out
}

function funcoesExportadas(texto: string) {
  const linhas = texto.split(/\r?\n/)
  const blocos: Array<{ nome: string; corpo: string }> = []
  let nome: string | null = null
  let corpo: string[] = []
  for (const l of linhas) {
    const m = l.match(/^export async function (\w+)/)
    if (m) {
      if (nome) blocos.push({ nome, corpo: corpo.join('\n') })
      nome = m[1]
      corpo = []
    }
    if (nome) corpo.push(l)
  }
  if (nome) blocos.push({ nome, corpo: corpo.join('\n') })
  return blocos
}

test('nenhuma chave estrangeira do input é gravada sem verificar o cliente', () => {
  const problemas: string[] = []

  for (const f of ficheiros(RAIZ)) {
    const texto = readFileSync(f, 'utf8')
    if (!/prisma\.|tx\./.test(texto)) continue

    for (const { nome, corpo } of funcoesExportadas(texto)) {
      const campos = new Set<string>()
      for (const m of corpo.matchAll(/(\w+Id)\s*:\s*(?:parsed\.)?data\.(\w+Id)/g)) campos.add(m[2])
      campos.delete('tenantId')

      for (const campo of campos) {
        if (NAO_SAO_CHAVES.has(campo)) continue

        const escrita = corpo.search(new RegExp(`\\w+Id\\s*:\\s*(?:parsed\\.)?data\\.${campo}`))

        // Verificação inline: findFirst({ where: { id: data.X, tenantId } })
        const inline = corpo.search(
          new RegExp(
            `(id:\\s*(?:parsed\\.)?data\\.${campo}\\s*,\\s*tenantId|tenantId\\s*,\\s*id:\\s*(?:parsed\\.)?data\\.${campo})`
          )
        )
        // Verificação pelo helper partilhado
        const helper = VERIFICADORES.map((v) =>
          corpo.search(new RegExp(`${v}\\([^)]*data\\.${campo}`))
        ).filter((i) => i >= 0)

        const posicoes = [inline, ...helper].filter((i) => i >= 0)
        const maisCedo = posicoes.length ? Math.min(...posicoes) : -1

        if (maisCedo === -1) {
          problemas.push(`${f} → ${nome}(): "${campo}" gravado sem verificação`)
        } else if (maisCedo > escrita) {
          problemas.push(
            `${f} → ${nome}(): "${campo}" verificado DEPOIS de ser gravado — não impede nada`
          )
        }
      }
    }
  }

  assert.deepEqual(
    problemas,
    [],
    `Referências cruzadas possíveis entre clientes:\n  ${problemas.join('\n  ')}`
  )
})

test('a lista de exceções não cresceu sem justificação', () => {
  // Cada entrada aqui é uma decisão consciente. Se esta contagem subir, alguém
  // silenciou um aviso em vez de o corrigir.
  assert.equal(NAO_SAO_CHAVES.size, 1)
})
