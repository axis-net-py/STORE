# Auditoria de segurança e conformidade SIFEN — AXIS STORE

**Data:** 30 e 31 de julho de 2026
**Âmbito:** todo o código de `axis-net-py/STORE` (núcleo + módulos store, farm, clinic)
**Estado do sistema:** em desenvolvimento, sem utilizadores reais

---

## Resumo

Foram encontradas **31 falhas**, todas corrigidas e verificadas.

A conclusão inicial desta auditoria era que **o sistema não podia emitir
documentos fiscais eletrónicos no Paraguai** — não por falta de campos ou de
ecrãs, mas porque o documento seguia para a SET sem assinatura digital, sem
CDC, com o timbrado vazio e a declarar zero de IVA. Estava tudo escrito de
forma a parecer que funcionava.

Isso está resolvido no código. **Falta a homologação com a SET**, que é a única
coisa que não se consegue fazer aqui: o CDC e a assinatura seguem a
especificação e a norma, mas nunca foram confrontados com o ambiente de teste
da autoridade. É o passo obrigatório antes de emitir para um cliente real.

As falhas dividem-se em quatro famílias, e cada uma tem uma causa única:

| Família | Falhas | Causa |
|---|---|---|
| Isolamento entre clientes | 9 | `tenantId` recebido do cliente em vez de vir da sessão |
| Controlo de acesso | 7 | a matriz de permissões não era consultada nas leituras |
| Conformidade fiscal | 14 | campos por preencher, e funções que fingiam estar implementadas |
| Datas e fuso horário | 1 | o dia de um documento lido no fuso errado |

---

## 1. Isolamento entre clientes — CORRIGIDO

### A regra que faltava

No Next.js, **todos os exports de um ficheiro `'use server'` tornam-se
endpoints HTTP públicos** — não apenas os que a interface chama. Qualquer um
desses exports que recebesse o `tenantId` por parâmetro deixava o cliente
escolher de que empresa eram os dados. Bastava um pedido HTTP com outro id.

Um comentário a dizer *"esta função não é exposta ao browser"* não a tornava
privada. O que a torna privada é não estar num módulo de server actions.

### As oito

| # | Onde | O que expunha |
|---|---|---|
| 1.1 | `getCertificadoAtivo(tenantId)` | **o certificado digital e a palavra-passe de qualquer empresa, decifrados.** Um certificado fiscal equivale à assinatura da empresa |
| 1.2 | `submitInvoiceToSifen(tenantId, …)` | transmitir à SET uma fatura de outra empresa, em nome dela — um ato com efeitos legais |
| 1.3 | `getAccounts(tenantId)` | o plano de contas inteiro de outra empresa (usava `tenantId \|\| sessão`) |
| 1.4 | `logPrintAction(…, tenantId)` | escrever entradas forjadas no registo de auditoria de outra empresa |
| 1.5 | `getNextSalesInvoiceNumber(tenantId)` | a numeração fiscal de outra empresa |
| 1.6 | `fetchExchangeRatesAction(tenantId)` | já comparava com a sessão; alinhado com o resto |
| 1.7 | `SifenRetryService.processRetries` | procurava faturas pendentes **de todas as empresas** e assinava-as com o certificado de uma só |
| 1.8 | `validateDocumentAccess` | lia a fatura por `id` e só depois comparava o tenant |

Correção: o que só tem chamadores internos saiu dos módulos `'use server'`
(`lib/certificado-ativo.ts`, `lib/sifen-submit.ts`); o resto passou a derivar o
cliente da sessão. Onde a interface passa o `tenantId`, o parâmetro fica na
assinatura como `_tenantId` e é ignorado.

### A guarda que impede o regresso

`src/lib/server-actions-contrato.test.ts` varre os ficheiros `'use server'` e
falha se algum export receber `tenantId`, não for `async`, ou exportar uma
constante. Foi este teste que encontrou 1.3 e 1.4 — que a leitura manual tinha
deixado passar.

---

## 2. Controlo de acesso — CORRIGIDO

### 2.1 A matriz de permissões não valia para leitura

As consultas só verificavam que havia sessão com um cliente associado. A matriz
de `Configurações › Equipa` não tinha efeito nenhum sobre leitura: tirar
`invoices:read` ao AUDITOR não mudava nada, continuava a ver tudo.

A interface prometia um controlo que não existia. Numa fiscalização, o controlo
de acesso aos documentos fiscais tem de ser demonstrável.

**23 funções** passaram a usar `requirePermission`: clientes, fornecedores,
produtos, inventário, faturas, contabilidade, relatórios e os dois dashboards.

### 2.2 `postInvoiceToLedger` escrevia no razão sem verificar permissão

Só exigia sessão. Passa a exigir `accounting:write`.

### 2.3 O financeiro tinha um atalho próprio

`payments.ts` definia `requireTenant()`, que só verificava a sessão. Contas a
receber, contas a pagar e o resumo financeiro passavam por lá: a posição
financeira da empresa era visível a qualquer papel.

### 2.4 Autorização duplicada, e a cópia era mais permissiva

`/api/v1/invoices/[id]/generate` tinha a verificação escrita em linha, e essa
cópia continuava a dar passe livre ao ADMIN — o que `lib/authz.ts` tinha
deixado de fazer. Duas cópias de uma regra de acesso divergem sempre, e valia
a mais permissiva. A rota devolve um documento fiscal.

### 2.5 O ADMIN tinha passe livre

`requirePermission` devolvia acesso total ao ADMIN antes sequer de olhar para a
matriz, o que tornava a matriz uma declaração sem efeito para esse papel. Agora
só o SOVEREIGN passa sem consulta.

### 2.6 OPERATOR e AUDITOR ficavam trancados fora de tudo

O provisionamento semeava permissões só para SOVEREIGN e ADMIN. Com a matriz
preenchida, o recurso legado deixa de se aplicar — e os outros dois papéis
ficavam sem nada. Não basta não negar: é preciso conceder.

---

## 3. Conformidade fiscal (SIFEN)

### CORRIGIDO — 3.1 Não havia assinatura digital

`applyXMLSignature` chamava-se "aplicar assinatura" e fazia `return xml`.
Devolvia o documento **por assinar**. Todo o trabalho acima — abrir o `.p12`,
extrair a chave privada e o certificado — era decoração: a chave era extraída e
deitada fora.

A assinatura digital é o que dá valor legal ao documento eletrónico. Sem ela
não há documento fiscal; há um ficheiro XML.

Implementada em `packages/sifen/lib/assinatura.ts`, com 14 testes:
canonicalização exclusiva C14N, digest SHA-256, assinatura RSA-SHA256, e o
elemento `Signature` com `SignedInfo`, `SignatureValue` e o certificado público
em `KeyInfo/X509Data` para a SET poder verificar. A referência aponta para o
elemento `DE` pelo atributo `Id`, que é o CDC.

Os testes geram um `.p12` auto-assinado e fazem o percurso completo — assinar,
verificar, e confirmar que **alterar o total de um documento assinado invalida
a assinatura**, que é exatamente o que ela serve para impedir.

### CORRIGIDO — 3.2 O CDC não era gerado

O CDC (Código de Control, 44 dígitos) é calculado pelo emissor e vai no próprio
documento. Não existia em lado nenhum. O que havia era o `parseSifenResponse` a
extrair qualquer sequência de 44 dígitos da resposta com `/(\d{44})/` — o que
não é gerar um CDC, é procurar um número na resposta.

`src/lib/cdc.ts`, 18 testes. Os 44 algarismos com o dígito verificador por
módulo 11 — **multiplicadores 2..9, e não 2..7 como o do RUC**. São dois
algoritmos parecidos e distintos, e há um teste que os distingue, porque trocar
um pelo outro produz um CDC que a SET rejeita.

O código de segurança são 9 algarismos de `crypto.getRandomValues`, não
`Math.random`: um gerador previsível deixaria terceiros antecipar o CDC de
documentos ainda por emitir. Fica gravado em `CommercialInvoice.sifenSecurityCode`
— sem ele o CDC não se consegue recalcular nem conferir.

### CORRIGIDO — 3.2b O timbrado era texto livre

A SET exige que o timbrado esteja dentro da validade na data de emissão e que o
número do documento caia no intervalo autorizado. Nada disso era verificável:
o timbrado era uma coluna de texto na fatura. O sistema emitia alegremente com
um timbrado expirado, e quem responde perante a SET é o cliente.

Modelo `Timbrado` com validade e intervalo, regras em `src/lib/timbrado.ts` com
20 testes, e cadastro em *Configurações › Fiscal* com aviso antes de esgotar
("Expira em 19 dias", "A esgotar"). As mensagens dizem o que fazer — *"expirou
em 30/06/2026"*, *"fora do intervalo autorizado (1 a 100)"* — e não "timbrado
inválido".

### CORRIGIDO — 3.3 Declarava-se zero de IVA em todas as vendas

O mapeamento para o formato da SET descartava os dados fiscais que a fatura já
tinha guardados:

```
stamp: ""                             o timbrado ia vazio
totalIva10: 0, totalIva5: 0,          "Calculate from items"
totalExento: 0                          — nunca foi calculado
taxType: "IVA_10", taxAmount: 0       fixo, item a item
customerType: "JURIDICA"              fixo
customerDocument: … || "00000000"     documento inventado
```

Cada documento transmitido declarava zero de IVA, sem timbrado, com todos os
itens a 10% e o cliente como pessoa jurídica. As colunas `totalIva10`,
`totalIva5`, `totalExento` e `InvoiceItem.taxType/taxAmount` existem e estavam
corretamente preenchidas — só não eram lidas.

Declarar IVA a zero em todas as vendas é uma declaração falsa, com o agravante
de os nossos próprios registos dizerem outra coisa: a divergência aparece à
primeira conferência.

O mapeamento passou para `src/lib/sifen-mapa.ts`, módulo puro com 11 testes, e
**recusa** transmitir sem timbrado, sem número, sem itens ou com o documento do
cliente por preencher — em vez de os substituir por vazio e por `"00000000"`.

### CORRIGIDO — 3.4 Faturas de compra podiam ser declaradas como vendas

`documentType: type === "SALES" ? "FACTURA" : "FACTURA"` — os dois ramos iguais.
Uma fatura de compra foi emitida pelo fornecedor e já foi declarada por ele;
transmiti-la em nome desta empresa é declarar uma venda que não houve.

### CORRIGIDO — 3.5 Documentos por transmitir ficavam esquecidos em silêncio

`retryPendingSifenSubmissions` devolvia `{processed: 0, succeeded: 0, failed: 0}`
— a forma exata de uma execução bem-sucedida que não encontrou nada por fazer.
Quem a ligasse a um cron veria zeros todos os dias e concluiria que não havia
pendências, enquanto os documentos com estado `PENDING` continuavam por
declarar. Uma fatura não transmitida é uma fatura não declarada.

Falha agora em voz alta. A retransmissão real exige primeiro persistir o XML
assinado — hoje `processRetries` passa `""` como XML.

### CORRIGIDO — 3.6 Imutabilidade do documento fiscal

Um documento aceite pela SET é imutável: corrige-se com nota de crédito ou
evento de cancelamento, nunca editando o original. `assertDocumentoEditavel`
bloqueia a edição e a eliminação a partir do momento em que existe CDC ou
estado de envio. "Recibo Comum" não conta — nunca foi transmitido.

### CORRIGIDO — 3.7 Numeração de documentos

Estabelecimento e ponto de emissão vinham fixos em `001-001` em vez do cadastro
do cliente. Uma empresa com uma segunda loja emitia tudo como estabelecimento
001, o que é irregular.

A numeração lê o último e soma um, o que sob o isolamento *Read Committed* do
Postgres deixa duas emissões simultâneas lerem o mesmo valor. Quem garante a
unicidade é um índice único parcial criado por SQL — o Prisma não o consegue
exprimir — e a segunda transação falha e é repetida.

### CORRIGIDO — 3.8 Dígito verificador do RUC

O RUC era texto livre. Passou a validar o dígito verificador por módulo 11
(`src/lib/ruc.ts`, com testes), obrigatório quando o tipo de documento é RUC.

> **Por confirmar:** o algoritmo foi implementado a partir da especificação
> pública. Vale a pena testá-lo contra dois ou três RUC reais conhecidos antes
> de o pôr à frente de um cliente.

### CORRIGIDO — 3.9 Certificado em falta produzia erro obscuro

Um `|| ""` fazia uma submissão com credencial vazia, falhando do lado da SET
com uma mensagem incompreensível. Agora falha aqui, com instruções.

### CORRIGIDO — 3.10 Cancelamento local divergia da SET

Cancelar localmente um documento já declarado deixa-o ativo na SET e cancelado
cá. A integração não suporta o evento de cancelamento; a divergência passou a
ficar registada em vez de acontecer em silêncio.

### CORRIGIDO — 3.11 A IA inventava dados

O assistente tinha caminho de escrita próprio e criava produtos que não
existiam — foi assim que emitiu uma fatura de 10 unidades de um produto com 3
em stock. Toda a escrita passa agora pelas mesmas server actions que um humano
usa, com validação, permissões e auditoria. `no-direct-writes.test.ts` recusa
qualquer `prisma.*.create/update/delete` na camada de IA.

### CORRIGIDO — 3.12 Referências cruzadas entre clientes

Era possível emitir uma fatura com o `customerId` de outra empresa: o documento
ficava no cliente certo mas mostrava o nome e o RUC de uma pessoa alheia.

### CORRIGIDO — 3.13 A base tributável era o próprio imposto

No XML, `dTotGrav10` recebia `totalIva10` — o **valor do IVA** — e `dTotIVA`
somava logo a seguir esses mesmos valores. A base tributável e o imposto não
podem ser o mesmo número; era incoerente antes de ser sequer uma questão de
conformidade. Passa a ser somada a partir dos itens.

### CORRIGIDO — 3.14 Produtos sem validação nenhuma

`createProduct` e `updateProduct` não validavam. Existia um `ProductSchema` e
nunca era chamado; havia um segundo `ProductFormData` escrito à mão, com um
comentário a avisar que "podem divergir". Divergiam.

Os parâmetros de uma server action chegam por HTTP: o tipo do TypeScript
desaparece na compilação e não protege nada em tempo de execução.
`createProduct({ price: -100 })` ia direto para o banco, e um preço negativo
distorce todas as faturas que usem o produto e o razão que delas resulta. Nada
impedia `taxType: "IVA_0"` de ser gravado.

---

## 3b. Datas e fuso horário — CORRIGIDO

O Paraguai está em UTC−3 o ano inteiro, e o JavaScript trata a mesma string de
duas maneiras conforme quem a escreveu. `new Date('2026-08-01')` — o que um
`<input type="date">` produz — é 31 de julho às 21h em Assunção.

Nem UTC nem hora local estão certos isoladamente, porque chegam **duas coisas
diferentes**: uma data de calendário escolhida por uma pessoa, e um instante do
relógio. A distinção é observável — uma data de calendário aterra exatamente na
meia-noite UTC. É essa a regra em `src/lib/fuso.ts`, com 11 testes.

Onde tinha consequência:

- **`assertPeriodOpen`** — era o defeito conhecido, marcado com `test.todo`. O
  dia 1 de cada mês caía no mês anterior: fechado julho, uma fatura de 1 de
  agosto era recusada.
- **O CDC** — a data de emissão são 8 dos seus 44 algarismos.
- **A apresentação** — apanhado ao verificar a tabela de timbrados no browser:
  um timbrado gravado como válido até 31/12/2026 aparecia como **30/12/2026**.
  `toLocaleDateString` converte para o fuso do navegador. Corrigido na validade
  do timbrado e do certificado, nos vencimentos do financeiro (um dia muda se o
  título está em atraso) e na data de emissão da fatura impressa.
- **`next-intl`** — não tinha fuso global configurado e avisava em todos os
  pedidos: o servidor formatava em UTC e o navegador no fuso do utilizador.

---

## 4. Autenticação e superfície exposta — CORRIGIDO

| # | Falha |
|---|---|
| 4.1 | Sessão sem expiração prática. Agora 12 h, renovada de hora a hora |
| 4.2 | Email não normalizado no login: `Ana@x.com` e `ana@x.com` eram contas diferentes |
| 4.3 | Upload sem lista de tipos aceites nem limite. Agora allowlist de MIME, 4 MB, e a extensão vem do tipo validado e não do nome do ficheiro enviado |
| 4.4 | Mensagens de erro que distinguiam "não existe" de "não é seu" — o que confirma a existência de registos de outra empresa. Agora são iguais |
| 4.5 | Rebaixar o último SOVEREIGN deixava a conta sem dono, sem ninguém que pudesse gerir utilizadores |
| 4.6 | `seedDefaultPermissions` concedia as 21 ações a todos os papéis, incluindo apagar e gerir utilizadores — um clique dava ao AUDITOR, que é quem confere, o poder de apagar faturas |
| 4.7 | `/api/invoices/[id]/pdf` sem guarda própria: um pedido sem sessão devolvia 500 com a pilha de erro do Next |
| 4.8 | As server actions de um módulo verificavam a permissão mas não se o módulo estava contratado. O guarda de rotas fecha o URL; as ações continuavam chamáveis por HTTP, e o SOVEREIGN passa sem consultar a matriz — o dono de um cliente só-store chamava as ações do farm |

---

## 5. O que falta fazer

### Antes de emitir para um cliente real

1. **Homologação com a SET.** O CDC e a assinatura seguem a especificação e a
   norma XMLDSig, e os testes provam a mecânica — mas nunca foram confrontados
   com o ambiente de teste da autoridade. Submeter um documento em homologação
   e confirmar que o CDC e a assinatura são aceites. **É a única coisa que não
   se consegue verificar a partir do código.**
2. **Validar o XML contra o XSD v150.** A estrutura foi corrigida no que era
   demonstravelmente incoerente (timbrado vazio, IVA a zero, base tributável
   igual ao imposto), mas a ordem e os nomes dos elementos só se confirmam
   contra o esquema publicado.
3. **Evento de cancelamento à SET** (ver 3.10). Hoje o cancelamento é local e a
   divergência fica registada.
4. **Persistir o XML assinado**, sem o qual não há retransmissão (3.5).
5. **Confirmar o algoritmo do RUC** contra RUC reais conhecidos (3.8).

### Do lado da operação

- Definir em produção: `TENANT_SECRET_KEY`, `CRON_SECRET`,
  `CONNECTION_SECRET_KEY`, `CONTROL_PLANE_DATABASE_URL`
- Trocar as palavras-passe fracas que ficaram do desenvolvimento
- Comprar o domínio, para os subdomínios por cliente ficarem ativos
- **Cadastrar o timbrado de cada cliente** em *Configurações › Fiscal*, e
  corrigir o RUC da empresa se for de teste — sem os dois não há emissão, por
  desenho

### Conhecido e aceite por agora

- Migração para Auth.js v5 desenhada, à espera do domínio
- Uma fatura marcada como eletrónica fica imutável assim que é criada, mesmo
  que a transmissão falhe: o número e o CDC já foram consumidos. É o
  comportamento correto para um documento fiscal, mas convém saber que é assim
- A agenda do módulo clinic mostra instantes reais no fuso do navegador, o que
  ali é o que se quer — não foi alterada com o resto das datas

---

## Verificação

Cada correção foi verificada por código de saída, não por leitura do resultado:

```
npx tsc --noEmit     0
npm test             284 testes, 284 passam, 0 falham
npm run build        0
npm run check:i18n   0
```

O cadastro de timbrado foi verificado no browser: renderiza, ordena por
validade, os avisos aparecem, e as datas batem certo com o que está gravado —
foi assim que apareceu o defeito de fuso na apresentação (3b).

Testes novos desta auditoria: `cdc.test.ts` (18), `timbrado.test.ts` (20),
`assinatura.test.ts` (14), `sifen-mapa.test.ts` (11), `fuso.test.ts` (11),
`produto.test.ts` (10), `server-actions-contrato.test.ts` (4), mais os do
módulo (6), `ruc.test.ts`, `permissoes-nucleo.test.ts`,
`numeracao-fiscal.test.ts` e `documento-fiscal.test.ts`.

Dois deles encontraram falhas que a leitura manual tinha deixado passar:
`server-actions-contrato.test.ts` apanhou o plano de contas e o registo de
auditoria expostos, e a verificação no browser apanhou o erro de data.
