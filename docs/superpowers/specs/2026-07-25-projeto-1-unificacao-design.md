# Projeto 1 — Unificação da Base de Código

**Data:** 2026-07-25
**Estado:** Aprovado
**Depende de:** `2026-07-25-axis-arquitetura-linha-produtos.md`

---

## 1. Objetivo

Reunir `STORE`, `FARM` e `CLINIC` numa única base de código, com um núcleo partilhado e os verticais como pacotes de módulos.

**Critério de sucesso:** cada um dos três verticais faz exatamente o que fazia antes. Zero funcionalidades novas, com a exceção deliberada da secção 5 (recuperação do que estava preso).

**Não-objetivo:** multi-tenant, novos verticais, novas funcionalidades de negócio.

## 2. Arquitetura alvo

```
src/
  core/                 ← 15 models, auth, faturação, SIFEN, contabilidade, relatórios
  modules/
    store/              ← pos, orders, inventory, finance, periods, payments
    farm/               ← safra, talhoes, frota, rebanho, silos, contratos, funcionarios, certificacoes
    clinic/             ← agenda, profissionais, servicos
    food/               ← vazio, Projeto 3
  verticals.ts          ← composição: que módulos formam cada marca
prisma/
  schema.prisma         ← núcleo + models de todos os módulos
  migrations/           ← criar (ver secção 3)
```

### 2.1 Anatomia de um módulo

```
src/modules/farm/
  manifest.ts       ← nome, rotas, entradas de menu, permissões
  models.prisma     ← tabelas com prefixo mod_farm_
  actions/
  components/
```

O `manifest.ts` regista-se no arranque. A navegação constrói-se de: itens do núcleo + itens dos módulos ativos. O `Sidebar.tsx` já usa um array declarativo de itens — a alteração é filtrá-lo.

O layout das rotas de um módulo verifica se está ativo e devolve 404 caso contrário. Esconder do menu não é suficiente; o URL tem de estar fechado.

### 2.2 Regras invioláveis

**Módulos importam do núcleo; o núcleo nunca importa de um módulo.** No momento em que `core/invoices` importar de `modules/farm`, os módulos deixam de ser opcionais.

**Proibido `if (tenantId === "...")`.** É sempre uma de três coisas: um valor de configuração, um campo personalizado, ou um módulo.

### 2.3 Schema único

Um só `schema.prisma`, com o núcleo e os models de todos os módulos. **Todas as bases de dados recebem todas as tabelas**; apenas a flag de módulo ativo difere por tenant.

Justificação: se cada base de dados tivesse apenas as tabelas dos módulos contratados, a matriz de migrações passaria de *N clientes* para *N clientes × M combinações de módulos*. Com tabelas uniformes existe um único conjunto de migrações. Uma tabela vazia em Postgres custa alguns kilobytes.

## 3. Pré-requisito bloqueante: histórico de migrações

Nenhum dos três repositórios tem pasta `prisma/migrations/` (verificado em 2026-07-25 em STORE, FARM e CLINIC). O desenvolvimento tem usado `prisma db push`, que aplica o schema sem registar como lá chegou.

Com uma base de dados isto é tolerável. Com N é inviável: não há forma de saber que versão cada base tem, nem de aplicar apenas o que falta.

**Primeira ação do projeto:** gerar a migração inicial a partir do schema unificado e adotar `prisma migrate deploy`.

## 4. Fases de execução

Cada fase termina com o vertical correspondente verificado a funcionar. Nunca existem dois verticais partidos ao mesmo tempo.

| Fase | Conteúdo | Critério de aceitação |
|---|---|---|
| 0 | Inventariar correções de segurança presentes só num fork; gerar migração inicial | Inventário feito; `migrations/` existe |
| 1 | STORE como base; extrair `store/` para módulo | STORE funciona igual; núcleo sem referências a `pos`/`orders` |
| 2 | Trazer `farm/` como módulo | FARM funciona igual |
| 3 | Trazer `clinic/` como módulo (sem o Conselheiro) | CLINIC funciona igual |
| 4 | Recuperar funcionalidades presas (secção 5) | Disponíveis nos três verticais |
| 5 | Reconstruir o assistente de IA (secção 6) | Ver secção 6.4 |

## 5. Funcionalidades a recuperar

Existem hoje num fork e faltam nos outros. Após a unificação passam a estar em todos:

| Funcionalidade | Origem | Prioridade |
|---|---|---|
| Mudança de password (`change-password` + `User.mustChangePassword`) | STORE | **Alta — segurança** |
| `lib/authz.ts` | STORE | **Alta — segurança** |
| Fecho de períodos contabilísticos (`AccountingPeriod`) | STORE | Média |
| Registo de pagamentos (`Payment`) | STORE | Média |
| Gestão do plano de contas (`actions/account.ts`) | STORE | Média |

`Customer.birthDate` e `Customer.healthNotes` (hoje só em CLINIC) permanecem opcionais no núcleo ou migram para o módulo `clinic`. Decisão a tomar na Fase 3.

## 6. Fase 5 — Assistente de IA

### 6.1 Incidente que motiva o redesenho

Em 2026-07-25 observou-se o assistente a emitir uma fatura de venda de 10 unidades de um produto com 3 unidades em stock.

**Diagnóstico confirmado contra os dados de produção** (base `axis-stellium`):

| Produto | SKU | Custo | Stock | Criado |
|---|---|---|---|---|
| `VOTOMASSA ARGAMASA 20KG AC3` | `2309` | 50.000 | 3 | 13:01 — compra real |
| `Votomassa Argamasa` | `PROD-VOTOMASS-376` | 35.000 | 0 | 13:25:18 — instante da venda |

A IA procurou o produto por nome **exato** (`name: { equals: item.name }`), não encontrou correspondência para "Votomassa Argamasa", e por isso **criou um produto novo** (`route.ts`, bloco `if (!product)`) com SKU gerado, `currentStock` igual à quantidade a vender, e `cost: unitPrice * 0.7` — daí os 35.000, que são exatamente 70% de 50.000.

O bloco `adjustStock(..., "Ajuste automático via IA para atender venda")`, que fabricava stock quando o produto existia mas não tinha saldo, **nunca chegou a ser executado neste incidente** — era um segundo caminho de risco, no mesmo ficheiro.

**Causa raiz: a IA remove obstáculos em vez de os comunicar.** Manifesta-se por dois caminhos — inventar o produto e inventar o stock.

Danos produzidos:
- Produto duplicado permanente para o mesmo artigo físico
- Custo inventado (35.000) que alimenta margens e lançamentos contabilísticos
- Fatura de venda 001-001-0000001, 500.000 Gs, de mercadoria que nunca existiu
- O produto real manteve as suas 3 unidades — o stock físico não foi tocado

**Atenuante:** `sifenStatus = RECIBO_COMUN` e `sifenCdc` nulo — o documento **não foi transmitido à SET**. A correção é interna.

**Mitigação aplicada em 2026-07-25**, ambos os caminhos fechados:
1. Pré-validação antes de qualquer escrita: produto inexistente faz falhar a operação, sugerindo produtos com nome semelhante em vez de criar um novo
2. Remoção do bloco de fabricação de stock, e guarda defensiva no lugar da criação de produto

`tsc --noEmit` a 0 e suite de testes verde. Não substitui o redesenho: as escritas diretas restantes (11 no STORE) mantêm-se.

### 6.2 Âmbito do problema

| Repositório | Fabricação de stock | Escritas diretas `prisma.*.create()` na rota de IA |
|---|---|---|
| STORE | sim (corrigida) | 11 |
| FARM | não | 15 |
| CLINIC | não | 10 |

O defeito específico era do STORE. **O problema estrutural — a IA escrever diretamente em vez de passar pelas server actions — está nos três.**

### 6.3 Princípios

**P1 — A IA não tem caminho de escrita próprio.** Chama as mesmas server actions que um humano, com as mesmas validações. Qualquer `prisma.*.create()` na camada de IA é, por definição, um desvio às regras de negócio.

**P2 — Falhar é um resultado válido.** "Não há stock suficiente" é a resposta correta. O trabalho da IA é comunicá-la.

**P3 — Nunca executar escritas de apoio para viabilizar a escrita pedida.** Se faltar um pré-requisito, a IA para e reporta o que falta. Nunca o cria. *Este princípio, sozinho, teria evitado o incidente.*

**P4 — A IA propõe, o humano confirma.** O comando vira uma intenção estruturada, é apresentada, e só executa com confirmação explícita.

**P5 — Privilégio mínimo por nível de risco.**

| Nível | Exemplos | Regra |
|---|---|---|
| Leitura | consultar stock, relatórios | livre |
| Escrita reversível | criar cliente, rascunho | registada |
| Consequência de negócio | ajuste de stock, criar produto | confirmação explícita |
| Fiscal / irreversível | emitir fatura, submeter à SET | confirmação explícita, nunca encadeada |

### 6.4 Arquitetura

Motor comum no núcleo (sessão, tenant, chamada ao modelo, interpretação, execução de intenções) e **ferramentas e instruções por vertical**, declaradas no manifesto de cada módulo. É o que resolve as ~914 linhas de divergência entre STORE e FARM neste ficheiro.

Auditoria — cada ação regista: comando original em texto, intenção interpretada, ações executadas, utilizador que confirmou, e versão do modelo.

**Critério de aceitação da fase:** zero `prisma.*.create()` na camada de IA; toda a escrita passa por server actions; toda a ação de nível 3 ou 4 exige confirmação; a auditoria permite reconstruir qualquer ação.

## 7. Fora de âmbito

| Item | Motivo |
|---|---|
| Conselheiro | Projeto independente (`TAVOLA`). Sai do CLINIC. |
| Multi-tenant | Projeto 2 |
| axis food | Projeto 3 |
| Model `Timbrado` com controlo de numeração | Hoje é campo de texto em `CommercialInvoice`. Problema real, especificação própria. |

## 8. Riscos

| Risco | Mitigação |
|---|---|
| Refatoração longa sem resultado visível; abandono a meio | Uma fase por vertical, cada uma verificável e concluída |
| Regressão silenciosa durante a extração | Critério de aceitação explícito por fase |
| `api/ai/route.ts` é o ficheiro mais divergente (1205/1021/785 linhas) | Fase própria e última, com desenho novo |
| Decidir mal o que é núcleo e o que é módulo | Em dúvida, começa no módulo — promover a núcleo é mais fácil do que despromover |
