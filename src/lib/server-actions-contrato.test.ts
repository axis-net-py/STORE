import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Contrato dos módulos 'use server'.
 *
 * No Next.js, TODOS os exports de um ficheiro 'use server' viram endpoints
 * HTTP públicos — não só os que a interface chama. Duas consequências:
 *
 *  1. Um export que recebe `tenantId` por parâmetro deixa o CLIENTE escolher
 *     de que empresa são os dados. Na auditoria de 2026-07-30 isto expôs o
 *     certificado digital de qualquer empresa (getCertificadoAtivo), a
 *     transmissão de faturas alheias à SET (submitInvoiceToSifen) e a
 *     numeração fiscal (getNextSalesInvoiceNumber). O tenant vem da sessão.
 *
 *  2. O Next.js exige que todos os exports sejam funções assíncronas. Um
 *     predicado síncrono exportado faz o build falhar — já aconteceu, e só
 *     dá erro no `next build`, não no `tsc`.
 *
 * Este teste falha em segundos; o build demora minutos e a fuga de dados
 * não falha em lado nenhum.
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

function ficheirosTs(dir: string): string[] {
  const saida: string[] = []
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) {
      saida.push(...ficheirosTs(caminho))
    } else if (/\.tsx?$/.test(nome) && !nome.endsWith('.test.ts')) {
      saida.push(caminho)
    }
  }
  return saida
}

function ehUseServer(fonte: string): boolean {
  // A diretiva tem de ser a primeira instrução do ficheiro.
  const m = fonte.match(/^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use server['"]/)
  return m !== null
}

/** Extrai o texto entre os parênteses da assinatura, a partir do índice do '('. */
function listaDeParametros(fonte: string, iAbre: number): string {
  let nivel = 0
  for (let i = iAbre; i < fonte.length; i++) {
    const c = fonte[i]
    if (c === '(') nivel++
    else if (c === ')') {
      nivel--
      if (nivel === 0) return fonte.slice(iAbre + 1, i)
    }
  }
  return ''
}

function nomesDeParametros(lista: string): string[] {
  const nomes: string[] = []
  let nivel = 0
  let atual = ''
  for (const c of lista) {
    if ('([{<'.includes(c)) nivel++
    else if (')]}>'.includes(c)) nivel--
    if (c === ',' && nivel === 0) {
      nomes.push(atual)
      atual = ''
    } else {
      atual += c
    }
  }
  nomes.push(atual)

  return nomes
    .map((p) => p.trim().split(/[:=?]/)[0].trim())
    .filter((p) => p.length > 0)
}

type Export = { ficheiro: string; nome: string; assinaturaAsync: boolean; params: string[] }

function exportsDe(caminho: string, fonte: string): Export[] {
  const achados: Export[] = []
  const rx = /^export\s+(async\s+)?function\s+(\w+)\s*(?:<[^(]*>)?\s*\(/gm
  let m: RegExpExecArray | null
  while ((m = rx.exec(fonte)) !== null) {
    const iAbre = fonte.indexOf('(', m.index + m[0].length - 1)
    achados.push({
      ficheiro: relative(RAIZ, caminho).replace(/\\/g, '/'),
      nome: m[2],
      assinaturaAsync: !!m[1],
      params: nomesDeParametros(listaDeParametros(fonte, iAbre)),
    })
  }
  return achados
}

const modulosUseServer = ficheirosTs(RAIZ)
  .map((c) => [c, readFileSync(c, 'utf8')] as const)
  .filter(([, fonte]) => ehUseServer(fonte))

test('existem módulos "use server" para verificar', () => {
  // Se um refactor mudar a estrutura de pastas, este teste deixaria de olhar
  // para nada e continuaria a passar. Melhor falhar.
  assert.ok(modulosUseServer.length > 0, 'nenhum ficheiro "use server" encontrado')
})

test('nenhuma server action recebe tenantId do cliente', () => {
  const infratores: string[] = []

  for (const [caminho, fonte] of modulosUseServer) {
    for (const e of exportsDe(caminho, fonte)) {
      // `_tenantId` é o acordo: o parâmetro fica na assinatura porque a
      // interface o passa, mas o corpo ignora-o e usa o da sessão.
      if (e.params.includes('tenantId')) {
        infratores.push(
          `${e.ficheiro}: ${e.nome}(tenantId, …) — usar requirePermission() e renomear para _tenantId`
        )
      }
    }
  }

  assert.deepEqual(infratores, [])
})

test('todo export de um módulo "use server" é uma função async', () => {
  const infratores: string[] = []

  for (const [caminho, fonte] of modulosUseServer) {
    for (const e of exportsDe(caminho, fonte)) {
      if (!e.assinaturaAsync) {
        infratores.push(`${e.ficheiro}: ${e.nome} não é async — o next build falha`)
      }
    }
  }

  assert.deepEqual(infratores, [])
})

test('módulos "use server" não exportam constantes nem tipos de valor', () => {
  // `export const X = …` num ficheiro de server actions também rebenta o
  // build. `export type` e `export interface` desaparecem na compilação e
  // são inofensivos.
  const infratores: string[] = []

  for (const [caminho, fonte] of modulosUseServer) {
    const rx = /^export\s+(?:const|let|var|class|enum)\s+(\w+)/gm
    let m: RegExpExecArray | null
    while ((m = rx.exec(fonte)) !== null) {
      infratores.push(`${relative(RAIZ, caminho).replace(/\\/g, '/')}: export ${m[1]}`)
    }
  }

  assert.deepEqual(infratores, [])
})
