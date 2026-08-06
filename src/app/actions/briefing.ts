'use server'

import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'
import { FUSO_PARAGUAI } from '@/lib/fuso'
import {
  alertasDoDia,
  resumoSemModelo,
  chaveDoDia,
  type Alerta,
  type Factos,
} from '@/lib/briefing'

/**
 * Briefing do dia.
 *
 * Os factos são apurados aqui, na base. O modelo recebe-os já calculados e
 * limita-se a escrever a frase de abertura — nunca a contar, a somar ou a
 * datar. Um modelo que inventa "três faturas vencidas" onde há uma faz alguém
 * ligar a um cliente a cobrar o que ele já pagou.
 *
 * Se não houver chave, ou se o modelo falhar, o briefing sai na mesma: os
 * alertas valem por si e a frase de abertura tem uma versão determinista.
 */

export type Briefing = {
  /** Frase de abertura — a única parte redigida pelo modelo. */
  resumo: string
  alertas: Alerta[]
  /** Verdadeiro quando a abertura veio do modelo, falso quando é a determinista. */
  redigidoPorIA: boolean
  /** Dia a que pertence, no fuso do Paraguai. */
  dia: string
}

/**
 * Cache diária, por cliente e em memória.
 *
 * Sem isto, cada carregamento do painel pagava uma chamada ao modelo — dez
 * pessoas a abrir o dashboard de manhã eram dez chamadas para dizer o mesmo.
 * Em serverless a memória é por instância, portanto o pior caso é uma chamada
 * por instância por dia, o que é barato e aceitável. A chave inclui o dia:
 * à meia-noite de Assunção a entrada deixa de servir sozinha.
 */
const cache = new Map<string, Briefing>()

async function apurarFactos(
  tenantId: string,
  modules: string[],
  faturacaoEletronica: boolean
): Promise<Factos> {
  const agora = new Date()
  const hoje = new Date(agora.toLocaleString('en-US', { timeZone: FUSO_PARAGUAI }))
  const inicioHoje = new Date(hoje); inicioHoje.setHours(0, 0, 0, 0)
  const fimHoje = new Date(inicioHoje); fimHoje.setDate(fimHoje.getDate() + 1)
  const inicioOntem = new Date(inicioHoje); inicioOntem.setDate(inicioOntem.getDate() - 1)

  const [
    vencidas,
    hojeVencem,
    produtos,
    certificado,
    timbrado,
    vendasOntem,
    consultas,
    certificacoes,
  ] = await Promise.all([
    // Vendas aprovadas, com vencimento passado e sem pagamento registado.
    prisma.commercialInvoice.findMany({
      where: {
        tenantId, type: 'SALES', status: 'APPROVED',
        dueDate: { lt: inicioHoje },
        payments: { none: {} },
      },
      select: { totalAmount: true },
    }),
    prisma.commercialInvoice.findMany({
      where: {
        tenantId, type: 'SALES', status: 'APPROVED',
        dueDate: { gte: inicioHoje, lt: fimHoje },
        payments: { none: {} },
      },
      select: { totalAmount: true },
    }),
    // O mínimo é por produto, por isso a comparação não se faz em SQL simples.
    prisma.product.findMany({
      where: { tenantId, isActive: true, isService: false, minStock: { gt: 0 } },
      select: { name: true, currentStock: true, minStock: true },
    }),
    prisma.fiscalCredential.findFirst({
      where: { tenantId, isActive: true },
      select: { validUntil: true },
    }),
    prisma.timbrado.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { validTo: 'desc' },
      select: { validTo: true },
    }),
    prisma.commercialInvoice.aggregate({
      where: {
        tenantId, type: 'SALES', status: 'APPROVED',
        issuedAt: { gte: inicioOntem, lt: inicioHoje },
      },
      _sum: { totalAmount: true },
    }),
    modules.includes('clinic')
      ? prisma.appointment.count({
          where: {
            tenantId,
            startsAt: { gte: inicioHoje, lt: fimHoje },
            status: { in: ['AGENDADA', 'CONFIRMADA'] },
          },
        })
      : Promise.resolve(undefined),
    modules.includes('farm')
      ? prisma.certification.findMany({
          where: {
            tenantId, status: 'ACTIVE',
            expiryDate: {
              gte: inicioHoje,
              lt: new Date(inicioHoje.getTime() + 60 * 86_400_000),
            },
          },
          select: { name: true },
        })
      : Promise.resolve([] as { name: string }[]),
  ])

  const soma = (xs: { totalAmount: any }[]) =>
    xs.reduce((t, x) => t + Number(x.totalAmount), 0)

  const baixos = produtos.filter((p) => Number(p.currentStock) < Number(p.minStock))

  const dias = (d: Date | null | undefined): number | null =>
    d ? Math.ceil((d.getTime() - inicioHoje.getTime()) / 86_400_000) : null

  return {
    recebimentosVencidos: { quantidade: vencidas.length, total: soma(vencidas) },
    vencemHoje: { quantidade: hojeVencem.length, total: soma(hojeVencem) },
    estoqueAbaixoMinimo: { quantidade: baixos.length, exemplos: baixos.map((p) => p.name) },
    // Certificado e timbrado só são assunto para quem emite eletronicamente.
    // A quem opera com documentos internos, faltar um certificado não é um
    // problema por resolver — é uma decisão já tomada.
    semCertificado: faturacaoEletronica ? !certificado : false,
    diasCertificado: faturacaoEletronica ? dias(certificado?.validUntil) : null,
    diasTimbrado: faturacaoEletronica ? dias(timbrado?.validTo) : null,
    vendasOntem: Number(vendasOntem._sum.totalAmount ?? 0),
    consultasHoje: consultas,
    certificacoesAExpirar: {
      quantidade: certificacoes.length,
      exemplos: certificacoes.map((c) => c.name),
    },
  }
}

/** Pede ao modelo só a frase de abertura, a partir dos alertas já apurados. */
async function redigir(alertas: Alerta[], nomeCliente: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || alertas.length === 0) return null

  const prompt = `Você é o assistente de um sistema de gestão empresarial no Paraguai.
Abaixo estão os pontos que o sistema apurou para hoje na empresa "${nomeCliente}".

${alertas.map((a) => `- [${a.gravidade}] ${a.texto}`).join('\n')}

Escreva UMA frase curta (máximo 25 palavras) em português do Brasil, dirigida ao gestor,
dizendo por onde começar hoje. Seja concreto e direto, sem saudação e sem repetir os números
— eles já aparecem listados logo abaixo da sua frase. Não invente nada que não esteja acima.`

  try {
    const abortar = new AbortController()
    const relogio = setTimeout(() => abortar.abort(), 15_000)
    const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: abortar.signal,
      }
    ).finally(() => clearTimeout(relogio))

    if (!r.ok) {
      console.error(`Briefing: modelo respondeu ${r.status}`)
      return null
    }
    const d = await r.json()
    const texto: string | undefined = d.candidates?.[0]?.content?.parts?.[0]?.text
    return texto?.trim().replace(/^["']|["']$/g, '') || null
  } catch {
    // Silencioso de propósito: o briefing tem alternativa e não vale a pena
    // encher os registos por uma frase de abertura.
    return null
  }
}

export async function getBriefing(): Promise<Briefing> {
  const { tenantId } = await requirePermission('dashboard:read')

  const dia = chaveDoDia(new Date())
  const chave = `${tenantId}:${dia}`
  const guardado = cache.get(chave)
  if (guardado) return guardado

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, modules: true, electronicInvoicing: true },
  })

  const factos = await apurarFactos(
    tenantId,
    tenant?.modules ?? [],
    !!tenant?.electronicInvoicing
  )
  const alertas = alertasDoDia(factos)
  const redigido = await redigir(alertas, tenant?.name ?? 'a empresa')

  const briefing: Briefing = {
    resumo: redigido ?? resumoSemModelo(alertas),
    alertas,
    redigidoPorIA: !!redigido,
    dia,
  }

  // Só entra em cache o dia inteiro; entretanto as entradas de dias passados
  // deixam de ser consultadas e a instância morre com elas.
  cache.set(chave, briefing)
  return briefing
}
