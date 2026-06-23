# CONSELHEIRO AXIS — Design Spec

> Agente de IA estratégico **dentro do COOPER ERP**, substituindo a IA integrada atual.
> Data: 2026-06-23 · Status: aprovado (direção) — aguardando revisão do spec.

---

## 1. Objetivo & contexto

Substituir a "IA integrada" atual do Cooper — o assistente flutuante **COOPER IA** (`AIAssistant.tsx`), um bot de comandos sobre **Gemini 2.5 Flash** — por um **agente Claude** que é, ao mesmo tempo:

1. **Conselheiro estratégico** — uma *mesa redonda* de mentores que responde em 1ª pessoa (Greene, Bezos, Drucker, Aurelius…) com plano de ação acionável.
2. **Executor do ERP** — cadastra produto/cliente/fornecedor/transação/fatura por linguagem natural, via **tool-use** ligado às *server actions* existentes.

O agente vive dentro do Cooper (Next.js 16, multi-tenant, NextAuth, Prisma/Postgres) e reaproveita auth, actions e banco. O provedor de IA muda de **Gemini → Claude (Anthropic)**. O importador de faturas (`/api/ai`, Gemini) **permanece intacto**.

## 2. Decisões fechadas

| Item | Decisão |
|---|---|
| Escopo | Híbrido: conselheiro **+** executa ações no ERP |
| Knowledge base / RAG | **Não construir.** Mentores codificados no system prompt + `web_search` para material atual |
| Persistência | **Postgres do Cooper via Prisma**, multi-tenant (não IndexedDB) |
| Provedor | **Anthropic Claude** |
| SDK | **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`) — streaming + tool-use multi-step + `web_search` |
| Modelos | `claude-sonnet-4-6` (default) · `claude-opus-4-8` ("análise profunda", sob demanda) |
| Autenticação | Herda NextAuth do Cooper — rota autenticada por tenant, **não é endpoint público** |
| Provedor da extração de faturas | Permanece **Gemini** (`/api/ai`), fora de escopo desta troca |

## 3. Arquitetura

**Ponto de montagem (único):** `src/app/(dashboard)/[tenantId]/layout.tsx` — hoje renderiza `<AIAssistant tenantId={tenantId} />`. Será trocado pelo novo componente do Conselheiro (mesmo lugar; refino visual fica para a Fase D).

**Componentes novos:**

- `src/components/Conselheiro/` — componente cliente do assistente. Reaproveita o padrão do widget flutuante atual (input texto + voz + lista de mensagens; streaming de resposta). Visual mínimo agora, Old Money depois.
- `src/app/api/advisor/route.ts` — rota server. Faz `auth()` + guarda de tenant (mesmo padrão de `/api/ai`), monta a chamada ao Claude via AI SDK, faz **streaming** da resposta e roda o **loop multi-step de tool-use** até a resposta final.
- `src/lib/advisor/system-prompt.ts` — persona do Conselheiro + os 12 mentores (voz/frameworks) + regras de quando aconselhar vs. agir + formato de saída.
- `src/lib/advisor/tools.ts` — definição das tools do agente (Zod input), cada uma mapeando a uma *server action existente*; injeta sempre o `tenantId` do `session`.
- `src/app/actions/advisor.ts` — persistência: `createThread`, `appendMessage`, `listThreads`, `getThread`, `renameThread`, `deleteThread` (padrão `'use server'` + `requireTenant`).

**Fluxo de uma consulta:**

```
Usuário → componente Conselheiro → POST /api/advisor (auth + tenantId)
  → Claude (Sonnet 4.6) com system prompt + histórico do thread + tools
     ├─ pergunta estratégica → responde mesa redonda (stream)
     ├─ comando operacional → tool-use → server action (Prisma) → tool_result → continua
     └─ precisa dado atual → web_search → continua
  → resposta final (stream) → persiste user+assistant em AdvisorMessage
  → se executou ação de escrita, client faz router.refresh()
```

## 4. O agente

**System prompt** (PT-BR) estabelece:
- Persona **CONSELHEIRO AXIS** — mesa redonda das maiores mentes de negócios/estratégia/filosofia/alta performance.
- Seleção **dinâmica de 2–4 mentores** pertinentes (não despeja os 12).
- Saída: **vozes individuais** em 1ª pessoa + **"Síntese do Arquiteto"** (plano numerado + próximo passo).
- Regra de roteamento: comando operacional ("cadastrar…", "lançar…") → usar tool e confirmar; pergunta/dúvida → aconselhar. Saudação/conversa → responder direto, sem mesa redonda forçada.
- Contexto: ERP comercial para varejo no **Paraguai/LatAm** (moedas PYG/USD/BRL, RUC, SIFEN). Idioma PT-BR.

**Tools (tool-use):**
- *Escrita* → server actions existentes: `create_product`, `create_customer`, `create_supplier`, `create_finance_transaction`, `create_purchase_invoice`, `create_sales_invoice`.
- *Leitura* (para conselho com dados reais do tenant): `get_products`, `get_customers`, `get_suppliers`, e um `get_finance_summary` / `get_reports` mapeado ao que `reports.ts`/`finance.ts` já expõem.
- `web_search` — server tool da Anthropic.

**Segurança multi-tenant:** o `tenantId` vem **sempre** do `session` no servidor e é injetado nas actions — o modelo nunca fornece/decide `tenantId`. As tools reusam a validação Zod (`@/lib/schemas`) e o `handleActionError` do Phase 1.

**Confirmação:** ações de **criação** executam e o agente confirma no texto. **Sem `delete`/`update` via agente no MVP** (evita perda acidental). 

## 5. Mentores

Roster definitivo: **~60 mentores** (confirmado e expandido pelo Allan), organizados por domínio — o agente seleciona dinamicamente os **2–4 pertinentes** a cada problema. A escala reforça a decisão de **não construir RAG** (§2): o system prompt carrega um **índice conciso** (nome + assinatura de 1 linha por mentor, não biografias longas); o Claude rende a voz pelo conhecimento que já tem; e `web_search` (+ notas curadas pontuais) aterrissa as figuras de nicho.

- **Filosofia, estoicismo & mente soberana:** Marcus Aurelius, Sêneca, Ryan Holiday, Jordan Peterson, Eckhart Tolle
- **Estratégia, poder & competição:** Robert Greene, Sun Tzu, Naval Ravikant
- **Gestão & arquitetura de negócios:** Peter Drucker, Jim Collins, Jack Welch, Ram Charan, John Doerr, Stephen Covey
- **Capital, investimento & longevidade:** Warren Buffett, Ray Dalio, Jorge Paulo Lemann, Luiz Barsi, Morgan Housel
- **Fundadores & inovação radical:** Jeff Bezos, Elon Musk, Steve Jobs, Alex Hormozi
- **Empreendedores brasileiros & resiliência:** Flávio Augusto da Silva, Abílio Diniz, Geraldo Rufino, Tallis Gomes, Pablo Marçal, Giovanni Begossi, Alfredo Soares, Felipe Alves (Fe Alves SN)
- **Vendas & negociação:** Robert Cialdini, Neil Rackham, Jeffrey Gitomer, Brian Tracy, Aaron Ross & Marylou Tyler, OG Mandino, Chris Voss, Rodrigo Noll
- **Marketing, autoridade & comunicação:** Simon Sinek, Seth Godin, John C. Maxwell, Dale Carnegie, Robin Sharma, Nicholas Boothman, Brené Brown
- **Alta performance, hábitos & coaching:** Tony Robbins, Tim Ferriss, Tim Gallwey, Brendon Burchard, Charles Duhigg, David Goggins
- **Mentalidade, manifestação & metafísica:** Napoleon Hill, Bob Proctor, Joseph Murphy, Neville Goddard, Vadim Zeland, Joe Dispenza, T. Harv Eker, Paulo Vieira

Resolve o §10 do brief: **Lemann** e **Luiz Barsi** (o "Bice" era erro de áudio → Barsi) entram; "Menin"/"Joker" descartados; **Burchard mantido**.

**Notas de fidelidade (não bloqueiam):**
- **Neil "Hackman"** → quase certo que é **Neil Rackham** (SPIN Selling); registrado assim — confirmar.
- **Felipe Alves** identificado: [@fealvessn](https://www.instagram.com/fealvessn/) · [YouTube](https://www.youtube.com/@FeAlvesSN) — persona pesquisada na autoria do índice.
- Figuras menos cobertas pelo modelo (Begossi, Tallis Gomes, Rodrigo Noll, Alfredo Soares, Paulo Vieira, Fe Alves) recebem nota curada curta e/ou `web_search` para fidelidade de voz.

## 6. Persistência (modelos Prisma)

Seguindo as convenções do schema (cuid, `tenantId` + `@@index`, `createdAt/updatedAt`):

```prisma
model AdvisorThread {
  id        String          @id @default(cuid())
  tenantId  String
  tenant    Tenant          @relation(fields: [tenantId], references: [id])
  userId    String?
  title     String          @default("Nova consulta")
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
  messages  AdvisorMessage[]
  @@index([tenantId])
}

model AdvisorMessage {
  id        String        @id @default(cuid())
  threadId  String
  thread    AdvisorThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  role      String        // "USER" | "ASSISTANT"
  content   String        @db.Text
  mentors   String[]      // mentores que falaram (para render futuro)
  sources   Json?         // citações de web_search
  createdAt DateTime      @default(now())
  @@index([threadId])
}
```
+ adicionar `advisorThreads AdvisorThread[]` ao model `Tenant`.

**Migração:** `prisma migrate dev` local contra o Postgres (Neon/Supabase); aplicar no deploy. `npx prisma generate` antes do typecheck.

## 7. Env & custo

- Adicionar `ANTHROPIC_API_KEY` ao `.env.example`, `.env` local e env da Vercel (com `web_search` habilitado).
- Manter `GEMINI_API_KEY` (importador de faturas).
- Custo: rota autenticada por tenant; **Sonnet 4.6** como default barato; **Opus 4.8** só no botão "análise profunda".

## 8. Tratamento de erro

- Tools reusam `handleActionError` (AppError do Phase 1).
- Erro da API Claude / sem key → mensagem amigável no chat + `console.error` no servidor.
- Tool falha → devolve `tool_result` de erro ao modelo, que explica ao usuário em vez de quebrar.

## 9. Testes / verificação

- **Antes de push (obrigatório):** `npx prisma generate && npx tsc --noEmit` no repo Cooper (evita queimar deploys da Vercel).
- **Manual, por fase:**
  - Mesa redonda: pergunta estratégica → 2–4 mentores + Síntese do Arquiteto.
  - Ação: "cadastrar produto X com preço 50000" → registro criado no banco + `router.refresh()`.
  - web_search: pergunta sobre algo atual → resposta cita fonte.
  - Persistência: recarregar a página → histórico do thread permanece.
- **Visível:** cada fase entrega mudança demonstrável na interface (o usuário avalia progresso pelo que vê).

## 10. Fases de construção (funcionalidade primeiro)

- **Fase A — Conselheiro no ar:** `/api/advisor` + Claude (Sonnet) + system prompt (mesa redonda) + `web_search` + troca do `<AIAssistant>` + histórico básico (criar thread, persistir mensagens). Resultado: dá para consultar e ver resposta nova.
- **Fase B — Executa ações:** tools de escrita ligadas às server actions (cadastrar por linguagem natural via Claude) + tools de leitura para conselho com dados reais.
- **Fase C — Histórico/UX:** barra de threads (criar/renomear/trocar/excluir) + toggle "análise profunda" (Opus 4.8) + input de voz mantido.
- **Fase D — Estética Old Money:** paleta/tipografia, micro-interações, render rico da mesa redonda.

## 11. Fora de escopo (MVP)

RAG/vetores; `delete`/`update` de registros via agente; migrar o importador de faturas para Claude; idiomas além de PT-BR; integração com CRM/pipeline externo (a camada de dados é desenhada pensando nisso, mas a integração em si fica para depois).

## 12. Decisões da revisão (resolvidas)

1. **Mentores** — roster de ~60 definido (§5). §10 do brief resolvido (Lemann + Barsi entram; Burchard mantido).
2. **Input de voz** (Web Speech) — **mantido**.
3. **Criar registros** — agente **cria direto e confirma no texto** (sem confirmação prévia; sem `delete`/`update` via agente).

*Pendências não-bloqueantes:* confirmar grafia **Neil Rackham**; pesquisar persona de **Felipe Alves** e demais figuras de nicho na autoria do índice de mentores (Fase A).
