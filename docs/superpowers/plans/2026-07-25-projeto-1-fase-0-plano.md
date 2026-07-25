# Projeto 1 · Fase 0 — Plano de Implementação

**Data:** 2026-07-25
**Especificação:** `../specs/2026-07-25-projeto-1-unificacao-design.md`
**Repositório alvo:** `axis-net-py/STORE` (a renomear para `AXIS` — decisão D9)

## Estado de execução (2026-07-25)

| Etapa | Estado |
|---|---|
| 0 — Descoberta | ✅ concluída |
| 1 — Inventário | ✅ concluída → `../inventario-divergencias.md` |
| 2 — Alvo e deriva | ✅ base identificada (`axis-stellium`), **sem deriva** |
| 3 — Baseline | ✅ `0_init` aplicado, dados intactos |
| 4 — Migrações | ✅ shadow database criada (`axis-shadow-dev`); `migrate dev` a estrear na Fase 1 |
| 5 — Renomear repositório | ⏳ manual, pendente |
| 6 — Verificação final | ✅ exceto a eliminação da pasta `AXIS/COOPER` |

**Base de dados de produção identificada:** projeto Neon `axis-stellium` (`restless-feather-49985514`), org "Vercel: AXIS NET PY". Confirmada pelas tabelas exclusivas do STORE (`Order`, `Payment`, `Warehouse`, `AccountingPeriod`).

**Ponto de restauro:** branch Neon `backup-antes-limpeza-2026-07-25` (`br-snowy-moon-ann6jhn3`), criado antes da limpeza dos dados fantasma.

---

## Fase 0 — Descoberta (concluída)

Factos verificados em 2026-07-25 contra o CLI instalado e a documentação oficial. **Não assumir nada para além desta lista.**

### Versões

| Item | Valor | Fonte |
|---|---|---|
| `@prisma/client` | 6.19.3 | `package.json:16` |
| `prisma` (CLI) | ^6.8.2 | `package.json:61` |
| `next-auth` | ^4.24.8 | `package.json` (idêntico em FARM e CLINIC) |

### APIs permitidas

```bash
# Gerar SQL de baseline a partir do schema
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script

# Detetar deriva entre a base de dados real e o schema
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script

# Marcar uma migração como já aplicada
npx prisma migrate resolve --applied 0_init

# Aplicar migrações pendentes (produção)
npx prisma migrate deploy

# Estado das migrações
npx prisma migrate status
```

### Anti-padrões — não usar

| Não fazer | Porquê |
|---|---|
| `--to-schema` | **Não existe.** A página `prisma.io/docs/orm/prisma-migrate/getting-started` indica este flag; o CLI real exige `--to-schema-datamodel`. Verificado com `migrate diff --help`. |
| `prisma migrate dev` contra a base de produção | Cria e apaga uma shadow database, e pode propor `reset`. Só em base local ou branch descartável. |
| `prisma db push` depois do baseline | Reintroduz o problema que esta fase resolve: altera a base sem registar a migração. |
| `prisma migrate reset` | Apaga todos os dados. |

### Shadow database

- **Não é necessária** para `migrate diff`, `migrate resolve` nem `migrate deploy` — a documentação é explícita: *"The shadow database is not required in production, and is not used by production-focused commands."*
- **É necessária** para `migrate dev`, que será o comando usado para criar migrações a partir da Etapa 4.
- No Neon, configurar via `SHADOW_DATABASE_URL`. Aviso da documentação: nunca usar o mesmo valor de `url` e `shadowDatabaseUrl` — apagaria os dados.

### Observação lateral

O CLI avisa que `package.json#prisma` (onde está `"seed": "npx tsx prisma/seed.ts"`, linha 66-68) está deprecado e será removido no Prisma 7, devendo migrar para `prisma.config.ts`. **Fora do âmbito desta fase**; registar como dívida.

---

## Etapa 1 — Inventário sistemático de divergências

**Objetivo:** produzir a lista completa do que existe num fork e falta nos outros. O objetivo não é confirmar os itens já conhecidos, é encontrar os que ainda não conhecemos.

### O que fazer

1. Para cada par de repositórios, listar os ficheiros presentes num e ausentes no outro:

```bash
cd C:/Users/Allan/Desktop/AXIS/repos
for r in STORE FARM CLINIC; do
  (cd $r && find src -type f \( -name '*.ts' -o -name '*.tsx' \) | sort > "../$r.files")
done
comm -23 STORE.files FARM.files   # só no STORE
comm -13 STORE.files CLINIC.files # só no CLINIC
```

2. Classificar **cada** ficheiro exclusivo numa de três categorias:

| Categoria | Destino |
|---|---|
| **Núcleo** — devia existir nos três | Recuperar na Fase 4 |
| **Vertical** — pertence a um módulo | Move para `src/modules/<vertical>/` |
| **Morto** — resíduo de fork, sem uso | Eliminar |

3. Comparar os models exclusivos de cada `schema.prisma` pela mesma classificação.

4. Para ficheiros com o mesmo caminho e conteúdo diferente, verificar se a divergência é funcional ou apenas de marca/idioma.

### Referências

- Divergências já identificadas: `../specs/2026-07-25-axis-arquitetura-linha-produtos.md`, secção 2.2
- Diretórios de cada vertical: mesma especificação, secção 3.2

### Entregável

`docs/superpowers/inventario-divergencias.md` — tabela com colunas: ficheiro/model · existe em · falta em · categoria · destino · notas.

### Verificação

- [ ] Todo ficheiro exclusivo a um repositório aparece no inventário, sem exceções
- [ ] Nenhuma linha tem a categoria por preencher
- [ ] Os cinco itens já conhecidos (`change-password`, `User.mustChangePassword`, `lib/authz.ts`, `AccountingPeriod`, `Payment`, `actions/account.ts`) constam classificados como Núcleo
- [ ] O padrão de segredo só-dev do `STORE/src/auth.ts:84-88` consta como Núcleo a propagar

### Guardas

- Não corrigir nada nesta etapa. É inventário, não execução. A recuperação acontece na Fase 4.
- Não classificar como "Morto" sem confirmar por `grep` que nada o importa.

---

## Etapa 2 — Confirmar o alvo e detetar deriva

**Esta etapa existe porque o procedimento da documentação assume que o schema corresponde à base de dados. Com `db push`, essa premissa pode ser falsa — e um baseline sobre um schema que não corresponde à realidade produz migrações erradas para sempre.**

### O que fazer

1. Confirmar a que base de dados o `DATABASE_URL` do `.env` local aponta. O `.env` não está versionado (só existe `.env.example`). **Confirmar explicitamente que é a base do STORE e não a de outro produto.**

2. Detetar deriva entre a base real e o schema:

```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

3. Interpretar:
   - **Saída vazia** → base e schema coincidem. Avançar para a Etapa 3.
   - **Saída não vazia** → existe deriva. **Parar.** Analisar cada diferença e decidir, caso a caso, se o schema está certo (e a base precisa de ser alinhada) ou o contrário. Só depois avançar.

### Verificação

- [ ] O `DATABASE_URL` alvo está confirmado e registado
- [ ] O comando de deriva produz saída vazia, ou a deriva foi resolvida e documentada

### Guardas

- Não avançar para a Etapa 3 com deriva por resolver.
- Não "resolver" deriva com `db push` — corrige a base mas mantém o problema estrutural.

---

## Etapa 3 — Baseline do Prisma Migrate

### O que fazer

1. Criar a estrutura. O prefixo `0_` é obrigatório: a documentação especifica *"use a prefix of `0_` so that Prisma migrate applies migrations in a lexicographic order"*.

```bash
mkdir -p prisma/migrations/0_init
```

2. Gerar o SQL de baseline:

```bash
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
```

3. **Rever o SQL gerado.** Confirmar que contém `CREATE TABLE` para os 21 models do STORE e nenhum `DROP`.

4. Marcar como aplicada, para que o Prisma não tente recriar tabelas que já existem:

```bash
npx prisma migrate resolve --applied 0_init
```

5. Confirmar o estado:

```bash
npx prisma migrate status
```

### Verificação

- [ ] `prisma/migrations/0_init/migration.sql` existe e contém as tabelas do schema
- [ ] O SQL não contém nenhum `DROP TABLE`
- [ ] `migrate status` reporta a base de dados atualizada, sem migrações pendentes
- [ ] A tabela `_prisma_migrations` existe na base e tem uma linha `0_init`
- [ ] **Os dados continuam lá** — contagem de registos em `CommercialInvoice` e `Product` igual à de antes
- [ ] `npx tsc --noEmit` continua com saída 0

### Guardas

- Nunca correr `migrate dev` nesta etapa.
- Se `migrate resolve` falhar, **não** tentar `migrate reset`.

---

## Etapa 4 — Passar a usar migrações

### O que fazer

1. Configurar `SHADOW_DATABASE_URL` para desenvolvimento. No Neon, criar uma base de dados dedicada ou uma branch descartável — **nunca o mesmo valor de `DATABASE_URL`**.

2. Adicionar ao `.env.example` a nova variável, documentada.

3. Substituir qualquer uso de `db push` no fluxo de trabalho:
   - Criar migração (local): `npx prisma migrate dev --name <descricao>`
   - Aplicar (produção): `npx prisma migrate deploy`

4. Registar no `README.md` que `db push` está proibido neste repositório e porquê.

### Verificação

- [ ] `SHADOW_DATABASE_URL` configurada e diferente de `DATABASE_URL`
- [ ] Uma migração de teste criada com `migrate dev` numa base descartável, aplicada e revertida com sucesso
- [ ] `grep -rn "db push" .` não devolve instruções ativas

---

## Etapa 5 — Renomear o repositório

**Ação manual, fora do alcance das ferramentas locais** (não há `gh` CLI instalado) e com efeito externo — a fazer por ti, na interface do GitHub.

1. `axis-net-py/STORE` → `axis-net-py/AXIS`
2. Atualizar o remote local: `git remote set-url origin https://github.com/axis-net-py/AXIS.git`
3. Atualizar o projeto Vercel `axisretail` para apontar ao repositório renomeado
4. `FARM` e `CLINIC` mantêm-se ativos até serem extraídos (Fases 2 e 3). **Não arquivar agora.**

O GitHub mantém redirecionamento do nome antigo, pelo que a operação é de baixo risco.

---

## Etapa 6 — Verificação final da fase

- [ ] `docs/superpowers/inventario-divergencias.md` existe, completo e revisto
- [ ] `prisma/migrations/0_init/migration.sql` versionado
- [ ] `npx prisma migrate status` reporta base atualizada
- [ ] Dados intactos (contagens conferidas antes/depois)
- [ ] `npx tsc --noEmit` com saída 0
- [ ] `npm run build` conclui sem erros
- [ ] A aplicação arranca e o login funciona
- [ ] Nada de `db push` no fluxo documentado
- [ ] Pasta local `AXIS/COOPER` eliminada (decisão D10)

---

## Fora do âmbito desta fase

| Item | Onde pertence |
|---|---|
| Baseline das bases de dados de FARM e CLINIC | Fases 2 e 3 |
| Recuperar as funcionalidades presas | Fase 4 |
| Reestruturar `src/` em `core/` + `modules/` | Fase 1 |
| Migrar `package.json#prisma` para `prisma.config.ts` | Dívida registada |
| Assistente de IA | Fase 5 |

## Riscos

| Risco | Mitigação |
|---|---|
| Deriva entre schema e base de dados invalida o baseline | Etapa 2 é bloqueante e precede a Etapa 3 |
| `DATABASE_URL` apontar à base errada | Confirmação explícita na Etapa 2, passo 1 |
| Perda de dados durante o baseline | `migrate diff` é read-only; `migrate resolve` só escreve em `_prisma_migrations`; verificação de contagens na Etapa 3 |
| Regressão para `db push` por hábito | Documentado no README e verificado por `grep` na Etapa 4 |
