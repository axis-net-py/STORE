# Conselheiro AXIS — Fase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **REQUIRED for every AI-SDK task (6, 7):** invoke the `vercel:ai-sdk` skill and confirm exact `ai` / `@ai-sdk/anthropic` / `@ai-sdk/react` symbols against the freshly installed `node_modules/ai/docs/` and `node_modules/@ai-sdk/anthropic/docs/`. Memorized AI SDK API is unreliable — the reference code below shows the **architecture and intent**; verify symbol names (`streamText`, `convertToModelMessages`, `toUIMessageStreamResponse`, `stopWhen`/`stepCountIs`, the web-search tool helper, and `useChat`) before trusting them.

**Goal:** Replace Cooper's floating Gemini command-bot with a Claude advisor that answers business questions as a "mesa redonda" of mentors (first-person voices + Síntese do Arquiteto), uses Anthropic `web_search`, streams its answer, and persists conversation history in Postgres — all behind the existing NextAuth multi-tenant guard.

**Architecture:** A Next.js App Router route (`/api/advisor`) runs a Claude agent via the Vercel AI SDK with the direct `@ai-sdk/anthropic` provider; the system prompt encodes the ~60-mentor roster and roundtable rules (no RAG); `web_search` is the only tool in Fase A (ERP action tools come in Fase B). A new client component (`<Conselheiro>`) consumes the stream with `useChat` and replaces `<AIAssistant>` in the dashboard layout. Threads/messages persist via Prisma models scoped by `tenantId`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 6.19 (Postgres), NextAuth v4 (JWT), Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/react`), Claude `claude-sonnet-4-6`.

**Verification approach (project-specific, not TDD):** Cooper has no test runner; the established gate is `npx prisma generate && npx tsc --noEmit` plus observable in-app checks and Vercel deploys. Each task ends with a typecheck and/or a concrete manual check, then a commit. Do **not** add a test framework.

**Branch:** `feat/conselheiro` (already created; design spec committed there).

**Out of scope for Fase A:** ERP action tool-use (Fase B), thread sidebar / rename / multi-thread switching / Opus "deep" toggle (Fase C), Old Money visual polish (Fase D), migrating the Gemini invoice importer (stays on `/api/ai`).

---

## File Structure

**Create:**
- `src/lib/advisor/mentors.ts` — the ~60-mentor roster as structured data (name + domain + terse signature). Single source of truth for the cast.
- `src/lib/advisor/system-prompt.ts` — `buildSystemPrompt()` composing persona + roundtable rules + output format + the mentor index (from `mentors.ts`) + language/ERP context.
- `src/lib/advisor/model.ts` — provider/model config (`advisorModel(deep?)`).
- `src/app/actions/advisor.ts` — `'use server'` persistence: `createThread`, `appendMessage`, `getLatestThread`, `listThreads`. Follows Cooper action conventions.
- `src/app/api/advisor/route.ts` — the streaming agent route (auth guard + `streamText` + `web_search` + persist on finish).
- `src/components/Conselheiro/Conselheiro.tsx` — new floating assistant client component (`useChat` → `/api/advisor`, streamed render, voice input retained).

**Modify:**
- `package.json` — add `ai`, `@ai-sdk/anthropic`, `@ai-sdk/react` (via install).
- `prisma/schema.prisma` — add `AdvisorThread` + `AdvisorMessage` models and the `Tenant.advisorThreads` relation.
- `.env.example` — add `ANTHROPIC_API_KEY`.
- `src/app/(dashboard)/[tenantId]/layout.tsx` — swap `<AIAssistant>` → `<Conselheiro>`.

`src/components/AIAssistant.tsx` is left in place (unused after the swap) — Fase B may reuse parts; removing it is not in scope.

---

## Task 1: Install AI SDK packages

**Files:**
- Modify: `package.json` (+ lockfile)

- [ ] **Step 1: Install**

Use the repo's package manager (npm here; if a `pnpm-lock.yaml` exists, use `pnpm` instead):

```bash
cd "C:/Users/User/Documents/AXIS/COOPER-repo"
npm install ai @ai-sdk/anthropic @ai-sdk/react
```

- [ ] **Step 2: Verify install + read current docs**

Run: `ls node_modules/ai/docs/ node_modules/@ai-sdk/anthropic/docs/`
Expected: doc folders exist. Invoke the `vercel:ai-sdk` skill and skim these docs for `streamText`, tools, multi-step (`stopWhen`/`stepCountIs`), the Anthropic web-search tool, and `useChat`. This is the source of truth for Tasks 6–7.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(conselheiro): add Vercel AI SDK + Anthropic provider"
```

---

## Task 2: Env — add ANTHROPIC_API_KEY

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add the key to `.env.example`**

Append under the existing Gemini block:

```bash
# Anthropic Claude (Conselheiro AXIS advisor — needs web_search enabled on the account)
ANTHROPIC_API_KEY="your-anthropic-api-key"
```

- [ ] **Step 2: Add the real key locally and on Vercel (manual, by Allan)**

Add `ANTHROPIC_API_KEY=...` to the local `.env` and to the Vercel project env (Production + Preview). The `@ai-sdk/anthropic` provider reads `ANTHROPIC_API_KEY` automatically.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore(conselheiro): document ANTHROPIC_API_KEY env var"
```

---

## Task 3: Prisma models for thread/message persistence

**Files:**
- Modify: `prisma/schema.prisma` (Tenant model + two new models)

- [ ] **Step 1: Add the relation field to `model Tenant`**

Inside `model Tenant { ... }`, add after the `auditLogs AuditLog[]` line:

```prisma
  advisorThreads    AdvisorThread[]
```

- [ ] **Step 2: Add the two models at the end of the schema**

```prisma
// ─── Conselheiro AXIS (advisor) ─────────────────────────────

model AdvisorThread {
  id        String           @id @default(cuid())
  tenantId  String
  tenant    Tenant           @relation(fields: [tenantId], references: [id])
  userId    String?
  title     String           @default("Nova consulta")
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt
  messages  AdvisorMessage[]

  @@index([tenantId])
}

model AdvisorMessage {
  id        String        @id @default(cuid())
  threadId  String
  thread    AdvisorThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  role      String        // "user" | "assistant"
  content   String        @db.Text
  mentors   String[]      @default([])
  sources   Json?
  createdAt DateTime      @default(now())

  @@index([threadId])
}
```

- [ ] **Step 3: Generate client + create migration**

```bash
npx prisma generate
npx prisma migrate dev --name advisor_threads
```
Expected: migration created and applied; `prisma generate` succeeds. (If the dev DB is the shared Neon/Supabase instance and `migrate dev` is unsafe, use `npx prisma db push` instead and note it.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (new `AdvisorThread`/`AdvisorMessage` types resolve).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(conselheiro): add AdvisorThread/AdvisorMessage models"
```

---

## Task 4: Mentor roster data

**Files:**
- Create: `src/lib/advisor/mentors.ts`

- [ ] **Step 1: Write the roster**

The roster is the cast the agent picks from. Well-known figures need only `name` + `domain` (Claude renders their voice); niche/Brazilian figures get a terse `signature` to anchor fidelity. This is the complete file — no figure is a placeholder.

```ts
export interface Mentor {
  name: string
  /** Domain grouping, shown to the model to aid selection. */
  domain: string
  /** Terse essence/frameworks. Required for niche figures; optional for globally famous ones. */
  signature?: string
}

export const MENTOR_ROSTER: Mentor[] = [
  // Filosofia, estoicismo & mente soberana
  { name: "Marcus Aurelius", domain: "Filosofia/estoicismo" },
  { name: "Sêneca", domain: "Filosofia/estoicismo" },
  { name: "Ryan Holiday", domain: "Estoicismo aplicado", signature: "obstáculo é o caminho; ego é o inimigo" },
  { name: "Jordan Peterson", domain: "Responsabilidade/sentido", signature: "ordem vs caos, responsabilidade individual" },
  { name: "Eckhart Tolle", domain: "Presença/consciência", signature: "o poder do agora, dissolver o ego" },

  // Estratégia, poder & competição
  { name: "Robert Greene", domain: "Poder/estratégia", signature: "48 leis do poder, natureza humana, timing" },
  { name: "Sun Tzu", domain: "Estratégia/guerra", signature: "vencer sem lutar, terreno, engano" },
  { name: "Naval Ravikant", domain: "Riqueza/alavancagem", signature: "leverage (código/mídia), specific knowledge" },

  // Gestão & arquitetura de negócios
  { name: "Peter Drucker", domain: "Gestão", signature: "eficácia, o cliente define o negócio" },
  { name: "Jim Collins", domain: "Empresas duradouras", signature: "Good to Great, flywheel, Level 5 leadership" },
  { name: "Jack Welch", domain: "Gestão/performance", signature: "candor, diferenciação, nº 1 ou 2 no mercado" },
  { name: "Ram Charan", domain: "Execução", signature: "execution discipline, know-how operacional" },
  { name: "John Doerr", domain: "Metas/OKRs", signature: "Measure What Matters, OKRs" },
  { name: "Stephen Covey", domain: "Eficácia pessoal", signature: "7 hábitos, win-win, comece pelo fim" },

  // Capital, investimento & longevidade
  { name: "Warren Buffett", domain: "Investimento", signature: "value investing, moat, círculo de competência" },
  { name: "Ray Dalio", domain: "Princípios/macro", signature: "principles, radical transparency, ciclos" },
  { name: "Jorge Paulo Lemann", domain: "Capital/escala (BR)", signature: "3G, meritocracia, dono, custo-zero-base" },
  { name: "Luiz Barsi", domain: "Dividendos (BR)", signature: "carteira de dividendos, longo prazo, renda" },
  { name: "Morgan Housel", domain: "Psicologia do dinheiro", signature: "comportamento > planilha, margem de segurança" },

  // Fundadores & inovação radical
  { name: "Jeff Bezos", domain: "Escala/cliente", signature: "obsessão pelo cliente, Day 1, decisões tipo-1/2" },
  { name: "Elon Musk", domain: "Primeiros princípios", signature: "first principles, deletar etapas, urgência" },
  { name: "Steve Jobs", domain: "Produto/visão", signature: "foco, simplicidade, intersecção arte+tech" },
  { name: "Alex Hormozi", domain: "Ofertas/escala", signature: "grand slam offer, value equation, LTV/CAC" },

  // Empreendedores brasileiros & resiliência
  { name: "Flávio Augusto da Silva", domain: "Negócios (BR)", signature: "geração de valor, mentalidade de dono" },
  { name: "Abílio Diniz", domain: "Varejo (BR)", signature: "disciplina, foco no cliente, longevidade" },
  { name: "Geraldo Rufino", domain: "Resiliência (BR)", signature: "JR Diesel, do lixo ao milhão, reinvenção" },
  { name: "Tallis Gomes", domain: "Startups (BR)", signature: "Easy Taxi/Singu, 'Nada Easy', execução enxuta" },
  { name: "Pablo Marçal", domain: "Mentalidade/vendas (BR)", signature: "alta intensidade, propósito, ação massiva" },
  { name: "Giovanni Begossi", domain: "Empreendedorismo (BR)", signature: "pesquisar persona via web (figura de nicho)" },
  { name: "Alfredo Soares", domain: "E-commerce/vendas (BR)", signature: "G4, 'Bora Vender', varejo digital" },
  { name: "Felipe Alves", domain: "Criador/negócios (BR)", signature: "pesquisar @fealvessn / YouTube FeAlvesSN para persona" },

  // Vendas & negociação
  { name: "Robert Cialdini", domain: "Persuasão", signature: "6 princípios: reciprocidade, escassez, prova social…" },
  { name: "Neil Rackham", domain: "Vendas consultivas", signature: "SPIN Selling (Situação/Problema/Implicação/Necessidade)" },
  { name: "Jeffrey Gitomer", domain: "Vendas", signature: "Sales Bible, valor antes do preço" },
  { name: "Brian Tracy", domain: "Vendas/metas", signature: "psicologia da venda, 'Eat That Frog'" },
  { name: "Aaron Ross & Marylou Tyler", domain: "Vendas outbound/B2B", signature: "Predictable Revenue, especialização do time, cold 2.0" },
  { name: "OG Mandino", domain: "Vendas/inspiração", signature: "O Maior Vendedor do Mundo, hábitos e pergaminhos" },
  { name: "Chris Voss", domain: "Negociação", signature: "Never Split the Difference, empatia tática, espelhamento" },
  { name: "Rodrigo Noll", domain: "Marketing de indicação (BR)", signature: "máquina de indicações, referral systematizado" },

  // Marketing, autoridade & comunicação
  { name: "Simon Sinek", domain: "Propósito/liderança", signature: "Start With Why, golden circle" },
  { name: "Seth Godin", domain: "Marketing", signature: "Purple Cow, permission marketing, tribo, remarkable" },
  { name: "John C. Maxwell", domain: "Liderança", signature: "21 leis da liderança, influência" },
  { name: "Dale Carnegie", domain: "Relações/influência", signature: "Como Fazer Amigos e Influenciar Pessoas" },
  { name: "Robin Sharma", domain: "Liderança/maestria", signature: "5 AM Club, lidere sem títulos" },
  { name: "Nicholas Boothman", domain: "Conexão/rapport", signature: "rapport em 90 segundos, linguagem corporal" },
  { name: "Brené Brown", domain: "Vulnerabilidade/liderança", signature: "coragem, vulnerabilidade, 'Daring Greatly'" },

  // Alta performance, hábitos & coaching
  { name: "Tony Robbins", domain: "Peak performance", signature: "estados emocionais, alavancas de decisão, ação massiva" },
  { name: "Tim Ferriss", domain: "Otimização/experimentos", signature: "80/20, deconstruir habilidades, '4-Hour' frameworks" },
  { name: "Tim Gallwey", domain: "Inner game", signature: "Inner Game, Self 1 vs Self 2, foco relaxado" },
  { name: "Brendon Burchard", domain: "Alta performance", signature: "High Performance Habits, clareza/energia/coragem" },
  { name: "Charles Duhigg", domain: "Hábitos/produtividade", signature: "loop do hábito (deixa-rotina-recompensa)" },
  { name: "David Goggins", domain: "Resiliência mental", signature: "callous the mind, 40% rule, accountability brutal" },

  // Mentalidade, manifestação & metafísica
  { name: "Napoleon Hill", domain: "Realização", signature: "Quem Pensa Enriquece, propósito definido, mastermind" },
  { name: "Bob Proctor", domain: "Mentalidade/riqueza", signature: "paradigmas, imagem mental, lei da atração" },
  { name: "Joseph Murphy", domain: "Mente subconsciente", signature: "O Poder do Subconsciente, autossugestão" },
  { name: "Neville Goddard", domain: "Imaginação criativa", signature: "assuma o estado desejado, 'living in the end'" },
  { name: "Vadim Zeland", domain: "Transurfing", signature: "Transurfing, intenção vs desejo, gestão de realidade" },
  { name: "Joe Dispenza", domain: "Neurociência/mente", signature: "quebrar o hábito de ser você mesmo, estados elevados" },
  { name: "T. Harv Eker", domain: "Mentalidade de riqueza", signature: "Os Segredos da Mente Milionária, blueprint financeiro" },
  { name: "Paulo Vieira", domain: "Coaching (BR)", signature: "O Poder da Ação, Febracis, ressignificação" },
]
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/advisor/mentors.ts
git commit -m "feat(conselheiro): add 60-mentor roster data"
```

---

## Task 5: System prompt + model config

**Files:**
- Create: `src/lib/advisor/system-prompt.ts`
- Create: `src/lib/advisor/model.ts`

- [ ] **Step 1: Write `model.ts`**

```ts
import { anthropic } from '@ai-sdk/anthropic'

// Direct Anthropic provider — chosen for guaranteed web_search server-tool support.
// IDs confirmed live 2026-06-23 (gateway lists claude-sonnet-4.6 / claude-opus-4.8).
export const MODEL_DEFAULT = 'claude-sonnet-4-6'
export const MODEL_DEEP = 'claude-opus-4-8' // used by the Fase C "análise profunda" toggle

export function advisorModel(deep = false) {
  return anthropic(deep ? MODEL_DEEP : MODEL_DEFAULT)
}
```
Verify `anthropic(modelId)` call shape against `node_modules/@ai-sdk/anthropic/docs/`.

- [ ] **Step 2: Write `system-prompt.ts`**

```ts
import { MENTOR_ROSTER } from './mentors'

function mentorIndex(): string {
  const byDomain = new Map<string, string[]>()
  for (const m of MENTOR_ROSTER) {
    const label = m.signature ? `${m.name} — ${m.signature}` : m.name
    byDomain.set(m.domain, [...(byDomain.get(m.domain) ?? []), label])
  }
  return [...byDomain.entries()]
    .map(([domain, names]) => `• ${domain}: ${names.join('; ')}`)
    .join('\n')
}

export function buildSystemPrompt(): string {
  return `Você é o CONSELHEIRO AXIS — uma mesa redonda das maiores mentes de negócios, estratégia, filosofia, vendas e alta performance, a serviço de Allan (AXIS Soluciones Digitales) dentro do ERP comercial COOPER.

CONTEXTO: ERP para varejo/comércio no Paraguai e América Latina (moedas PYG/USD/BRL, RUC, fisco SIFEN). Idioma: Português (Brasil), salvo pedido contrário.

COMO RESPONDER:
1. Para PERGUNTAS ESTRATÉGICAS / pedidos de conselho (pricing, escala, vendas, marca, resiliência, decisão), monte uma MESA REDONDA:
   - Escolha os 2–4 mentores MAIS pertinentes ao problema específico (não use todos).
   - Cada mentor fala EM PRIMEIRA PESSOA, fiel ao seu pensamento, frameworks e estilo reais — substância, não clichê motivacional. Encabece cada fala com o nome do mentor em negrito (ex: "**Robert Greene:**").
   - Feche com a "Síntese do Arquiteto": um plano de ação NUMERADO e acionável + o próximo passo concreto.
2. Para SAUDAÇÃO ou conversa simples, responda direto e cordial — sem forçar a mesa redonda.
3. Quando faltar dado ATUAL (cases, números, referências recentes), use a busca web e cite a origem.

SELEÇÃO DE MENTORES — o elenco disponível, por domínio:
${mentorIndex()}

TOM: direto, sofisticado, mentor-level. Sem enchimento. Priorize durabilidade, qualidade e valor intrínseco — nunca o atalho preguiçoso.

OBS: Nesta fase você AINDA NÃO executa ações no ERP (cadastros vêm depois). Se Allan pedir para cadastrar/lançar algo, explique que essa capacidade chega na próxima fase e ofereça o passo a passo manual.`
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/advisor/system-prompt.ts src/lib/advisor/model.ts
git commit -m "feat(conselheiro): add system prompt + model config"
```

---

## Task 6: Persistence server actions

**Files:**
- Create: `src/app/actions/advisor.ts`

- [ ] **Step 1: Write the actions** (Cooper convention: `'use server'`, `auth()`, `requireTenant`, `handleActionError`, `prisma`)

```ts
'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { AuthError, handleActionError } from '@/lib/errors'

function requireTenant(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user?.tenantId) throw new AuthError()
  return session.user.tenantId
}

export async function createThread(firstUserText: string) {
  try {
    const session = await auth()
    const tenantId = requireTenant(session)
    const title = firstUserText.trim().slice(0, 60) || 'Nova consulta'
    return await prisma.advisorThread.create({
      data: { tenantId, userId: (session!.user as any).id ?? null, title },
    })
  } catch (error) {
    handleActionError(error)
  }
}

export async function appendMessage(args: {
  threadId: string
  role: 'user' | 'assistant'
  content: string
  mentors?: string[]
  sources?: unknown
}) {
  try {
    const session = await auth()
    const tenantId = requireTenant(session)
    // ownership check (defense in depth — thread must belong to this tenant)
    const thread = await prisma.advisorThread.findFirst({
      where: { id: args.threadId, tenantId },
      select: { id: true },
    })
    if (!thread) throw new AuthError('Conversa não encontrada.')
    await prisma.advisorMessage.create({
      data: {
        threadId: args.threadId,
        role: args.role,
        content: args.content,
        mentors: args.mentors ?? [],
        sources: (args.sources as any) ?? undefined,
      },
    })
    await prisma.advisorThread.update({ where: { id: args.threadId }, data: { updatedAt: new Date() } })
  } catch (error) {
    handleActionError(error)
  }
}

export async function getLatestThread() {
  const session = await auth()
  const tenantId = requireTenant(session)
  return prisma.advisorThread.findFirst({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
}

export async function listThreads() {
  const session = await auth()
  const tenantId = requireTenant(session)
  return prisma.advisorThread.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, updatedAt: true },
  })
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/advisor.ts
git commit -m "feat(conselheiro): add advisor thread/message persistence actions"
```

---

## Task 7: The advisor route (streaming agent + web_search)

**Files:**
- Create: `src/app/api/advisor/route.ts`

> **VERIFY-FIRST (vercel:ai-sdk skill):** confirm `streamText`, `convertToModelMessages`, `toUIMessageStreamResponse`, `stopWhen`/`stepCountIs`, and the Anthropic web-search tool helper against installed docs. The shape below is the intended architecture.

- [ ] **Step 1: Write the route**

```ts
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { auth } from '@/auth'
import { advisorModel } from '@/lib/advisor/model'
import { buildSystemPrompt } from '@/lib/advisor/system-prompt'
import { createThread, appendMessage } from '@/app/actions/advisor'

export const maxDuration = 60

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return new Response(JSON.stringify({ error: 'Não autenticado' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const body = (await req.json()) as { messages: UIMessage[]; threadId?: string }
  const { messages } = body

  // Lazily create a thread on the first exchange and persist the user's message.
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  const userText = extractText(lastUser)
  let threadId = body.threadId
  if (!threadId) {
    const thread = await createThread(userText)
    threadId = thread?.id
  }
  if (threadId && userText) {
    await appendMessage({ threadId, role: 'user', content: userText })
  }

  const result = streamText({
    model: advisorModel(false),
    system: buildSystemPrompt(),
    messages: convertToModelMessages(messages),
    tools: {
      // VERIFY: exact export/version in @ai-sdk/anthropic docs.
      web_search: anthropic.tools.webSearch_20250305({ maxUses: 5 }),
    },
    stopWhen: stepCountIs(5),
  })

  return result.toUIMessageStreamResponse({
    headers: threadId ? { 'x-thread-id': threadId } : undefined,
    onFinish: async ({ responseMessage }) => {
      const assistantText = extractText(responseMessage)
      if (threadId && assistantText) {
        await appendMessage({ threadId, role: 'assistant', content: assistantText })
      }
    },
  })
}

// UIMessage content lives in `parts`; concatenate text parts.
function extractText(msg: UIMessage | undefined): string {
  if (!msg) return ''
  return (msg.parts ?? [])
    .filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join('')
    .trim()
}
```
Verify the `onFinish` callback's argument shape (`responseMessage` vs `messages`) and `UIMessage.parts` against installed docs; adjust `extractText` accordingly.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. If symbol/type errors appear, grep `node_modules/ai/docs/` and the skill's `references/common-errors.md` (renamed params) before editing.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/advisor/route.ts
git commit -m "feat(conselheiro): streaming advisor route with web_search + persistence"
```

---

## Task 8: Conselheiro component + swap into layout

**Files:**
- Create: `src/components/Conselheiro/Conselheiro.tsx`
- Modify: `src/app/(dashboard)/[tenantId]/layout.tsx`

> **VERIFY-FIRST (vercel:ai-sdk skill):** `useChat` changed significantly across versions — confirm its import (`@ai-sdk/react`), the transport/`api` option, how messages stream, the input handling, and `status`/`sendMessage` shape against installed docs and `references/common-errors.md`. Reuse the floating-widget shell from `src/components/AIAssistant.tsx` (lines 237–387) for layout/voice; only the data layer changes.

- [ ] **Step 1: Write the component**

Keep the existing floating-bubble structure and the Web Speech voice input from `AIAssistant.tsx`; replace the manual `fetch('/api/ai')` flow with `useChat` against `/api/advisor`, and seed history from `getLatestThread()`.

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { MessageSquare, X, Mic, MicOff, Send, Loader2, Sparkles, Bot, User } from 'lucide-react'
import { getLatestThread } from '@/app/actions/advisor'

export function Conselheiro({ tenantId }: { tenantId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [threadId, setThreadId] = useState<string | undefined>(undefined)

  // VERIFY against installed docs: useChat options (api/transport), messages, sendMessage, input handling, status.
  const { messages, sendMessage, status, setMessages } = useChat({
    api: '/api/advisor',
    body: { get threadId() { return threadId } }, // VERIFY: how to pass dynamic body in current useChat
  })

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const [isRecording, setIsRecording] = useState(false)
  const loading = status === 'submitted' || status === 'streaming'

  // Seed history from the latest persisted thread on first open.
  useEffect(() => {
    if (!isOpen || threadId) return
    getLatestThread().then((thread) => {
      if (!thread) return
      setThreadId(thread.id)
      setMessages(
        thread.messages.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          parts: [{ type: 'text', text: m.content }],
        })) as any,
      )
    })
  }, [isOpen, threadId, setMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Web Speech voice input (pt-BR) — ported from AIAssistant.tsx.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'pt-BR'
    rec.onstart = () => setIsRecording(true)
    rec.onresult = (e: any) => setInput(e.results[0][0].transcript)
    rec.onerror = () => setIsRecording(false)
    rec.onend = () => setIsRecording(false)
    recognitionRef.current = rec
  }, [])

  const toggleRecording = () => {
    const rec = recognitionRef.current
    if (!rec) return
    isRecording ? rec.stop() : rec.start()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    sendMessage({ text: input }) // VERIFY sendMessage signature in installed docs
    setInput('')
  }

  return (
    <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-6 right-6 z-50 no-print">
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-[calc(100vw-3rem)] sm:w-[380px] h-[500px] max-h-[calc(100dvh-12rem)] rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              <div>
                <h3 className="text-sm font-bold text-foreground">CONSELHEIRO AXIS</h3>
                <span className="text-[9px] font-semibold text-emerald-600 uppercase tracking-widest">Mesa redonda</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground rounded-lg p-1 hover:bg-muted transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <p className="text-[12.5px] text-muted-foreground">
                Traga um problema real do negócio — pricing, escala, vendas, marca, decisão — e a mesa de mentores responde com um plano de ação.
              </p>
            )}
            {messages.map((msg) => {
              const text = (msg.parts ?? []).filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
              return (
                <div key={msg.id} className={`flex gap-2.5 items-start ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${msg.role === 'user' ? 'bg-primary border-primary text-primary-foreground' : 'bg-muted border-border text-muted-foreground'}`}>
                    {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-primary/10 border border-primary/20 text-foreground font-medium' : 'bg-muted/40 border border-border text-foreground/90'}`}>
                    <p className="whitespace-pre-line">{text}</p>
                  </div>
                </div>
              )
            })}
            {loading && (
              <div className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground"><Bot className="w-3.5 h-3.5" /></div>
                <div className="bg-muted/40 border border-border rounded-xl px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Consultando a mesa...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-muted/20 flex gap-2 items-center">
            <button type="button" onClick={toggleRecording} className={`p-2 rounded-lg transition-all shrink-0 ${isRecording ? 'bg-rose-600 text-white animate-pulse' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`} title="Falar">
              {isRecording ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
            </button>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Traga seu problema..." className="flex-1 bg-background border border-border h-9 rounded-lg px-3 text-[12.5px] font-medium focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" />
            <button type="submit" disabled={loading || !input.trim()} className="p-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg disabled:opacity-50 transition-all shrink-0">
              <Send className="w-4.5 h-4.5" />
            </button>
          </form>
        </div>
      )}

      <button onClick={() => setIsOpen(!isOpen)} className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 active:scale-95 text-white ${isOpen ? 'bg-zinc-800 hover:bg-zinc-700 hover:rotate-90' : 'bg-gradient-to-tr from-[#1a4d38] to-[#2d7a57] hover:scale-105'}`}>
        {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5.5 h-5.5 animate-pulse" />}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Swap the mount in the dashboard layout**

In `src/app/(dashboard)/[tenantId]/layout.tsx`: replace the import `import { AIAssistant } from "@/components/AIAssistant";` with `import { Conselheiro } from "@/components/Conselheiro/Conselheiro";` and replace `<AIAssistant tenantId={tenantId} />` with `<Conselheiro tenantId={tenantId} />`.

- [ ] **Step 3: Typecheck**

Run: `npx prisma generate && npx tsc --noEmit`
Expected: exit 0. Fix any `useChat`/message-shape mismatches against installed docs.

- [ ] **Step 4: Manual verification (dev server)**

Run `npm run dev`, log into a tenant dashboard, open the floating Conselheiro and verify:
- Strategy question (e.g. "Como devo precificar um produto novo de giro rápido?") → 2–4 mentors answer in first person + Síntese do Arquiteto; text streams in.
- Current-info question (e.g. "Qual a tendência de varejo no Paraguai em 2026?") → answer references web sources (web_search fired).
- Reload the page, reopen → previous conversation is restored from the DB.
- Voice button transcribes pt-BR into the input.

- [ ] **Step 5: Commit**

```bash
git add src/components/Conselheiro/Conselheiro.tsx "src/app/(dashboard)/[tenantId]/layout.tsx"
git commit -m "feat(conselheiro): mount Conselheiro assistant, replacing the Gemini bot"
```

---

## Pre-push gate

Before pushing `feat/conselheiro`:

```bash
npx prisma generate && npx tsc --noEmit
```
Expected: exit 0 (catches all TS errors at once, unlike Next's stop-at-first-error). Only push once green.

---

## Self-Review

**Spec coverage (Fase A items from the design spec §10):**
- Route `/api/advisor` + Claude (Sonnet) → Task 7. ✅
- Mesa redonda system prompt → Task 5. ✅
- `web_search` → Task 7. ✅
- Swap of `<AIAssistant>` → Task 8. ✅
- Basic history (Postgres) → Tasks 3 (models) + 6 (actions) + 7 (persist on finish) + 8 (seed from DB). ✅
- Voice input retained → Task 8. ✅
- `ANTHROPIC_API_KEY` env → Task 2. ✅
- Auth/tenant guard inherited → Tasks 6, 7 (`auth()` + `requireTenant`). ✅
- No RAG (roster in prompt) → Tasks 4, 5. ✅

**Placeholder scan:** No "TBD/TODO". The "VERIFY against installed docs" notes are mandated by the `vercel:ai-sdk` skill (memorized API is unreliable) and are paired with concrete reference code + exact files/commands — they are verification gates, not missing content.

**Type consistency:** `threadId` threads through route ↔ actions ↔ component; `appendMessage`/`createThread`/`getLatestThread` signatures match their call sites; `Mentor.signature` optional matches `mentorIndex()` handling; message text is read from `parts[].text` consistently in route and component.
