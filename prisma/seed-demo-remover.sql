-- Remove SÓ os três clientes de apresentação e tudo o que lhes pertence.
-- Ordem inversa das dependências. Se as contas tiverem sido usadas e tiverem
-- dados, as linhas abaixo não os apagam e o DELETE do Tenant falha — é
-- deliberado: apagar dados que alguém lançou não pode ser efeito colateral.
BEGIN;
WITH t AS (SELECT id FROM "Tenant" WHERE slug IN ('demo-store','demo-farm','demo-clinic'))
DELETE FROM "AuditLog" WHERE "tenantId" IN (SELECT id FROM t);
DELETE FROM "Warehouse"  WHERE "tenantId" IN (SELECT id FROM "Tenant" WHERE slug IN ('demo-store','demo-farm','demo-clinic'));
DELETE FROM "Permission" WHERE "tenantId" IN (SELECT id FROM "Tenant" WHERE slug IN ('demo-store','demo-farm','demo-clinic'));
DELETE FROM "Account"    WHERE "tenantId" IN (SELECT id FROM "Tenant" WHERE slug IN ('demo-store','demo-farm','demo-clinic'));
DELETE FROM "PasswordSetupToken" WHERE "userId" IN (SELECT id FROM "User" WHERE "tenantId" IN (SELECT id FROM "Tenant" WHERE slug IN ('demo-store','demo-farm','demo-clinic')));
DELETE FROM "User"       WHERE "tenantId" IN (SELECT id FROM "Tenant" WHERE slug IN ('demo-store','demo-farm','demo-clinic'));
DELETE FROM "Tenant"     WHERE slug IN ('demo-store','demo-farm','demo-clinic');
COMMIT;
