-- Contas de apresentação — store, farm e clinic. LIMPAS.
--
-- Cria três clientes, um por vertical, cada um com o administrador, o plano
-- de contas, a matriz de permissões e o depósito principal — exatamente o
-- que `provisionTenant()` cria para um cliente pago no primeiro dia. Nem um
-- produto, nem um cliente, nem uma fatura inventada.
--
-- Fica por preencher, de propósito, tudo o que é do cliente: RUC, morada,
-- atividade económica, timbrado, certificado. São dados fiscais reais.
--
--   psql "$DATABASE_URL" -f prisma/seed-demo.sql
--
-- Tudo numa transação: ou entra inteiro, ou não entra nada. Se os clientes já
-- existirem, a primeira instrução falha na chave única e reverte.
--
-- Senha das três contas: Axis@Demo2026   (papel SOVEREIGN)
-- Para remover: prisma/seed-demo-remover.sql

BEGIN;
INSERT INTO public."Tenant" (id, name, "businessName", ruc, "tradeName", establishment, "emissionPoint", address, "economicActivity", "createdAt", "updatedAt", modules, slug, "taxpayerType") VALUES
	('cmsc0j7li00007du5xyrdc60i', 'AXIS Store — Demo', 'AXIS Store — Demo', NULL, NULL, '001', '001', NULL, NULL, '2026-08-02 16:26:45.942', '2026-08-02 16:26:45.942', '{store}', 'demo-store', '2'),
	('cmsc0j81c002h7du5hw0xvm92', 'AXIS Farm — Demo', 'AXIS Farm — Demo', NULL, NULL, '001', '001', NULL, NULL, '2026-08-02 16:26:46.513', '2026-08-02 16:26:46.513', '{farm}', 'demo-farm', '2'),
	('cmsc0j8ef004y7du5hgcxz6lm', 'AXIS Clinic — Demo', 'AXIS Clinic — Demo', NULL, NULL, '001', '001', NULL, NULL, '2026-08-02 16:26:46.983', '2026-08-02 16:26:46.983', '{clinic}', 'demo-clinic', '2');
INSERT INTO public."User" (id, email, name, password, role, "tenantId", "emailVerified", "mustChangePassword", "createdAt") VALUES
	('cmsc0j7m700027du5j0py9t5s', 'demo@axisstore.com', 'Demonstração Store', '$2b$12$PREvk9CdxVOC9LeMkaZuguDq1BDrJnEL3vdtEgyg.TWzPs/UYhudG', 'SOVEREIGN', 'cmsc0j7li00007du5xyrdc60i', NULL, false, '2026-08-02 16:26:45.967'),
	('cmsc0j81e002j7du595lk9gzl', 'demo@axisfarm.com', 'Demonstração Farm', '$2b$12$pUy9CMrIM80S8iR/9qw6u.kC87MmIlZ44rOy6CQs3V/EFUNBO/UJW', 'SOVEREIGN', 'cmsc0j81c002h7du5hw0xvm92', NULL, false, '2026-08-02 16:26:46.514'),
	('cmsc0j8eg00507du5ppy3qag9', 'demo@axisclinic.com', 'Demonstração Clinic', '$2b$12$5YUlwqkZ4VWE/2g19qAQUekQc7qcH7UYToJ.lv1FZln4bUr13aVI2', 'SOVEREIGN', 'cmsc0j8ef004y7du5hgcxz6lm', NULL, false, '2026-08-02 16:26:46.984');
INSERT INTO public."Warehouse" (id, "tenantId", name, code, "isDefault", "isActive", "createdAt") VALUES
	('cmsc0j7n0002e7du5dj9rzmmv', 'cmsc0j7li00007du5xyrdc60i', 'Depósito Principal', 'MAIN', true, true, '2026-08-02 16:26:45.997'),
	('cmsc0j81r004v7du59r1le9yz', 'cmsc0j81c002h7du5hw0xvm92', 'Depósito Principal', 'MAIN', true, true, '2026-08-02 16:26:46.527'),
	('cmsc0j8ey007c7du5jry1o81s', 'cmsc0j8ef004y7du5hgcxz6lm', 'Depósito Principal', 'MAIN', true, true, '2026-08-02 16:26:47.002');
INSERT INTO public."Account" (id, "tenantId", code, "namePt", "nameEs", type, "isActive")
SELECT gen_random_uuid()::text, t.id, c.code, c.pt, c.es, c.tipo::"AccountType", true
FROM public."Tenant" t,
 (VALUES
  ('1.1.01','Caixa','Caja','ASSET'),
  ('1.1.02','Bancos','Bancos','ASSET'),
  ('1.2.01','Clientes','Clientes','ASSET'),
  ('1.2.02','Estoque','Inventario','ASSET'),
  ('2.1.01','Fornecedores','Proveedores','LIABILITY'),
  ('2.2.01','IVA Crédito','IVA Crédito','LIABILITY'),
  ('2.2.02','IVA Débito','IVA Débito','LIABILITY'),
  ('3.1.01','Capital Social','Capital Social','EQUITY'),
  ('4.1.01','Receita de Vendas','Ingresos por Ventas','REVENUE'),
  ('5.1.01','Custo das Mercadorias','Costo de Mercancías','EXPENSE'),
  ('5.2.01','Despesas Operacionais','Gastos Operativos','EXPENSE')
 ) AS c(code, pt, es, tipo)
WHERE t.slug IN ('demo-store','demo-farm','demo-clinic');
INSERT INTO public."Permission" (id, "tenantId", action, role)
SELECT gen_random_uuid()::text, x."tenantId", x.action, x.role::"Role" FROM (
  SELECT t.id AS "tenantId", a.action, r.role
  FROM public."Tenant" t,
   (VALUES ('dashboard:read'),('customers:read'),('customers:write'),('customers:delete'),
           ('suppliers:read'),('suppliers:write'),('suppliers:delete'),
           ('products:read'),('products:write'),('products:delete'),
           ('invoices:read'),('invoices:write'),('invoices:delete'),
           ('inventory:read'),('inventory:write'),
           ('accounting:read'),('accounting:write'),
           ('reports:read'),('settings:read'),('settings:write'),('users:manage')) AS a(action),
   (VALUES ('SOVEREIGN'),('ADMIN'),('OPERATOR'),('AUDITOR')) AS r(role)
  WHERE t.slug IN ('demo-store','demo-farm','demo-clinic')
    AND ( r.role = 'SOVEREIGN'
       OR (r.role = 'ADMIN'    AND a.action NOT LIKE '%:delete' AND a.action <> 'users:manage')
       OR (r.role = 'OPERATOR' AND a.action NOT LIKE '%:delete' AND a.action NOT IN ('users:manage','settings:write'))
       OR (r.role = 'AUDITOR'  AND a.action LIKE '%:read') )
  UNION ALL
  SELECT t.id, m.modulo || s.sufixo, r.role
  FROM public."Tenant" t
  CROSS JOIN LATERAL (SELECT unnest(t.modules) AS modulo) m
  CROSS JOIN (VALUES (':read'),(':write'),(':delete')) AS s(sufixo)
  CROSS JOIN (VALUES ('SOVEREIGN'),('ADMIN'),('OPERATOR'),('AUDITOR')) AS r(role)
  WHERE t.slug IN ('demo-store','demo-farm','demo-clinic')
    AND ( r.role = 'SOVEREIGN'
       OR (r.role IN ('ADMIN','OPERATOR') AND s.sufixo <> ':delete')
       OR (r.role = 'AUDITOR' AND s.sufixo = ':read') )
) x;
INSERT INTO public."AuditLog" (id, "tenantId", "userId", action, entity, "entityId", details, "createdAt") VALUES
	('cmsc0j7n4002g7du5nh153bvn', 'cmsc0j7li00007du5xyrdc60i', NULL, 'PROVISION_TENANT', 'Tenant', 'cmsc0j7li00007du5xyrdc60i', '{"nome": "AXIS Store — Demo", "slug": "demo-store", "modulos": ["store"], "vertical": "store", "emailAdmin": "demo@axisstore.com"}', '2026-08-02 16:26:46'),
	('cmsc0j81s004x7du5h3dd8wqg', 'cmsc0j81c002h7du5hw0xvm92', NULL, 'PROVISION_TENANT', 'Tenant', 'cmsc0j81c002h7du5hw0xvm92', '{"nome": "AXIS Farm — Demo", "slug": "demo-farm", "modulos": ["farm"], "vertical": "farm", "emailAdmin": "demo@axisfarm.com"}', '2026-08-02 16:26:46.529'),
	('cmsc0j8ez007e7du5n5sc059q', 'cmsc0j8ef004y7du5hgcxz6lm', NULL, 'PROVISION_TENANT', 'Tenant', 'cmsc0j8ef004y7du5hgcxz6lm', '{"nome": "AXIS Clinic — Demo", "slug": "demo-clinic", "modulos": ["clinic"], "vertical": "clinic", "emailAdmin": "demo@axisclinic.com"}', '2026-08-02 16:26:47.004');
COMMIT;
