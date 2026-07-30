-- Unicidade do número de documento nas faturas de VENDA.
--
-- Requisito SIFEN: dentro do mesmo RUC, estabelecimento e ponto de emissão, o
-- número de um documento eletrónico não se repete. A SET rejeita duplicados, e
-- emitir dois documentos com o mesmo número é uma irregularidade fiscal.
--
-- Sem esta restrição, duas faturas emitidas em simultâneo recebiam o MESMO
-- número: getNextSalesInvoiceNumber lê o último e soma um, e com o isolamento
-- Read Committed do Postgres as duas leituras veem o mesmo valor.
--
-- Índice PARCIAL, só para vendas: o número de uma fatura de COMPRA vem do
-- fornecedor, e dois fornecedores diferentes podem legitimamente usar o mesmo.
CREATE UNIQUE INDEX "CommercialInvoice_tenant_sales_docnumber_key"
  ON "CommercialInvoice" ("tenantId", "documentNumber")
  WHERE "type" = 'SALES' AND "documentNumber" IS NOT NULL;
