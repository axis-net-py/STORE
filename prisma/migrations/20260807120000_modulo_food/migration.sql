-- Módulo food: restaurantes e lanchonetes.
--
-- Quatro tabelas e cinco enums. Nenhuma coluna nova nas tabelas existentes:
-- o produto continua a ser a entidade de estoque e de fatura, e o cardápio é
-- só a face dele no salão. Todas as bases têm as tabelas de todos os módulos;
-- o que decide se aparecem é `Tenant.modules` (spec Projeto 1, D4), portanto
-- esta migração corre em toda a gente sem mudar nada a quem não é do ramo.

CREATE TYPE "PreparoArea" AS ENUM ('COZINHA', 'BAR', 'CHAPA', 'SEM_PREPARO');
CREATE TYPE "MesaEstado" AS ENUM ('LIVRE', 'RESERVADA', 'INATIVA');
CREATE TYPE "ComandaTipo" AS ENUM ('MESA', 'BALCAO', 'DELIVERY');
CREATE TYPE "ComandaEstado" AS ENUM ('ABERTA', 'FECHADA', 'CANCELADA');
CREATE TYPE "ComandaItemEstado" AS ENUM ('LANCADO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO');

CREATE TABLE "RestaurantTable" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "zona" TEXT,
    "lugares" INTEGER NOT NULL DEFAULT 2,
    "estado" "MesaEstado" NOT NULL DEFAULT 'LIVRE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Comanda" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "tipo" "ComandaTipo" NOT NULL DEFAULT 'MESA',
    "estado" "ComandaEstado" NOT NULL DEFAULT 'ABERTA',
    "mesaId" TEXT,
    "customerId" TEXT,
    "pessoas" INTEGER NOT NULL DEFAULT 1,
    "servicoPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notas" TEXT,
    "invoiceId" TEXT,
    "abertaPor" TEXT,
    "abertaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Comanda_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComandaItem" (
    "id" TEXT NOT NULL,
    "comandaId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantidade" DECIMAL(10,2) NOT NULL,
    "precoUnit" DECIMAL(12,2) NOT NULL,
    "observacao" TEXT,
    "estado" "ComandaItemEstado" NOT NULL DEFAULT 'LANCADO',
    "area" "PreparoArea" NOT NULL DEFAULT 'COZINHA',
    "enviadoEm" TIMESTAMP(3),
    "prontoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ComandaItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "seccao" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "area" "PreparoArea" NOT NULL DEFAULT 'COZINHA',
    "disponivel" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RestaurantTable_tenantId_nome_key" ON "RestaurantTable"("tenantId", "nome");
CREATE INDEX "RestaurantTable_tenantId_idx" ON "RestaurantTable"("tenantId");

CREATE UNIQUE INDEX "Comanda_tenantId_numero_key" ON "Comanda"("tenantId", "numero");
CREATE INDEX "Comanda_tenantId_estado_idx" ON "Comanda"("tenantId", "estado");
CREATE INDEX "Comanda_mesaId_idx" ON "Comanda"("mesaId");

CREATE INDEX "ComandaItem_comandaId_idx" ON "ComandaItem"("comandaId");
CREATE INDEX "ComandaItem_productId_idx" ON "ComandaItem"("productId");

CREATE UNIQUE INDEX "MenuItem_productId_key" ON "MenuItem"("productId");
CREATE UNIQUE INDEX "MenuItem_tenantId_productId_key" ON "MenuItem"("tenantId", "productId");
CREATE INDEX "MenuItem_tenantId_seccao_idx" ON "MenuItem"("tenantId", "seccao");

ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "RestaurantTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cascade nos itens: apagar uma comanda cancelada não pode deixar linhas órfãs.
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "Comanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
