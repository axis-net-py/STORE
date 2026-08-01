# Auditoria de segurança e conformidade SIFEN — AXIS STORE

**Data:** 30 e 31 de julho de 2026
**Âmbito:** todo o código de `axis-net-py/STORE` (núcleo + módulos store, farm, clinic)
**Estado do sistema:** em desenvolvimento, sem utilizadores reais

---

## Resumo

Foram encontradas **26 falhas**, das quais 24 estão corrigidas e verificadas.
Duas ficam em aberto por exigirem trabalho que ultrapassa uma auditoria — e
são, de longe, as mais graves.

A conclusão que interessa é esta: **o sistema ainda não pode emitir documentos
fiscais eletrónicos no Paraguai.** Não por falta de campos ou de ecrãs, mas
porque o documento seguia para a SET sem assinatura digital, com o timbrado
vazio e a declarar zero de IVA. Estava tudo escrito de forma a parecer que
funcionava.

As falhas dividem-se em três famílias, e cada uma tem uma causa única:

| Família | Falhas | Causa |
|---|---|---|
| Isolamento entre clientes | 8 | `tenantId` recebido do cliente em vez de vir da sessão |
| Controlo de acesso | 6 | a matriz de permissões não era consultada nas leituras |
| Conformidade fiscal | 12 | campos por preencher, e funções que fingiam estar implementadas |

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

### ABERTO — 3.1 Não há assinatura digital

`applyXMLSignature` chamava-se "aplicar assinatura" e fazia `return xml`.
Devolvia o documento **por assinar**. Todo o trabalho acima — abrir o `.p12`,
extrair a chave privada e o certificado — era decoração: a chave era extraída e
deitada fora.

A assinatura digital é o que dá valor legal ao documento eletrónico. Sem ela
não há documento fiscal; há um ficheiro XML.

**Já não transmite:** a função passa a lançar. A venda continua a ser gravada,
o documento fica por transmitir de forma visível, e ninguém entrega o sistema a
um cliente a acreditar que emite faturas eletrónicas válidas.

**Falta implementar:** XMLDSig conforme o Manual Técnico da SET — canonicalização
C14N, digest SHA-256, assinatura RSA da chave do `.p12`, e o elemento
`Signature` com `SignedInfo`, `SignatureValue` e `KeyInfo/X509Certificate`. O
`node-forge` sozinho não faz XMLDSig.

> Esta é a condição de entrada. Enquanto não estiver feita, nada mais no SIFEN
> tem efeito prático.

### ABERTO — 3.2 O CDC não é gerado

O CDC (Código de Control, 44 dígitos) é calculado pelo emissor e vai no próprio
documento. Não existe em lado nenhum do código. O que existe é o
`parseSifenResponse` a extrair qualquer sequência de 44 dígitos da resposta com
`/(\d{44})/` — o que não é gerar um CDC, é procurar um número na resposta.

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

---

## 5. O que falta fazer

### Antes de vender a alguém

1. **Assinatura digital XMLDSig** (3.1) — condição de entrada
2. **Geração do CDC** (3.2)
3. **Modelo de timbrado** — hoje é texto livre no documento. A SET exige que o
   timbrado seja válido na data de emissão e que o número esteja dentro do
   intervalo autorizado. Nada disso é verificável sem guardar validade e
   intervalo. Sem isto, o sistema emite alegremente com um timbrado expirado, e
   quem responde é o cliente
4. **Evento de cancelamento à SET** (ver 3.10)
5. **Persistir o XML assinado**, sem o qual não há retransmissão (3.5)
6. **Confirmar o algoritmo do RUC** contra RUC reais (3.8)

### Do lado da operação

- Definir em produção: `TENANT_SECRET_KEY`, `CRON_SECRET`,
  `CONNECTION_SECRET_KEY`, `CONTROL_PLANE_DATABASE_URL`
- Trocar as palavras-passe fracas que ficaram do desenvolvimento
- Comprar o domínio, para os subdomínios por cliente ficarem ativos

### Conhecido e aceite por agora

- `assertPeriodOpen` compara datas em UTC e não no fuso do Paraguai: um
  lançamento feito nas últimas horas do dia 31 pode cair no mês seguinte
  (`test.todo` no sítio)
- As ações dos módulos verificam permissão mas não verificam se o módulo está
  contratado. Um SOVEREIGN de um cliente só-store consegue chamar uma ação do
  farm — e ver os seus próprios dados vazios. É uma questão comercial, não de
  segurança
- Migração para Auth.js v5 desenhada, à espera do domínio
- `ProductFormData` está duplicado entre `lib/schemas` e `actions/product.ts`

---

## Verificação

Cada correção foi verificada por código de saída, não por leitura do resultado:

```
npx tsc --noEmit     0
npm test             204 testes, 203 passam, 1 todo, 0 falham
npm run build        0
npm run check:i18n   0
```

Os testes novos desta auditoria: `server-actions-contrato.test.ts` (4),
`sifen-mapa.test.ts` (11), `ruc.test.ts`, `permissoes-nucleo.test.ts`,
`numeracao-fiscal.test.ts`, `documento-fiscal.test.ts`.
