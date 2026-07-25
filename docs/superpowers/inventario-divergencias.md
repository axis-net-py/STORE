# Inventário de Divergências — STORE · FARM · CLINIC

**Data:** 2026-07-25
**Etapa:** Projeto 1 · Fase 0 · Etapa 1
**Método:** comparação de conjuntos de ficheiros `.ts`/`.tsx` sob `src/` e dos models de `prisma/schema.prisma` nos três repositórios clonados de `github.com/axis-net-py`.

---

## Resumo

| Métrica | Valor |
|---|---|
| Ficheiros por repositório | STORE 122 · FARM 160 · CLINIC 136 |
| Caminhos distintos no total | 213 |
| Presentes nos três | 98 (37 idênticos byte a byte, 61 divergentes) |
| Presentes em exatamente dois | 9 |
| Exclusivos de um só | 106 (STORE 16 · FARM 61 · CLINIC 29) |

Verificação de consistência: 98×3 + 9×2 + 106 = 418 = soma dos ficheiros dos três repositórios. ✔

---

## 1. Núcleo presente apenas no STORE

A recuperar na Fase 4. **As duas primeiras linhas são de segurança.**

| Item | Categoria | Notas |
|---|---|---|
| `lib/authz.ts` | **Segurança** | Biblioteca de autorização. Ausente em FARM e CLINIC. |
| `lib/rate-limit.ts` | **Segurança** | Limitador de tentativas de login (força bruta). O próprio ficheiro documenta a limitação em serverless e sugere Upstash Redis — ver Projeto 2, §4.4. |
| `app/(auth)/change-password/page.tsx` | Núcleo | Com `User.mustChangePassword`. Sem isto, clientes de fazenda e clínica não têm como mudar a password. |
| `app/(dashboard)/[tenantId]/finance/page.tsx` | Núcleo | Contas a receber/pagar, registo e anulação de pagamentos. |
| `app/(dashboard)/[tenantId]/inventory/page.tsx` | Núcleo | `InventoryMovement` existe nos três schemas, mas só o STORE tem a página. |
| `app/actions/account.ts` | Núcleo | Gestão do plano de contas. `Account` existe nos três schemas. |
| `app/actions/payments.ts` | Núcleo | Com o model `Payment`. |
| `app/actions/periods.ts` + `lib/accounting-period.ts` + `components/accounting/PeriodsManager.tsx` | Núcleo | Fecho de períodos contabilísticos, com o model `AccountingPeriod`. |

## 2. Núcleo presente no STORE e CLINIC, ausente no FARM

Origem provável: a série de commits de segurança do STORE (`8b51ecb feat: fase 1 — segurança, Zod validation e error handling`) propagou-se ao CLINIC mas não ao FARM.

| Item | Categoria | Notas |
|---|---|---|
| `lib/schemas/index.ts` | **Segurança** | Schemas Zod de validação de input. **O FARM não valida input.** |
| `lib/errors.ts` | Robustez | Tratamento de erros. |
| `components/ui/empty-state.tsx` | UI | |
| `customers/loading.tsx`, `invoices/loading.tsx`, `products/loading.tsx`, `suppliers/loading.tsx` | UI | Estados de carregamento. |
| `components/icons/Flags.tsx` | UI | O FARM tem `components/FlagIcon.tsx` — implementação alternativa do mesmo. Ver §6. |

## 3. Núcleo ausente no STORE

| Item | Existe em | Categoria |
|---|---|---|
| `lib/get-locale.ts` | FARM, CLINIC | Núcleo — leitura de locale do cookie em server components |
| `lib/ui-strings.ts` | CLINIC | Núcleo — strings partilhadas de CRUD entre módulos |
| `app/(dashboard)/[tenantId]/customers/[id]/page.tsx` | CLINIC | Núcleo — página de detalhe de cliente |

## 4. Módulos verticais

Movem para `src/modules/<vertical>/`. Sem alterações funcionais na Fase 1–3.

### 4.1 `store`

| Item | Models associados |
|---|---|
| `pos/page.tsx`, `components/pos/POSTerminal.tsx` | — |
| `orders/page.tsx`, `app/actions/orders.ts` | `Order`, `OrderItem` |

### 4.2 `farm` — 61 ficheiros

Rotas `safra/`, `talhoes/`, `frota/`, `rebanho/`, `silos/`, `contratos/`, `funcionarios/`, `certificacoes/`; as respetivas actions e componentes (`HarvestList/Sheet`, `PlotList/Sheet`, `VehicleList/Sheet/Timeline`, `LivestockBatch*`, `Silo*`, `SoilAnalysis*`, `PlotApplication*`, `IrrigationEvent*`, `Certification*`, `Contract*`, `Employee*`), e `components/dashboard/PlotBreakdown.tsx`, `RecentContracts.tsx`.

Models: `Harvest`, `Plot`, `SoilAnalysis`, `PlotApplication`, `Vehicle`, `VehicleLog`, `Employee`, `Contract`, `Silo`, `SiloMovement`, `LivestockBatch`, `LivestockEvent`, `Certification`, `IrrigationEvent`.

### 4.3 `clinic`

Rotas `agenda/`, `profissionais/`, `servicos/`; actions `appointment.ts`, `professional.ts`, `service.ts`; componentes `Professional*`, `Service*`, `agenda/AgendaCalendar`, `agenda/AppointmentPanel`, `agenda/NewAppointmentDialog`, `components/dashboard/AgendaStats.tsx`; `lib/agenda.ts` e `lib/agenda.test.ts`.

Models: `Professional`, `Service`, `Appointment`.

## 5. A remover

Decisão D6 — o Conselheiro é projeto independente (`TAVOLA`), não pertence ao ERP.

| Item |
|---|
| `components/Conselheiro/Conselheiro.tsx` |
| `lib/advisor/mentors.ts`, `model.ts`, `persistence.ts`, `system-prompt.ts`, `tools.ts` |
| `app/actions/advisor.ts` |
| `app/api/advisor/route.ts` |
| Models `AdvisorThread`, `AdvisorMessage` |

**Antes de remover:** confirmar que nada em `TAVOLA` depende desta cópia, e que a versão do CLINIC não contém trabalho que o `TAVOLA` não tenha.

## 6. Decisões pendentes

| # | Questão | Contexto |
|---|---|---|
| Q1 | `Warehouse` / `WarehouseStock` (`actions/warehouse.ts`, `lib/warehouse.ts`) — núcleo, módulo `store`, ou módulo transversal? | Multi-depósito não é exclusivo do comércio, mas o FARM tem `Silo` para função semelhante. Recomendação: **módulo transversal `warehouse`**, ativável por qualquer vertical. |
| Q2 | `Employee` / `Contract` (FARM) — vertical ou núcleo de RH? | Gestão de funcionários é transversal. Recomendação: módulo transversal `hr`. |
| Q3 | `Customer.birthDate`, `Customer.healthNotes` (CLINIC) | Opcionais no núcleo, ou campos do módulo `clinic`. Decidir na Fase 3. |
| Q4 | `components/FlagIcon.tsx` (FARM) vs `components/icons/Flags.tsx` (STORE, CLINIC) | Duplicado. Escolher um e eliminar o outro. |
| Q5 | `lib/ai/model.ts` + `lib/ai/tools.ts` (FARM) | O FARM **já separou** o motor de IA em modelo e ferramentas — é o padrão alvo da Fase 5. Avaliar como ponto de partida em vez de partir do `api/ai/route.ts` do STORE. |

## 7. Risco descoberto: ausência de testes

| Repositório | Ficheiros de teste |
|---|---|
| STORE | 0 |
| FARM | 0 |
| CLINIC | 1 (`lib/agenda.test.ts`) |

O critério de aceitação das Fases 1–3 é *"o vertical faz exatamente o que fazia antes"*. Não existe nenhuma rede automática que o comprove — a verificação será manual em toda a refatoração.

**Recomendação:** antes da Fase 1, criar um conjunto mínimo de testes sobre os caminhos críticos do núcleo que a refatoração vai tocar — emissão de fatura com validação de stock, autenticação, e o cálculo contabilístico. Não é cobertura completa; é uma rede de segurança para o trabalho seguinte.

Esta recomendação não estava na especificação e é acrescentada aqui como consequência do inventário.

### 7.1 Rede mínima criada (2026-07-25)

Runner nativo do Node (`npm test`), sem dependências novas — mesmo padrão do único teste existente no CLINIC. 21 testes, `tsc --noEmit` e `npm run build` limpos.

| Ficheiro | Cobre |
|---|---|
| `src/lib/tax.test.ts` | Cálculo de IVA paraguaio (10%, 5%, exento), arredondamento HALF_UP a zero casas, valores grandes |
| `src/lib/rate-limit.test.ts` | Limite de 5 tentativas, janela, independência entre chaves, libertação após login |
| `src/lib/accounting-period.test.ts` | Guarda de período fechado, isolamento por tenant e por mês, fronteiras de mês e ano |

Para tornar o cálculo de IVA testável, `calculateTax` foi extraído de `app/actions/invoice.ts` para `src/lib/tax.ts`, **sem alteração de comportamento**. `allowImportingTsExtensions` foi ativado no `tsconfig.json` (legítimo com `noEmit: true`), permitindo testes com verificação de tipos completa em vez do `@ts-nocheck` que o CLINIC teve de usar.

### 7.2 Defeito descoberto pelos testes: período contabilístico e fuso horário

`lib/accounting-period.ts` usa `getFullYear()`/`getMonth()` — **hora local** — sobre datas que chegam em UTC. Em `America/Asuncion` e `America/Sao_Paulo` (UTC-3), `new Date('2026-08-01')` é meia-noite UTC = 31/07 às 21h local.

**Efeito: o primeiro dia de cada mês é atribuído ao mês anterior.** Fechado o período de julho, uma fatura datada de 1 de agosto é recusada com *"Período contábil 07/2026 está fechado"*.

Alcançável no caminho principal: `data.issuedAt` proveniente de `<input type="date">` produz exatamente este valor (`invoice.ts:112`, `234`), e `invoice.issuedAt` lido do Postgres preserva-o (`invoice.ts:390`, `462`, `593`). Afeta também `payments.ts:170`, `279` e `accounting.ts:278`.

**Não corrigido.** Nem UTC nem hora local estão corretos isoladamente: com `new Date()` às 22h de 31/07 em Assunção, os getters UTC atribuiriam agosto a um documento fiscalmente de julho. A correção exige normalizar como as datas são armazenadas — decisão com implicações fiscais, a validar com um contabilista.

Documentado em `accounting-period.test.ts`: um teste fixa o comportamento errado atual (para que a unificação não o altere por acidente) e um `test.todo` regista o comportamento desejado.

**Decisão pendente Q6:** quando e como corrigir a semântica de datas dos períodos contabilísticos.

---

## Verificação da Etapa 1

- [x] Todo ficheiro exclusivo a um repositório aparece classificado (106 exclusivos + 9 em dois repositórios)
- [x] Nenhuma linha com categoria por preencher (as pendências estão isoladas em §6 como decisões, não como omissões)
- [x] Itens já conhecidos confirmados como Núcleo: `change-password`, `User.mustChangePassword`, `lib/authz.ts`, `AccountingPeriod`, `Payment`, `actions/account.ts`
- [x] Descobertas novas: `lib/rate-limit.ts`, `lib/schemas/index.ts`, `lib/errors.ts`, `lib/get-locale.ts`, `lib/ui-strings.ts`, página de detalhe de cliente
- [x] Nada foi corrigido nesta etapa — é inventário

**Nota sobre o segredo NextAuth:** verificado que o padrão só-dev de `STORE/src/auth.ts:84-88` é superior ao de FARM e CLINIC (`secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET`, sem fallback e sem falha explícita). Classificado como Núcleo a propagar, com a melhoria descrita no Projeto 2, §4.4.
