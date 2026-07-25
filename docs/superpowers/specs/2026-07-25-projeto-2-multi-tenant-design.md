# Projeto 2 — Multi-tenant SaaS

**Data:** 2026-07-25
**Estado:** Aprovado, execução após o Projeto 1
**Depende de:** `2026-07-25-projeto-1-unificacao-design.md`

---

## 1. Objetivo

Permitir vender o AXIS a múltiplos clientes, cada um com a sua base de dados isolada e o seu endereço de acesso, a partir de um único deploy.

## 2. Decisão de isolamento

**Um projeto Neon por cliente**, um único deploy Vercel, subdomínio por cliente.

Foi comparado com a alternativa de base de dados partilhada com Row-Level Security. A decisão pesou:

| | Projeto por cliente | Partilhado com RLS |
|---|---|---|
| Isolamento | físico | lógico (imposto pelo Postgres) |
| Restauro de um cliente | um clique | cirurgia manual |
| Entregar dados a um cliente que sai | entrega-se o projeto | exportação seletiva |
| Migrações | ciclo sobre N bases | uma |
| Custo (uso típico de ERP) | ~$5/cliente/mês | ~$20/mês total |
| Cliente inativo | ≈ $0 (scale-to-zero) | — |

A Neon recomenda project-per-tenant para SaaS e suporta 100 projetos já no plano gratuito. O scale-to-zero elimina o custo que historicamente tornava esta opção má.

**Condição obrigatória:** `tenantId` mantém-se em todas as tabelas, mesmo com um cliente por base de dados. É tecnicamente redundante e é o seguro que torna a decisão reversível — consolidar clientes numa base partilhada passaria a ser uma cópia de dados em vez de uma reescrita.

## 3. Arquitetura de dados

### 3.1 Duas camadas

**Control plane** — um projeto Neon partilhado, o único com `DATABASE_URL` estático no ambiente. Não guarda dados de negócio.

| Campo | Função |
|---|---|
| `slug` | subdomínio (`cliente1` → `cliente1.axisstore.com`) |
| `neonProjectId` | referência ao projeto Neon |
| `connectionString` | **cifrada em repouso** |
| `status` | `PROVISIONING` / `ACTIVE` / `SUSPENDED` / `FAILED` / `MIGRATION_FAILED` |
| `vertical` | store / farm / clinic / food |
| `schemaVersion` | última migração aplicada |

Também `TenantModule` (que módulos o cliente contratou) — informação comercial, por isso vive aqui.

**Tenant DB** — um projeto Neon por cliente, com o schema unificado do Projeto 1.

Dois ficheiros de schema, `prisma/control/` e `prisma/tenant/`, gerando clientes Prisma para pastas distintas.

### 3.2 A costura

`src/lib/prisma.ts` exporta hoje um singleton global, importado por 26 ficheiros no STORE (35 no FARM, 25 no CLINIC; após a unificação, a união destes). Passa a expor uma função:

```ts
// antes:  import prisma from "@/lib/prisma"
// depois: const prisma = await getTenantDb()
```

`getTenantDb()` resolve o tenant a partir do subdomínio, obtém a connection string do control plane (com cache), e devolve um `PrismaClient` desse cliente — em cache num mapa LRU de módulo que sobrevive entre invocações quentes. Limite ~10 clientes por instância, com `$disconnect()` ao despejar. Ligações pelo endpoint `-pooler` da Neon com `connection_limit=1`.

**Alternativa rejeitada:** um proxy com `AsyncLocalStorage` que resolvesse o tenant implicitamente, mantendo os 31 ficheiros intocados. Quando essa resolução falha, o modo de falha é servir dados do cliente A ao cliente B, em silêncio. Preferem-se 31 edições explícitas.

### 3.3 Rotas

As rotas em `(dashboard)/[tenantId]/` tornam-se redundantes com o subdomínio, e contraditórias: nada impede visitar `cliente1.axisstore.com/<id-do-cliente2>/`. A estrutura mantém-se numa primeira fase, mas o middleware **rejeita** qualquer pedido em que o `[tenantId]` do caminho não coincida com o subdomínio e com a sessão.

## 4. Autenticação

### 4.1 Migração para Auth.js v5

`NEXTAUTH_URL` é, por definição, uma URL canónica única, obrigatória em produção. O NextAuth v4 não suporta hosts dinâmicos — incompatível com `*.axisstore.com`.

Auth.js v5 tem `trustHost: true`, que infere o host do pedido. A migração é pequena neste código:

1. Já existe um wrapper `auth()` e todos os call sites fazem `const session = await auth()` — que é a interface nativa do v5
2. Não há providers OAuth, apenas `CredentialsProvider`
3. Não há adapter em uso (`@auth/prisma-adapter` e `@next-auth/prisma-adapter` são dependências mortas)

Alteram-se `src/auth.ts` e `src/middleware.ts`.

### 4.2 Isolamento entre subdomínios

A defesa primária é a cookie. Por omissão é *host-only*: emitida em `cliente1.axisstore.com`, o browser nunca a envia para `cliente2.axisstore.com`.

**Regra: nunca definir `cookies.sessionToken.options.domain`.** Defini-lo como `.axisstore.com` partilharia a sessão por todos os subdomínios e criaria exatamente a falha que se pretende evitar. A documentação do NextAuth desaconselha políticas de cookie personalizadas. Justificar em comentário no código.

**Defesa em profundidade:** o JWT carrega `tenantSlug`; cada pedido compara-o com o subdomínio do `Host`. Divergência invalida a sessão.

### 4.3 Fluxo

O middleware não acede à base de dados — corre em Edge runtime, onde o Prisma não funciona. Extrai o subdomínio do `Host` e passa-o em `x-tenant-slug`. A resolução ocorre em Node runtime.

```
cliente1.axisstore.com/login
  → middleware: Host → slug → header x-tenant-slug
  → authorize(): slug → control plane → connection string → BD do cliente1
  → utilizador procurado NAQUELA base → bcrypt
  → JWT { userId, role, tenantId, tenantSlug }
  → cookie host-only
```

O mesmo email pode existir em clientes diferentes sem colisão — comportamento correto para um contabilista que serve duas empresas.

### 4.4 Correções obrigatórias

O segredo de sessão já vem do ambiente nos três repositórios (verificado em 2026-07-25). Ao migrar para Auth.js v5, manter o padrão do STORE — fallback apenas em desenvolvimento, `undefined` em produção — e acrescentar falha explícita no arranque quando o segredo estiver ausente em produção, em vez de deixar o erro surgir no primeiro login.

Slugs reservados: `www`, `api`, `app`, `admin`, `login`.

`admin.axis*.com` liga ao control plane, não a nenhuma base de cliente. É o domínio do role `SOVEREIGN`.

Contador de tentativas falhadas de login por email, com bloqueio temporário.

## 5. Provisionamento

### 5.1 `provisionTenant()`

Uma função única. O script manual é uma casca fina à volta dela; o futuro painel de administração chama a mesma função.

```ts
const { data } = await neon.projects.createAndConnect(
  { name: `axis-${slug}`, region_id: "aws-us-east-1" },
  { pooled: true }
);
// data: { project, connectionString }
```

Não é necessário tocar na API do Vercel: com domínio wildcard, `cliente7.axisstore.com` passa a funcionar assim que o tenant existe no control plane.

Passos:

1. Validar slug — formato, reservados, unicidade
2. Criar linha no control plane com `status: PROVISIONING`
3. Criar projeto Neon e **gravar `neonProjectId` imediatamente**
4. Cifrar e guardar a connection string
5. `prisma migrate deploy`
6. Semear: `Tenant`, plano de contas, `Permission`s, utilizador administrador, módulos do vertical
7. `status: ACTIVE`

### 5.2 Idempotência, não rollback

O passo 3 cria infraestrutura externa. Se um passo posterior falhar, uma reexecução ingénua criaria um segundo projeto Neon, deixando o primeiro órfão e faturável. Por isso: gravar `neonProjectId` antes de qualquer falha possível, e cada passo verifica se já foi executado.

**Nunca apagar automaticamente em caso de erro.** O tenant fica `FAILED` para inspeção manual. Uma rotina de rollback que apague projetos Neon é uma rotina que, com um bug, apaga a contabilidade de um cliente.

### 5.3 Entrega de credenciais

**Não são geradas nem enviadas passwords.**

O passo 6 cria o administrador **sem password** (`User.password` passa a `String?`) e gera um token de uso único: 32 bytes aleatórios, dos quais se guarda apenas o hash SHA-256, validade 72 horas.

```
https://cliente7.axisstore.com/setup?token=<token>
```

O cliente define a sua password; o token é queimado.

Motivo principal: este é um sistema de faturação fiscal. Numa disputa sobre a emissão de um documento, o fornecedor ter conhecido uma password válida coloca-o dentro do problema. O padrão de token de uso único permite afirmar, de forma verificável, que o fornecedor nunca teve acesso às credenciais do cliente.

O link segue pelo canal já usado com o cliente. Sendo de uso único e expirável, não exige canal cifrado.

Novo model: `PasswordSetupToken` (userId, tokenHash, expiresAt, usedAt).

## 6. Segredos por cliente

### 6.1 Estado atual

```ts
certificate: process.env.SIFEN_CERTIFICATE || "",
certificatePass: process.env.SIFEN_CERTIFICATE_PASS || "",
```

Certificado global, quando cada cliente tem o seu `.p12`, timbrado e RUC. O `|| ""` faz com que um certificado em falta produza submissão com credencial vazia e erro obscuro do lado da SET — deve falhar explicitamente.

O `SifenClient` já recebe a configuração como parâmetro, pelo que a alteração é localizada.

### 6.2 `FiscalCredential`

Model no **banco do próprio cliente**, não no control plane. O certificado é propriedade do cliente; guardá-lo na base dele significa que, se o cliente sair com o seu projeto Neon, o certificado sai com ele sem nenhuma ação do fornecedor.

Model separado do `Tenant` por necessidade operacional: os certificados renovam-se anualmente e é preciso carregar o novo antes de o antigo expirar.

Campos: `certificateCipher`, `iv`, `authTag`, `passCipher`, `validFrom`, `validUntil`, `environment`, `isActive`.

### 6.3 Cifra

**AES-256-GCM** com o módulo `crypto` do Node. GCM por ser autenticado: alteração do ciphertext faz a decifra falhar em vez de devolver lixo.

Duas chaves distintas, apenas em variáveis de ambiente do Vercel, nunca em base de dados:

| Chave | Protege |
|---|---|
| `CONNECTION_SECRET_KEY` | connection strings no control plane |
| `TENANT_SECRET_KEY` | certificados fiscais nos bancos dos clientes |

Separadas para que o comprometimento de uma base de dados renda apenas ciphertext.

*Envelope encryption* (chave por cliente embrulhada pela chave-mestra) foi considerada e adiada — complexidade sem problema correspondente à escala atual. A migração é mecânica quando for necessária.

### 6.4 Carregamento

Formulário em `/settings/fiscal`, no subdomínio do próprio cliente, acessível a `ADMIN`. O `.p12` chega por HTTPS, é cifrado em memória e escrito já cifrado. Nunca vai para disco nem para logs.

Se um cliente enviar o certificado por outro canal, a resposta correta é reenviar o link do formulário. Um certificado digital fiscal equivale à assinatura da empresa.

### 6.5 Expiração

Cron diário sobre os tenants ativos, com avisos aos 30, 14 e 7 dias, e alerta no control plane. Um certificado expirado significa um cliente sem poder faturar — o aviso automático transforma uma emergência num lembrete.

## 7. Operação

### 7.1 Migrações em N bases

Script `migrate-all.ts`: lê os tenants do control plane, decifra a connection string, corre `prisma migrate deploy`, atualiza `schemaVersion`.

- **Nunca a partir do build do Vercel** — o build não conhece a lista de clientes e as funções expiram aos 300 segundos. Migrar é um passo deliberado, corrido localmente ou por GitHub Action.
- **Paralelismo de 3 a 5**, não N. As bases estão em scale-to-zero e são acordadas uma a uma.
- **Abortar ao terceiro erro consecutivo, não ao primeiro.** Uma falha isolada é dado; três seguidas são um bug na migração.
- Tenant que falha fica `MIGRATION_FAILED` e o middleware apresenta página de manutenção.

### 7.2 Retrocompatibilidade obrigatória

Entre migrar o primeiro e o último cliente passam minutos, durante os quais **o mesmo código serve bases em versões diferentes**.

Nunca uma migração que adicione coluna obrigatória e código que a exija no mesmo deploy. Em três deploys:

1. Coluna adicionada como opcional; o código ignora-a
2. O código escreve e lê a coluna
3. Se necessário, a coluna torna-se obrigatória

É esta disciplina que torna N bases operáveis por uma pessoa.

### 7.3 Cópias de segurança

O PITR por projeto (7 dias no plano Launch) permite restaurar **um** cliente sem afetar os outros — o benefício que justifica a decisão da secção 2.

**7 dias de PITR não são arquivo.** A obrigação de conservação de documentos fiscais no Paraguai mede-se em anos; o prazo exato deve ser confirmado com um contabilista, pois define um requisito do produto.

`pg_dump` lógico mensal por cliente, arquivado fora da Neon.

### 7.4 Observabilidade

Os logs de runtime do Vercel duram 1 hora no plano Hobby e 1 dia no Pro. São inúteis para investigar na segunda-feira um problema de sexta. Erros relevantes têm de ser escritos de forma durável — `AuditLog` na base do cliente, e o control plane para erros transversais.

**`tenantSlug` em todas as linhas de log.**

O sinal mais útil é a ausência: um cliente que emite tipicamente 20 faturas por dia e hoje emitiu zero está de férias ou bloqueado. Resumo diário no control plane com, por cliente: último login, faturas emitidas, `schemaVersion`, expiração do certificado, dimensão da base.

### 7.5 Suspensão

Falta de pagamento → `status: SUSPENDED` e página de regularização. Os dados permanecem intactos. Uma base adormecida na Neon custa praticamente nada, e a contabilidade continua a ser obrigação legal do cliente.

## 8. Custos

| Fase | Composição | Total |
|---|---|---|
| Construção e demonstrações | Vercel Hobby + Neon Free + domínio | **$0/mês** |
| Primeiro cliente pagante | Vercel Pro $20 + Neon Launch ~$5 + domínio ~$1 | **~$26/mês** |
| Em crescimento | $20 fixo + ~$5 por cliente | 10 clientes ≈ $70/mês |

**Restrição não negociável:** as Fair Use Guidelines do Vercel estabelecem que *"Hobby teams are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan"*, e definem uso comercial de forma abrangente, incluindo receber pagamento pelo alojamento. O plano Hobby deixa de ser legítimo no dia da primeira cobrança.

**Plano Neon Free:** 100 projetos, 0,5 GB e 100 CU-horas por projeto, scale-to-zero ao fim de 5 minutos (não desativável), PITR de 6 horas. Para referência, as bases existentes ocupam ~31 MB.

**O que obriga a sair do plano gratuito não é o número de projetos, é o PITR de 6 horas.** Para dados fiscais, uma janela de recuperação de 6 horas é risco material: um apagamento na sexta-feira detetado na segunda é irrecuperável. O primeiro cliente pagante deve estar no plano Launch.

É admissível um modelo misto: trials e demonstrações no plano gratuito, clientes pagantes no Launch. O control plane guarda apenas a connection string e é indiferente ao plano.

## 9. Sequência de implementação

1. `prisma migrate` adotado (herdado do Projeto 1)
2. Control plane: schema, cifra, `getTenantDb()`
3. Migração para Auth.js v5 e resolução por subdomínio
4. `provisionTenant()` e script manual
5. `FiscalCredential` e formulário de carregamento
6. `migrate-all.ts` e página de manutenção
7. Resumo diário e alertas de expiração
