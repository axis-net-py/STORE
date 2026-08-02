-- Cor do design system, por cliente.
--
-- Nula por omissão: nesse caso vale a cor do vertical (src/lib/tema.ts), que é
-- a que cada um tinha antes de as três aplicações passarem a uma só build.
-- Sem coluna nova em lado nenhum e sem valor a preencher em massa — os
-- clientes existentes continuam a ver exatamente a mesma cor de sempre.
ALTER TABLE "Tenant" ADD COLUMN "themeColor" TEXT;
