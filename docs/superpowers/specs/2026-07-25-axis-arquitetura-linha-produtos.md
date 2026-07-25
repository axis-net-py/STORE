# AXIS — Arquitetura da Linha de Produtos

**Data:** 2026-07-25
**Estado:** Aprovado
**Âmbito:** Decisão estruturante sobre como os produtos AXIS são construídos, mantidos e vendidos.

---

## 1. Contexto

O AXIS é um ERP para PME no Paraguai, com integração fiscal SIFEN (SET). Existe hoje como **três bases de código separadas**, mais uma quarta planeada:

| Produto | Repositório | Vercel | Estado |
|---|---|---|---|
| axis store (comércio) | `axis-net-py/STORE` | `axisretail` | 44 commits, 122 ficheiros, ~17.900 linhas |
| axis farm (fazendas) | `axis-net-py/FARM` | `axisfarm` | 153 commits, 160 ficheiros, ~23.700 linhas |
| axis clinic (clínicas) | `axis-net-py/CLINIC` | `axisclinic` | 83 commits, 136 ficheiros, ~18.500 linhas |
| axis food (restauração) | `axis-net-py/FOOD` | — | vazio (1 commit) |

O STORE foi a construção inicial; os restantes derivaram dele por cópia. O histórico regista o processo:

```
9a38159 chore: rename AURELIUS to COOPER
49c7825 feat: remove agricultural modules and consolidate core commercial erp
```

Nenhum produto tem ainda clientes pagantes.

## 2. O problema

A replicação por cópia já produziu custos mensuráveis.

### 2.1 Trabalho triplicado

Os commits mais recentes dos três repositórios são a mesma funcionalidade, implementada três vezes:

```
STORE   feat(padronização): toggle "Mostrar Inativos" em Produtos/Clientes/Fornecedores
FARM    feat(padronização): toggle "Mostrar Inativos" em Produtos/Clientes/Fornecedores
CLINIC  feat(padronização): toggle "Mostrar Inativos" em Produtos/Pacientes/Fornecedores/Profissionais
```

### 2.2 Funcionalidades de núcleo presas no fork onde nasceram

| Funcionalidade | Existe em | Falta em |
|---|---|---|
| Mudança de password (`change-password` + `User.mustChangePassword`) | STORE | **FARM, CLINIC** |
| `lib/authz.ts` — biblioteca de autorização | STORE | **FARM, CLINIC** |
| Fecho de períodos contabilísticos (`AccountingPeriod`) | STORE | FARM, CLINIC |
| Registo de pagamentos (`Payment`) | STORE | FARM, CLINIC |
| Gestão do plano de contas (`actions/account.ts`) | STORE | FARM, CLINIC |

As duas primeiras linhas são de segurança. Clientes de fazenda e de clínica não têm como mudar a password.

### 2.3 Defeitos estruturais partilhados

A camada de IA escreve diretamente na base de dados, contornando as server actions que contêm as regras de negócio: 11 chamadas `prisma.*.create()` no STORE, 15 no FARM, 10 no CLINIC. O mesmo padrão de risco existe nos três produtos e exige três correções independentes.

O incidente de 2026-07-25 (fatura emitida sobre stock inexistente) é uma manifestação deste padrão. Ver `2026-07-25-projeto-1-unificacao-design.md`, secção 6.

*Nota de verificação (2026-07-25): investigou-se também se o segredo NextAuth hardcoded do commit `7d687bc` teria sido propagado. **Não foi.** O STORE corrigiu-o (`src/auth.ts` usa fallback apenas em desenvolvimento) e FARM e CLINIC nunca o tiveram.*

### 2.4 Risco concentrado: SIFEN

A integração com a SET é o ativo mais valioso e é **idêntica** nos quatro verticais. Uma alteração de especificação da autoridade fiscal obriga hoje a três correções independentes, sob pressão de tempo, com risco de uma ficar por fazer.

## 3. Decisão

**Uma base de código. Verticais como pacotes de módulos. Marcas separadas por domínio.**

```
*.axisstore.com  ┐
*.axisfarm.com   ├──→  um único deploy Vercel
*.axisclinic.com │
*.axisfood.com   ┘
```

O domínio de entrada determina a marca e o pacote de módulos ativos. Quatro produtos para o mercado; uma base de código para a engenharia.

### 3.1 Evidência de viabilidade

Análise comparativa dos três schemas Prisma (2026-07-25):

Os **mesmos 15 models** existem nos três, pela mesma ordem: `Tenant`, `User`, `Customer`, `Supplier`, `Product`, `CommercialInvoice`, `InvoiceItem`, `InventoryMovement`, `ExchangeRate`, `Account`, `Transaction`, `Permission`, `JournalEntry`, `JournalLine`, `AuditLog`.

Divergência semântica real no núcleo, somados os três repositórios:

| Diferença | Onde | Natureza |
|---|---|---|
| `mustChangePassword` em `User` | só STORE | funcionalidade a recuperar |
| `birthDate`, `healthNotes` em `Customer` | só CLINIC | campos do vertical |
| `@default(0) @db.Decimal(12,2)` vs `@db.Decimal(12,2) @default(0)` | STORE vs FARM | ordem de atributos — semanticamente idêntico |

Todo o restante diff do núcleo são relações inversas para models dos verticais (`orders Order[]` contra `harvests Harvest[]`), que coexistem sem conflito num schema unificado.

Ao nível dos ficheiros: 98 caminhos presentes nos três repositórios, dos quais 37 são idênticos byte a byte.

### 3.2 Os verticais já estão isolados por diretório

| Vertical | Diretórios exclusivos |
|---|---|
| store | `pos/`, `orders/`, `inventory/`, `finance/` |
| farm | `safra/`, `talhoes/`, `frota/`, `rebanho/`, `silos/`, `contratos/`, `funcionarios/`, `certificacoes/` |
| clinic | `agenda/`, `profissionais/`, `servicos/` |

A extração para módulos é predominantemente movimentação de ficheiros, não reescrita.

### 3.3 Alternativas consideradas e rejeitadas

**Manter repositórios separados.** Rejeitada: o custo já é visível (secções 2.1–2.4) e cresce linearmente com cada vertical novo.

**Monorepo com quatro aplicações e pacotes partilhados.** Rejeitada: resolve a duplicação do SIFEN mas mantém quatro deploys, quatro conjuntos de migrações e quatro superfícies de configuração — a maior parte do custo operacional permanece.

**Deploy separado por cliente.** Rejeitada: transforma cada correção em N deploys.

## 4. Projetos

### Projeto 1 — Unificação
Uma base de código com núcleo e módulos. `store`, `farm` e `clinic` passam a pacotes de módulos. Inclui a recuperação das funcionalidades presas e a reconstrução do assistente de IA.
→ `2026-07-25-projeto-1-unificacao-design.md`

### Projeto 2 — Multi-tenant SaaS
Control plane, provisionamento automático, subdomínio por cliente, segredos fiscais por tenant, migrações em N bases de dados. É o que permite vender.
→ `2026-07-25-projeto-2-multi-tenant-design.md`

### Projeto 3 — axis food
O primeiro vertical construído de raiz na arquitetura nova. O repositório `FOOD` está vazio, sem passado a corrigir.

### Ordem: 1 → 2 → 3

**A unificação primeiro**, porque tudo o que for construído antes dela é construído três vezes.

**O multi-tenant a seguir**, porque é o que desbloqueia receita. Três verticais vendáveis valem mais do que quatro por entregar.

**O axis food por último**, chegando a uma arquitetura provada. Se adicionar um vertical custar meses em vez de dias, é sinal de que a unificação foi mal feita — e é preferível descobrir isso ao quarto vertical do que ao sétimo.

### Porquê agora

Não existem clientes pagantes. Unificar hoje não envolve migração de dados em produção, indisponibilidade, nem comunicação a clientes. Cada uma dessas condições deixa de ser verdade após a primeira venda. O custo está no mínimo e é monotonicamente crescente.

## 5. Decisões registadas

| # | Decisão | Motivo |
|---|---|---|
| D1 | Uma base de código, verticais como módulos | Secção 2 |
| D2 | Marcas separadas por domínio, mesmo deploy | O mercado exige separação de marca, não de código |
| D3 | STORE é a base da unificação | Foi a construção inicial e retém mais núcleo |
| D4 | Todas as BDs recebem as tabelas de todos os módulos; só a flag difere | Colapsa a matriz de migrações de N×M para N |
| D5 | `tenantId` mantém-se em todas as tabelas | Permite consolidar tenants no futuro sem reescrita |
| D6 | O Conselheiro sai do CLINIC | É projeto independente (`TAVOLA`), não pertence ao ERP |
| D7 | O núcleo nunca importa de um módulo | Sem esta regra os módulos deixam de ser opcionais |
| D8 | Proibido `if (tenantId === "...")` no código | É sempre configuração, campo personalizado ou módulo |
| D9 | O repositório `STORE` é renomeado para `AXIS` e passa a ser a base unificada; `FARM` e `CLINIC` são arquivados após extração | Preserva o histórico da base que será mantida, incluindo as correções de segurança que os outros forks ainda não receberam |
| D10 | A pasta local `AXIS/COOPER` é eliminada | Cópia desatualizada; em 2026-07-25 induziu em erro sobre uma vulnerabilidade já corrigida |

## 6. Riscos

| Risco | Mitigação |
|---|---|
| A unificação é grande e sem resultado visível — risco de abandono a meio | Executar um vertical de cada vez, cada um verificado antes do seguinte |
| Regressão silenciosa num vertical durante a extração | Critério de aceitação por fase: o vertical faz exatamente o que fazia antes |
| `api/ai/route.ts` diverge em ~914 linhas entre STORE e FARM | Tratado como fase própria e final, com desenho novo |
| Correções de segurança aplicadas apenas num fork | Inventariar, por fork, o que foi corrigido só ali — o STORE está à frente dos outros dois |
