-- Timbrado, código de segurança do CDC e tipo de contribuinte.
--
-- Auditoria de 2026-07-30, itens 3.2 e "modelo de timbrado".
--
-- 1. O timbrado era uma coluna de texto livre na fatura: sem validade, sem
--    intervalo de numeração e sem verificação nenhuma. A SET exige que, na
--    data de emissão, o timbrado esteja dentro da validade e o número do
--    documento dentro do intervalo autorizado. O sistema emitia alegremente
--    com um timbrado expirado, e quem responde perante a SET é o cliente.
--
-- 2. O código de segurança são 9 algarismos aleatórios que entram no CDC e no
--    QR do documento. Sem os guardar, o CDC não se consegue recalcular nem
--    conferir depois de emitido.
--
-- 3. O tipo de contribuinte ocupa a posição 25 do CDC. Sem ele o CDC não se
--    calcula. O default "2" (pessoa jurídica) é o caso comum de uma empresa;
--    quem for pessoa física corrige em Configurações › Fiscal.
--
-- Regras e mensagens em src/lib/timbrado.ts e src/lib/cdc.ts, com testes.

ALTER TABLE "Tenant" ADD COLUMN "taxpayerType" TEXT DEFAULT '2';

ALTER TABLE "CommercialInvoice" ADD COLUMN "sifenSecurityCode" TEXT;

CREATE TABLE "Timbrado" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "establishment" TEXT NOT NULL DEFAULT '001',
    "emissionPoint" TEXT NOT NULL DEFAULT '001',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "rangeFrom" INTEGER NOT NULL DEFAULT 1,
    "rangeTo" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timbrado_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Timbrado_tenantId_idx" ON "Timbrado"("tenantId");
CREATE INDEX "Timbrado_tenantId_isActive_idx" ON "Timbrado"("tenantId", "isActive");

-- Um timbrado é único por empresa e ponto de emissão. Cadastrar o mesmo número
-- duas vezes para o mesmo ponto duplicaria a numeração autorizada.
CREATE UNIQUE INDEX "Timbrado_tenantId_numero_establishment_emissionPoint_key"
  ON "Timbrado"("tenantId", "numero", "establishment", "emissionPoint");

ALTER TABLE "Timbrado" ADD CONSTRAINT "Timbrado_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
