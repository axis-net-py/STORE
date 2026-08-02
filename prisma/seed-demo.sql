-- Contas e dados de demonstração — store, farm e clinic.
--
-- Mesmo conteúdo que `npx tsx prisma/seed-demo.ts` produz; esta é a via para
-- quem só tem acesso por SQL. Correr uma vez, numa base já migrada:
--
--   psql "$DATABASE_URL" -f prisma/seed-demo.sql
--
-- Tudo numa transação: ou entra inteiro, ou não entra nada. Se os clientes já
-- existirem, a primeira instrução falha na chave única do slug e reverte.
--
-- As tabelas deriváveis (plano de contas, permissões, saldos por depósito,
-- movimentos de estoque, recebimentos e as linhas dos lançamentos) são
-- geradas por SELECT em vez de literais: menos linhas para conferir, e ficam
-- coerentes com os ids que a própria base atribuir.
--
-- Para remover: prisma/seed-demo-remover.sql

BEGIN;
INSERT INTO public."Tenant" (id, name, "businessName", ruc, "tradeName", establishment, "emissionPoint", address, "economicActivity", "createdAt", "updatedAt", modules, slug, "taxpayerType") VALUES
	('cmsbx08hy00007dosw14n0tar', 'AXIS Store — Demo', 'Comercial Aurora S.A.', '80087412-2', 'Aurora Tecnologia', '001', '001', 'Av. Mariscal López 1234, Asunción', 'Comércio a retalho de equipamento informático', '2026-08-02 14:48:01.799', '2026-08-02 14:48:10.438', '{store}', 'demo-store', '2'),
	('cmsbx092x007h7dosf34r7zj6', 'AXIS Farm — Demo', 'Estancia Guaraní S.A.', '80059273-9', 'Estancia Guaraní', '001', '001', 'Ruta PY02 km 218, Colonia Independencia, Guairá', 'Produção agrícola e pecuária', '2026-08-02 14:48:02.554', '2026-08-02 14:48:11.021', '{farm}', 'demo-farm', '2'),
	('cmsbx09mo00f37dostskf7we1', 'AXIS Clinic — Demo', 'Clínica San Rafael S.A.', '80064158-6', 'Clínica San Rafael', '001', '001', 'Av. España 890, Asunción', 'Atividades de atenção à saúde humana', '2026-08-02 14:48:03.264', '2026-08-02 14:48:11.528', '{clinic}', 'demo-clinic', '2');
INSERT INTO public."User" (id, email, name, password, role, "tenantId", "emailVerified", "mustChangePassword", "createdAt") VALUES
	('cmsbx08i100027dosqf21yrgz', 'demo@axisstore.com', 'Demonstração Store', '$2b$12$sxA77kKJRz3qpljT3lMZsOCnQCF8fVeBRO5lIZ62WQPDz5VQ/8Hoe', 'SOVEREIGN', 'cmsbx08hy00007dosw14n0tar', NULL, false, '2026-08-02 14:48:01.802'),
	('cmsbx092y007j7dostnbv8rdy', 'demo@axisfarm.com', 'Demonstração Farm', '$2b$12$btP7CzE0gZiRcK3kh34nYetgkTMpf6oHBknwuRKHIb39Y6rBbX1cy', 'SOVEREIGN', 'cmsbx092x007h7dosf34r7zj6', NULL, false, '2026-08-02 14:48:02.555'),
	('cmsbx09mp00f57dosg1qnyy1x', 'demo@axisclinic.com', 'Demonstração Clinic', '$2b$12$Z6q6G4xEg3qyNj5iUcJG3.sW.i3AIX4gRVVRrEQ/rU142CLJ.W0HC', 'SOVEREIGN', 'cmsbx09mo00f37dostskf7we1', NULL, false, '2026-08-02 14:48:03.266');
INSERT INTO public."Warehouse" (id, "tenantId", name, code, "isDefault", "isActive", "createdAt") VALUES
	('cmsbx08ih002e7doshti88us1', 'cmsbx08hy00007dosw14n0tar', 'Depósito Principal', 'MAIN', true, true, '2026-08-02 14:48:01.817'),
	('cmsbx093a009v7dosdmnw0r29', 'cmsbx092x007h7dosf34r7zj6', 'Depósito Principal', 'MAIN', true, true, '2026-08-02 14:48:02.567'),
	('cmsbx09n600hh7dos12wfnn2b', 'cmsbx09mo00f37dostskf7we1', 'Depósito Principal', 'MAIN', true, true, '2026-08-02 14:48:03.282');
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
INSERT INTO public."Product" (id, "tenantId", sku, name, price, cost, currency, unit, "taxType", "currentStock", "minStock", "isActive", tags, "isService", "createdAt", "updatedAt") VALUES
	('cmsbx08vs002m7dos5ajdn5js', 'cmsbx08hy00007dosw14n0tar', 'NB-001', 'Notebook Lenovo IdeaPad 15"', 4850000.00, 3900000.00, 'PYG', 'un', 'IVA_10', 12.00, 3.00, true, NULL, false, '2026-08-02 14:48:02.296', '2026-08-02 14:48:10.933'),
	('cmsbx08vx002o7dos96363brb', 'cmsbx08hy00007dosw14n0tar', 'MON-002', 'Monitor LG 24" Full HD', 1290000.00, 980000.00, 'PYG', 'un', 'IVA_10', 25.00, 5.00, true, NULL, false, '2026-08-02 14:48:02.301', '2026-08-02 14:48:10.938'),
	('cmsbx08w0002q7doswoqvw5mz', 'cmsbx08hy00007dosw14n0tar', 'TEC-003', 'Teclado mecânico Redragon Kumara', 320000.00, 210000.00, 'PYG', 'un', 'IVA_10', 40.00, 10.00, true, NULL, false, '2026-08-02 14:48:02.305', '2026-08-02 14:48:10.943'),
	('cmsbx08w4002s7dos8tonodv1', 'cmsbx08hy00007dosw14n0tar', 'MOU-004', 'Mouse sem fio Logitech M280', 145000.00, 92000.00, 'PYG', 'un', 'IVA_10', 60.00, 15.00, true, NULL, false, '2026-08-02 14:48:02.308', '2026-08-02 14:48:10.948'),
	('cmsbx08w7002u7dos86tz6lon', 'cmsbx08hy00007dosw14n0tar', 'IMP-005', 'Impressora Epson EcoTank L3250', 1750000.00, 1380000.00, 'PYG', 'un', 'IVA_10', 8.00, 2.00, true, NULL, false, '2026-08-02 14:48:02.311', '2026-08-02 14:48:10.952'),
	('cmsbx08wa002w7dosazm80db2', 'cmsbx08hy00007dosw14n0tar', 'CAB-006', 'Cabo HDMI 2.0 — 2 m', 65000.00, 32000.00, 'PYG', 'un', 'IVA_10', 120.00, 30.00, true, NULL, false, '2026-08-02 14:48:02.315', '2026-08-02 14:48:10.956'),
	('cmsbx08wd002y7dosf9xokfz6', 'cmsbx08hy00007dosw14n0tar', 'SSD-007', 'SSD Kingston NV2 1 TB', 690000.00, 520000.00, 'PYG', 'un', 'IVA_10', 30.00, 8.00, true, NULL, false, '2026-08-02 14:48:02.318', '2026-08-02 14:48:10.961'),
	('cmsbx08wg00307dosnyeurlor', 'cmsbx08hy00007dosw14n0tar', 'FON-008', 'Fone de ouvido JBL Tune 520BT', 385000.00, 260000.00, 'PYG', 'un', 'IVA_10', 4.00, 12.00, true, NULL, false, '2026-08-02 14:48:02.32', '2026-08-02 14:48:10.964'),
	('cmsbx08wj00327doslwr5gf04', 'cmsbx08hy00007dosw14n0tar', 'SRV-001', 'Instalação e configuração (hora técnica)', 250000.00, 0.00, 'PYG', 'hora', 'IVA_10', 0.00, 0.00, true, NULL, true, '2026-08-02 14:48:02.323', '2026-08-02 14:48:10.967'),
	('cmsbx09fs00a37doskud69owy', 'cmsbx092x007h7dosf34r7zj6', 'SEM-SOJA', 'Semente de soja BRS 388 (saco 40 kg)', 480000.00, 395000.00, 'PYG', 'saco', 'IVA_10', 320.00, 60.00, true, NULL, false, '2026-08-02 14:48:03.017', '2026-08-02 14:48:11.487'),
	('cmsbx09fw00a57dosvc649v33', 'cmsbx092x007h7dosf34r7zj6', 'FERT-NPK', 'Fertilizante NPK 04-30-10', 5200000.00, 4350000.00, 'PYG', 'ton', 'IVA_10', 45.00, 10.00, true, NULL, false, '2026-08-02 14:48:03.02', '2026-08-02 14:48:11.489'),
	('cmsbx09fz00a77dos1e3sqq6n', 'cmsbx092x007h7dosf34r7zj6', 'HERB-GLI', 'Herbicida glifosato 480 SL', 42000.00, 31000.00, 'PYG', 'L', 'IVA_10', 1800.00, 400.00, true, NULL, false, '2026-08-02 14:48:03.023', '2026-08-02 14:48:11.492'),
	('cmsbx09g200a97doszmcngfgc', 'cmsbx092x007h7dosf34r7zj6', 'FUNG-AZO', 'Fungicida azoxistrobina + ciproconazol', 185000.00, 142000.00, 'PYG', 'L', 'IVA_10', 260.00, 80.00, true, NULL, false, '2026-08-02 14:48:03.027', '2026-08-02 14:48:11.495'),
	('cmsbx09g500ab7dosoxyb4281', 'cmsbx092x007h7dosf34r7zj6', 'DIESEL', 'Diesel S-10', 8900.00, 8100.00, 'PYG', 'L', 'IVA_10', 12000.00, 4000.00, true, NULL, false, '2026-08-02 14:48:03.03', '2026-08-02 14:48:11.498'),
	('cmsbx09g900ad7dos6zhc5a46', 'cmsbx092x007h7dosf34r7zj6', 'SAL-MIN', 'Sal mineral bovino (saco 30 kg)', 165000.00, 128000.00, 'PYG', 'saco', 'IVA_10', 38.00, 50.00, true, NULL, false, '2026-08-02 14:48:03.033', '2026-08-02 14:48:11.501'),
	('cmsbx0a0b00hp7dos58cxckuq', 'cmsbx09mo00f37dostskf7we1', 'CON-GERAL', 'Consulta clínica geral', 250000.00, 0.00, 'PYG', 'consulta', 'IVA_10', 0.00, 0.00, true, NULL, true, '2026-08-02 14:48:03.755', '2026-08-02 14:48:12.187'),
	('cmsbx0a0i00hr7dosaoxyw08h', 'cmsbx09mo00f37dostskf7we1', 'CON-CARDIO', 'Consulta cardiológica', 380000.00, 0.00, 'PYG', 'consulta', 'IVA_10', 0.00, 0.00, true, NULL, true, '2026-08-02 14:48:03.762', '2026-08-02 14:48:12.19'),
	('cmsbx0a0l00ht7dos49zzorlo', 'cmsbx09mo00f37dostskf7we1', 'CON-DERMA', 'Consulta dermatológica', 350000.00, 0.00, 'PYG', 'consulta', 'IVA_10', 0.00, 0.00, true, NULL, true, '2026-08-02 14:48:03.765', '2026-08-02 14:48:12.193'),
	('cmsbx0a0o00hv7dosi9heprr6', 'cmsbx09mo00f37dostskf7we1', 'EXA-ECG', 'Eletrocardiograma', 190000.00, 45000.00, 'PYG', 'exame', 'IVA_10', 0.00, 0.00, true, NULL, true, '2026-08-02 14:48:03.769', '2026-08-02 14:48:12.196'),
	('cmsbx0a0r00hx7dosrjohj0ym', 'cmsbx09mo00f37dostskf7we1', 'MAT-LUV', 'Luvas de procedimento (caixa 100)', 78000.00, 52000.00, 'PYG', 'caixa', 'IVA_10', 60.00, 15.00, true, NULL, false, '2026-08-02 14:48:03.772', '2026-08-02 14:48:12.199'),
	('cmsbx0a0u00hz7dosvvu0x42m', 'cmsbx09mo00f37dostskf7we1', 'MAT-SER', 'Seringa descartável 5 ml', 2500.00, 1400.00, 'PYG', 'un', 'IVA_10', 800.00, 200.00, true, NULL, false, '2026-08-02 14:48:03.775', '2026-08-02 14:48:12.202'),
	('cmsbx0a0y00i17dostr0lg0wp', 'cmsbx09mo00f37dostskf7we1', 'MAT-VAC', 'Vacina antigripal tetravalente', 145000.00, 98000.00, 'PYG', 'dose', 'IVA_10', 24.00, 30.00, true, NULL, false, '2026-08-02 14:48:03.778', '2026-08-02 14:48:12.205');
INSERT INTO public."WarehouseStock" (id, "warehouseId", "productId", quantity)
SELECT gen_random_uuid()::text, w.id, p.id, p."currentStock"
FROM public."Tenant" t
JOIN public."Warehouse" w ON w."tenantId" = t.id AND w."isDefault"
JOIN public."Product" p ON p."tenantId" = t.id AND NOT p."isService"
WHERE t.slug IN ('demo-store','demo-farm','demo-clinic');
INSERT INTO public."Customer" (id, "tenantId", name, document, "documentType", email, phone, address, city, country, category, "isActive", "createdAt", "updatedAt", "birthDate", "healthNotes") VALUES
	('cmsbx08xb003k7dose8mb5xrx', 'cmsbx08hy00007dosw14n0tar', 'María Fernanda Ayala', '3845219', 'CI', 'mf.ayala@email.com', '0981 442 118', NULL, 'Asunción', 'PY', 'retail', true, '2026-08-02 14:48:02.351', '2026-08-02 14:48:02.351', NULL, NULL),
	('cmsbx08xf003m7dosxi640lsc', 'cmsbx08hy00007dosw14n0tar', 'Distribuidora del Este S.R.L.', '80028461-9', 'RUC', 'compras@deleste.com.py', '021 445 900', NULL, 'Ciudad del Este', 'PY', 'wholesale', true, '2026-08-02 14:48:02.356', '2026-08-02 14:48:02.356', NULL, NULL),
	('cmsbx08xj003o7dosufral1ym', 'cmsbx08hy00007dosw14n0tar', 'Tecno Import S.A.', '80031947-1', 'RUC', 'admin@tecnoimport.com.py', NULL, NULL, 'Asunción', 'PY', 'wholesale', true, '2026-08-02 14:48:02.36', '2026-08-02 14:48:02.36', NULL, NULL),
	('cmsbx08xn003q7dosx6r0l562', 'cmsbx08hy00007dosw14n0tar', 'Carlos Benítez', '2117884', 'CI', 'cbenitez@email.com', '0971 208 553', NULL, 'Lambaré', 'PY', 'retail', true, '2026-08-02 14:48:02.363', '2026-08-02 14:48:02.363', NULL, NULL),
	('cmsbx08xq003s7dos12q5m2gk', 'cmsbx08hy00007dosw14n0tar', 'Colegio San Andrés', '80042336-8', 'RUC', 'administracion@sanandres.edu.py', NULL, NULL, 'San Lorenzo', 'PY', 'vip', true, '2026-08-02 14:48:02.367', '2026-08-02 14:48:02.367', NULL, NULL),
	('cmsbx09gy00ar7dos55esag8f', 'cmsbx092x007h7dosf34r7zj6', 'Cargill Agropecuaria S.A.C.I.', '80005681-0', 'RUC', 'originacion@cargill.com.py', NULL, NULL, 'Asunción', 'PY', 'wholesale', true, '2026-08-02 14:48:03.058', '2026-08-02 14:48:03.058', NULL, NULL),
	('cmsbx09h200at7dos02ercvh7', 'cmsbx092x007h7dosf34r7zj6', 'ADM Paraguay S.A.E.C.A.', '80012842-0', 'RUC', 'granos@adm.com.py', NULL, NULL, 'Encarnación', 'PY', 'wholesale', true, '2026-08-02 14:48:03.062', '2026-08-02 14:48:03.062', NULL, NULL),
	('cmsbx09h600av7dosemod3xzk', 'cmsbx092x007h7dosf34r7zj6', 'Cooperativa Colonias Unidas', '80006114-8', 'RUC', 'acopio@colonias.coop.py', NULL, NULL, 'Obligado', 'PY', 'wholesale', true, '2026-08-02 14:48:03.066', '2026-08-02 14:48:03.066', NULL, NULL),
	('cmsbx09ha00ax7dosqzy70oq0', 'cmsbx092x007h7dosf34r7zj6', 'Frigorífico Guaraní S.A.', '80023519-7', 'RUC', 'compras@frigoguarani.com.py', NULL, NULL, 'Villeta', 'PY', 'wholesale', true, '2026-08-02 14:48:03.07', '2026-08-02 14:48:03.07', NULL, NULL),
	('cmsbx0a1e00i97dos3o0cw7iz', 'cmsbx09mo00f37dostskf7we1', 'Rosa Elena Cabrera', '1994228', 'CI', NULL, '0981 220 774', NULL, 'Asunción', 'PY', 'retail', true, '2026-08-02 14:48:03.794', '2026-08-02 14:48:03.794', '1968-04-12 00:00:00', 'Hipertensa. Losartana 50 mg/dia.'),
	('cmsbx0a1i00ib7dos91r7xirg', 'cmsbx09mo00f37dostskf7we1', 'Diego Armando Ruiz', '4028117', 'CI', NULL, '0972 884 011', NULL, 'Fernando de la Mora', 'PY', 'retail', true, '2026-08-02 14:48:03.798', '2026-08-02 14:48:03.798', '1991-11-03 00:00:00', 'Sem alergias conhecidas.'),
	('cmsbx0a1l00id7dosamaef7s6', 'cmsbx09mo00f37dostskf7we1', 'Sofía Britez', '5511903', 'CI', NULL, '0983 117 226', NULL, 'Luque', 'PY', 'retail', true, '2026-08-02 14:48:03.801', '2026-08-02 14:48:03.801', '2001-07-27 00:00:00', 'Alergia a penicilina.'),
	('cmsbx0a1o00if7dos7v3twm34', 'cmsbx09mo00f37dostskf7we1', 'Juan Carlos Ovelar', '1442785', 'CI', NULL, '0985 640 338', NULL, 'Asunción', 'PY', 'retail', true, '2026-08-02 14:48:03.805', '2026-08-02 14:48:03.805', '1957-01-19 00:00:00', 'Diabético tipo 2. Controlo trimestral.'),
	('cmsbx0a1s00ih7doskj1z62xa', 'cmsbx09mo00f37dostskf7we1', 'Liz Paola Franco', '4783250', 'CI', NULL, '0971 553 902', NULL, 'San Lorenzo', 'PY', 'retail', true, '2026-08-02 14:48:03.808', '2026-08-02 14:48:03.808', '1995-09-08 00:00:00', NULL),
	('cmsbx0a1v00ij7dosnp27h2om', 'cmsbx09mo00f37dostskf7we1', 'Ana Lucía Meza', '6102448', 'CI', NULL, '0976 210 887', NULL, 'Asunción', 'PY', 'retail', true, '2026-08-02 14:48:03.812', '2026-08-02 14:48:03.812', '2015-02-22 00:00:00', 'Acompanhamento pediátrico. Mãe: Liz Franco.'),
	('cmsbx0a1z00il7dosy9xy0i15', 'cmsbx09mo00f37dostskf7we1', 'Hugo Ramírez', '2874119', 'CI', NULL, '0982 447 105', NULL, 'Capiatá', 'PY', 'retail', true, '2026-08-02 14:48:03.815', '2026-08-02 14:48:03.815', '1979-05-30 00:00:00', NULL),
	('cmsbx0a2200in7dosk9dtoiy2', 'cmsbx09mo00f37dostskf7we1', 'Marta Elizabeth Sosa', '3320876', 'CI', NULL, '0984 902 611', NULL, 'Ñemby', 'PY', 'retail', true, '2026-08-02 14:48:03.818', '2026-08-02 14:48:03.818', '1973-12-05 00:00:00', 'Dermatite atópica em tratamento.');
INSERT INTO public."Supplier" (id, "tenantId", name, "businessName", document, "documentType", email, phone, address, city, country, category, "isActive", "paymentTerms", "createdAt", "updatedAt") VALUES
	('cmsbx08xu003u7dosp4yyhy04', 'cmsbx08hy00007dosw14n0tar', 'Tech Import Paraguay', 'Tech Import Paraguay S.A.', '80017725-1', 'RUC', 'ventas@techimport.com.py', NULL, NULL, NULL, 'PY', 'retail', true, '30 días', '2026-08-02 14:48:02.37', '2026-08-02 14:48:02.37'),
	('cmsbx08xz003w7dosemwt58o7', 'cmsbx08hy00007dosw14n0tar', 'Nova Distribuidora', 'Nova Distribuidora Ltda.', '18452796000134', 'CNPJ', 'comercial@novadist.com.br', NULL, NULL, NULL, 'BR', 'retail', true, 'Net 45', '2026-08-02 14:48:02.375', '2026-08-02 14:48:02.375'),
	('cmsbx09hd00az7dosd9j63vj8', 'cmsbx092x007h7dosf34r7zj6', 'Agro Insumos del Sur', 'Agro Insumos del Sur S.A.', '80019473-3', 'RUC', 'ventas@agroinsumos.com.py', NULL, NULL, NULL, 'PY', 'retail', true, '60 días', '2026-08-02 14:48:03.073', '2026-08-02 14:48:03.073'),
	('cmsbx09hh00b17dos5601o5ul', 'cmsbx092x007h7dosf34r7zj6', 'Tractores y Máquinas', 'Tractores y Máquinas S.R.L.', '80027358-7', 'RUC', 'posventa@tracmaq.com.py', NULL, NULL, NULL, 'PY', 'retail', true, '30 días', '2026-08-02 14:48:03.077', '2026-08-02 14:48:03.077'),
	('cmsbx0a2500ip7dosoqgd7q9r', 'cmsbx09mo00f37dostskf7we1', 'Distribuidora Médica del Paraguay', 'Distribuidora Médica del Paraguay S.A.', '80021640-0', 'RUC', 'ventas@dimepa.com.py', NULL, NULL, NULL, 'PY', 'retail', true, '30 días', '2026-08-02 14:48:03.822', '2026-08-02 14:48:03.822'),
	('cmsbx0a2900ir7dos87015mjx', 'cmsbx09mo00f37dostskf7we1', 'Laboratorios Catedral', 'Laboratorios Catedral S.A.', '80003392-6', 'RUC', 'institucional@catedral.com.py', NULL, NULL, NULL, 'PY', 'retail', true, '45 días', '2026-08-02 14:48:03.825', '2026-08-02 14:48:03.825');
INSERT INTO public."ExchangeRate" (id, "tenantId", "ratePYGtoUSD", "ratePYGtoBRL", date, source, "isManual") VALUES
	('cmsbx08vk002i7doswore9otj', 'cmsbx08hy00007dosw14n0tar', 7320.0000, 1285.0000, '2026-08-02 14:48:02.288', 'BCP_API', false),
	('cmsbx09fn009z7dosm84o317k', 'cmsbx092x007h7dosf34r7zj6', 7320.0000, 1285.0000, '2026-08-02 14:48:03.011', 'BCP_API', false),
	('cmsbx0a0100hl7dosi26bs77v', 'cmsbx09mo00f37dostskf7we1', 7320.0000, 1285.0000, '2026-08-02 14:48:03.745', 'BCP_API', false);
INSERT INTO public."Timbrado" (id, "tenantId", numero, establishment, "emissionPoint", "validFrom", "validTo", "rangeFrom", "rangeTo", "isActive", "createdAt", "updatedAt") VALUES
	('cmsbx08vn002k7dosejuout5f', 'cmsbx08hy00007dosw14n0tar', '12557896', '001', '001', '2026-01-01 00:00:00', '2027-12-31 00:00:00', 1, 9999999, true, '2026-08-02 14:48:02.292', '2026-08-02 14:48:10.927'),
	('cmsbx09fp00a17dosgntk1l5x', 'cmsbx092x007h7dosf34r7zj6', '12604417', '001', '001', '2026-01-01 00:00:00', '2027-12-31 00:00:00', 1, 9999999, true, '2026-08-02 14:48:03.014', '2026-08-02 14:48:11.484'),
	('cmsbx0a0600hn7doswu56dxmi', 'cmsbx09mo00f37dostskf7we1', '12588203', '001', '001', '2026-01-01 00:00:00', '2027-12-31 00:00:00', 1, 9999999, true, '2026-08-02 14:48:03.75', '2026-08-02 14:48:12.183');
INSERT INTO public."CommercialInvoice" (id, "tenantId", type, status, "documentNumber", timbrado, "sifenCdc", "sifenXmlUrl", "sifenStatus", "attachmentUrl", "customerId", "supplierId", "issuedAt", "dueDate", currency, "exchangeRate", "totalAmount", "totalUSD", "totalIva10", "totalIva5", "totalExento", notes, "createdAt", "updatedAt", "sifenSecurityCode") VALUES
	('cmsbx08yb003y7dosk3b9f8c0', 'cmsbx08hy00007dosw14n0tar', 'SALES', 'APPROVED', '001-001-0000001', '12557896', NULL, NULL, NULL, NULL, 'cmsbx08xf003m7dosxi640lsc', NULL, '2026-07-05 10:00:00', NULL, 'PYG', 1.0000, 4995000.00, NULL, 454091.00, 0.00, 0.00, NULL, '2026-08-02 14:48:02.387', '2026-08-02 14:48:02.387', NULL),
	('cmsbx08yw00497dosnrc0ylol', 'cmsbx08hy00007dosw14n0tar', 'SALES', 'APPROVED', '001-001-0000002', '12557896', NULL, NULL, NULL, NULL, 'cmsbx08xj003o7dosufral1ym', NULL, '2026-07-08 11:00:00', NULL, 'PYG', 1.0000, 1030000.00, NULL, 93637.00, 0.00, 0.00, NULL, '2026-08-02 14:48:02.408', '2026-08-02 14:48:02.408', NULL),
	('cmsbx08z6004k7dosusbujsvq', 'cmsbx08hy00007dosw14n0tar', 'SALES', 'APPROVED', '001-001-0000003', '12557896', NULL, NULL, NULL, NULL, 'cmsbx08xn003q7dosx6r0l562', NULL, '2026-07-12 12:00:00', NULL, 'PYG', 1.0000, 3870000.00, NULL, 351818.00, 0.00, 0.00, NULL, '2026-08-02 14:48:02.419', '2026-08-02 14:48:02.419', NULL),
	('cmsbx08ze004q7dos2x9pv58t', 'cmsbx08hy00007dosw14n0tar', 'SALES', 'APPROVED', '001-001-0000004', '12557896', NULL, NULL, NULL, NULL, 'cmsbx08xq003s7dos12q5m2gk', NULL, '2026-07-15 13:00:00', NULL, 'PYG', 1.0000, 1880000.00, NULL, 170909.00, 0.00, 0.00, NULL, '2026-08-02 14:48:02.426', '2026-08-02 14:48:02.426', NULL),
	('cmsbx08zq00517dos6fm164mf', 'cmsbx08hy00007dosw14n0tar', 'SALES', 'APPROVED', '001-001-0000005', '12557896', NULL, NULL, NULL, NULL, 'cmsbx08xb003k7dose8mb5xrx', NULL, '2026-07-18 14:00:00', NULL, 'PYG', 1.0000, 3260000.00, NULL, 296364.00, 0.00, 0.00, NULL, '2026-08-02 14:48:02.438', '2026-08-02 14:48:02.438', NULL),
	('cmsbx0902005c7dosor1gpslr', 'cmsbx08hy00007dosw14n0tar', 'SALES', 'APPROVED', '001-001-0000006', '12557896', NULL, NULL, NULL, NULL, 'cmsbx08xf003m7dosxi640lsc', NULL, '2026-07-22 15:00:00', NULL, 'PYG', 1.0000, 12280000.00, NULL, 1116363.00, 0.00, 0.00, NULL, '2026-08-02 14:48:02.451', '2026-08-02 14:48:02.451', NULL),
	('cmsbx090c005l7doswza7awkm', 'cmsbx08hy00007dosw14n0tar', 'SALES', 'APPROVED', '001-001-0000007', '12557896', NULL, NULL, NULL, NULL, 'cmsbx08xj003o7dosufral1ym', NULL, '2026-07-25 16:00:00', NULL, 'PYG', 1.0000, 1925000.00, NULL, 175000.00, 0.00, 0.00, NULL, '2026-08-02 14:48:02.46', '2026-08-02 14:48:02.46', NULL),
	('cmsbx090j005t7dosv6m6mwye', 'cmsbx08hy00007dosw14n0tar', 'SALES', 'APPROVED', '001-001-0000008', '12557896', NULL, NULL, NULL, NULL, 'cmsbx08xn003q7dosx6r0l562', NULL, '2026-07-28 09:00:00', NULL, 'PYG', 1.0000, 2150000.00, NULL, 195455.00, 0.00, 0.00, NULL, '2026-08-02 14:48:02.468', '2026-08-02 14:48:02.468', NULL),
	('cmsbx090v00647dos4dl1530y', 'cmsbx08hy00007dosw14n0tar', 'SALES', 'APPROVED', '001-001-0000009', '12557896', NULL, NULL, NULL, NULL, 'cmsbx08xq003s7dos12q5m2gk', NULL, '2026-07-30 10:00:00', NULL, 'PYG', 1.0000, 6290000.00, NULL, 571818.00, 0.00, 0.00, NULL, '2026-08-02 14:48:02.479', '2026-08-02 14:48:02.479', NULL),
	('cmsbx0917006g7dosu3r25yr6', 'cmsbx08hy00007dosw14n0tar', 'SALES', 'APPROVED', '001-001-0000010', '12557896', NULL, NULL, NULL, NULL, 'cmsbx08xb003k7dose8mb5xrx', NULL, '2026-08-01 11:00:00', NULL, 'PYG', 1.0000, 1550000.00, NULL, 140909.00, 0.00, 0.00, NULL, '2026-08-02 14:48:02.491', '2026-08-02 14:48:02.491', NULL),
	('cmsbx091j006r7dostfg73bil', 'cmsbx08hy00007dosw14n0tar', 'PURCHASE', 'APPROVED', '001-002-0000001', NULL, NULL, NULL, NULL, NULL, NULL, 'cmsbx08xz003w7dosemwt58o7', '2026-07-07 15:00:00', NULL, 'PYG', 1.0000, 320000.00, NULL, 29091.00, 0.00, 0.00, NULL, '2026-08-02 14:48:02.504', '2026-08-02 14:48:02.504', NULL),
	('cmsbx091p006v7dosasm6madv', 'cmsbx08hy00007dosw14n0tar', 'PURCHASE', 'APPROVED', '001-002-0000002', NULL, NULL, NULL, NULL, NULL, NULL, 'cmsbx08xu003u7dosp4yyhy04', '2026-07-21 15:00:00', NULL, 'PYG', 1.0000, 5200000.00, NULL, 472727.00, 0.00, 0.00, NULL, '2026-08-02 14:48:02.51', '2026-08-02 14:48:02.51', NULL),
	('cmsbx09hp00b37dosrmhf9r2v', 'cmsbx092x007h7dosf34r7zj6', 'SALES', 'APPROVED', '001-001-0000001', '12604417', NULL, NULL, NULL, NULL, 'cmsbx09h200at7dos02ercvh7', NULL, '2026-07-06 10:00:00', NULL, 'PYG', 1.0000, 19200000.00, NULL, 1745455.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.085', '2026-08-02 14:48:03.085', NULL),
	('cmsbx09i000bb7dos1mvsax97', 'cmsbx092x007h7dosf34r7zj6', 'SALES', 'APPROVED', '001-001-0000002', '12604417', NULL, NULL, NULL, NULL, 'cmsbx09h600av7dosemod3xzk', NULL, '2026-07-11 11:00:00', NULL, 'PYG', 1.0000, 31200000.00, NULL, 2836364.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.096', '2026-08-02 14:48:03.096', NULL),
	('cmsbx09ib00bj7dosgh1xvc17', 'cmsbx092x007h7dosf34r7zj6', 'SALES', 'APPROVED', '001-001-0000003', '12604417', NULL, NULL, NULL, NULL, 'cmsbx09ha00ax7dosqzy70oq0', NULL, '2026-07-16 12:00:00', NULL, 'PYG', 1.0000, 16800000.00, NULL, 1527273.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.108', '2026-08-02 14:48:03.108', NULL),
	('cmsbx09ij00bp7doswzf67dbr', 'cmsbx092x007h7dosf34r7zj6', 'SALES', 'APPROVED', '001-001-0000004', '12604417', NULL, NULL, NULL, NULL, 'cmsbx09gy00ar7dos55esag8f', NULL, '2026-07-20 13:00:00', NULL, 'PYG', 1.0000, 22200000.00, NULL, 2018182.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.116', '2026-08-02 14:48:03.116', NULL),
	('cmsbx09it00bx7dostb2hc9rx', 'cmsbx092x007h7dosf34r7zj6', 'SALES', 'APPROVED', '001-001-0000005', '12604417', NULL, NULL, NULL, NULL, 'cmsbx09h200at7dos02ercvh7', NULL, '2026-07-24 14:00:00', NULL, 'PYG', 1.0000, 4125000.00, NULL, 375000.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.125', '2026-08-02 14:48:03.125', NULL),
	('cmsbx09j100c57dosyh6puvjf', 'cmsbx092x007h7dosf34r7zj6', 'SALES', 'APPROVED', '001-001-0000006', '12604417', NULL, NULL, NULL, NULL, 'cmsbx09h600av7dosemod3xzk', NULL, '2026-07-29 15:00:00', NULL, 'PYG', 1.0000, 44400000.00, NULL, 4036364.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.133', '2026-08-02 14:48:03.133', NULL),
	('cmsbx09ja00ce7dosd2syciv6', 'cmsbx092x007h7dosf34r7zj6', 'PURCHASE', 'APPROVED', '001-002-0000001', NULL, NULL, NULL, NULL, NULL, NULL, 'cmsbx09hh00b17dos5601o5ul', '2026-07-07 15:00:00', NULL, 'PYG', 1.0000, 81000.00, NULL, 7364.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.142', '2026-08-02 14:48:03.142', NULL),
	('cmsbx09jg00ci7dosmcyevguw', 'cmsbx092x007h7dosf34r7zj6', 'PURCHASE', 'APPROVED', '001-002-0000002', NULL, NULL, NULL, NULL, NULL, NULL, 'cmsbx09hd00az7dosd9j63vj8', '2026-07-21 15:00:00', NULL, 'PYG', 1.0000, 87000000.00, NULL, 7909091.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.148', '2026-08-02 14:48:03.148', NULL),
	('cmsbx0a2j00it7dos4ypklb0n', 'cmsbx09mo00f37dostskf7we1', 'SALES', 'APPROVED', '001-001-0000001', '12588203', NULL, NULL, NULL, NULL, 'cmsbx0a1i00ib7dos91r7xirg', NULL, '2026-07-07 10:00:00', NULL, 'PYG', 1.0000, 250000.00, NULL, 22727.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.835', '2026-08-02 14:48:03.835', NULL),
	('cmsbx0a2x00j17dosqr2dpp71', 'cmsbx09mo00f37dostskf7we1', 'SALES', 'APPROVED', '001-001-0000002', '12588203', NULL, NULL, NULL, NULL, 'cmsbx0a1l00id7dosamaef7s6', NULL, '2026-07-10 11:00:00', NULL, 'PYG', 1.0000, 570000.00, NULL, 51818.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.85', '2026-08-02 14:48:03.85', NULL),
	('cmsbx0a3b00jc7dosf75depdv', 'cmsbx09mo00f37dostskf7we1', 'SALES', 'APPROVED', '001-001-0000003', '12588203', NULL, NULL, NULL, NULL, 'cmsbx0a1o00if7dos7v3twm34', NULL, '2026-07-14 12:00:00', NULL, 'PYG', 1.0000, 350000.00, NULL, 31818.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.863', '2026-08-02 14:48:03.863', NULL),
	('cmsbx0a3i00ji7doszwnv2fb7', 'cmsbx09mo00f37dostskf7we1', 'SALES', 'APPROVED', '001-001-0000004', '12588203', NULL, NULL, NULL, NULL, 'cmsbx0a1s00ih7doskj1z62xa', NULL, '2026-07-17 13:00:00', NULL, 'PYG', 1.0000, 500000.00, NULL, 45455.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.87', '2026-08-02 14:48:03.87', NULL),
	('cmsbx0a3s00jq7dos4fu6qi3n', 'cmsbx09mo00f37dostskf7we1', 'SALES', 'APPROVED', '001-001-0000005', '12588203', NULL, NULL, NULL, NULL, 'cmsbx0a1v00ij7dosnp27h2om', NULL, '2026-07-21 14:00:00', NULL, 'PYG', 1.0000, 380000.00, NULL, 34545.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.88', '2026-08-02 14:48:03.88', NULL),
	('cmsbx0a4200jy7dosnxfwjp9c', 'cmsbx09mo00f37dostskf7we1', 'SALES', 'APPROVED', '001-001-0000006', '12588203', NULL, NULL, NULL, NULL, 'cmsbx0a1z00il7dosy9xy0i15', NULL, '2026-07-24 15:00:00', NULL, 'PYG', 1.0000, 395000.00, NULL, 35909.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.89', '2026-08-02 14:48:03.89', NULL),
	('cmsbx0a4b00k77dosiqa9pym2', 'cmsbx09mo00f37dostskf7we1', 'SALES', 'APPROVED', '001-001-0000007', '12588203', NULL, NULL, NULL, NULL, 'cmsbx0a2200in7dosk9dtoiy2', NULL, '2026-07-27 16:00:00', NULL, 'PYG', 1.0000, 700000.00, NULL, 63636.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.899', '2026-08-02 14:48:03.899', NULL),
	('cmsbx0a4j00kf7doslkgie5gi', 'cmsbx09mo00f37dostskf7we1', 'SALES', 'APPROVED', '001-001-0000008', '12588203', NULL, NULL, NULL, NULL, 'cmsbx0a1e00i97dos3o0cw7iz', NULL, '2026-07-31 09:00:00', NULL, 'PYG', 1.0000, 1130000.00, NULL, 102727.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.908', '2026-08-02 14:48:03.908', NULL),
	('cmsbx0a4v00kq7dosgh0qt82f', 'cmsbx09mo00f37dostskf7we1', 'PURCHASE', 'APPROVED', '001-002-0000001', NULL, NULL, NULL, NULL, NULL, NULL, 'cmsbx0a2900ir7dos87015mjx', '2026-07-07 15:00:00', NULL, 'PYG', 1.0000, 0.00, NULL, 0.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.919', '2026-08-02 14:48:03.919', NULL),
	('cmsbx0a5000ku7dosl3tsz0rf', 'cmsbx09mo00f37dostskf7we1', 'PURCHASE', 'APPROVED', '001-002-0000002', NULL, NULL, NULL, NULL, NULL, NULL, 'cmsbx0a2500ip7dosoqgd7q9r', '2026-07-21 15:00:00', NULL, 'PYG', 1.0000, 0.00, NULL, 0.00, 0.00, 0.00, NULL, '2026-08-02 14:48:03.925', '2026-08-02 14:48:03.925', NULL);
INSERT INTO public."InvoiceItem" (id, "commercialInvoiceId", "productId", sku, quantity, "unitPrice", "totalPrice", "taxType", "taxBase", "taxAmount", cost) VALUES
	('cmsbx08yb00407dos5uojufhe', 'cmsbx08yb003y7dosk3b9f8c0', 'cmsbx08vs002m7dos5ajdn5js', 'NB-001', 1.00, 4850000.00, 4850000.00, 'IVA_10', 4850000.00, 440909.00, 3900000.00),
	('cmsbx08yb00417dos5y37zhzy', 'cmsbx08yb003y7dosk3b9f8c0', 'cmsbx08w4002s7dos8tonodv1', 'MOU-004', 1.00, 145000.00, 145000.00, 'IVA_10', 145000.00, 13182.00, 92000.00),
	('cmsbx08yw004b7dostv6jnwu5', 'cmsbx08yw00497dosnrc0ylol', 'cmsbx08wa002w7dosazm80db2', 'CAB-006', 6.00, 65000.00, 390000.00, 'IVA_10', 390000.00, 35455.00, 32000.00),
	('cmsbx08yw004c7dose0gzb5m5', 'cmsbx08yw00497dosnrc0ylol', 'cmsbx08w0002q7doswoqvw5mz', 'TEC-003', 2.00, 320000.00, 640000.00, 'IVA_10', 640000.00, 58182.00, 210000.00),
	('cmsbx08z6004m7dosj6vsopun', 'cmsbx08z6004k7dosusbujsvq', 'cmsbx08vx002o7dos96363brb', 'MON-002', 3.00, 1290000.00, 3870000.00, 'IVA_10', 3870000.00, 351818.00, 980000.00),
	('cmsbx08ze004s7dos6icxsks7', 'cmsbx08ze004q7dos2x9pv58t', 'cmsbx08w7002u7dos86tz6lon', 'IMP-005', 1.00, 1750000.00, 1750000.00, 'IVA_10', 1750000.00, 159091.00, 1380000.00),
	('cmsbx08ze004t7doszyr6zpln', 'cmsbx08ze004q7dos2x9pv58t', 'cmsbx08wa002w7dosazm80db2', 'CAB-006', 2.00, 65000.00, 130000.00, 'IVA_10', 130000.00, 11818.00, 32000.00),
	('cmsbx08zq00537doskhpqcej1', 'cmsbx08zq00517dos6fm164mf', 'cmsbx08wd002y7dosf9xokfz6', 'SSD-007', 4.00, 690000.00, 2760000.00, 'IVA_10', 2760000.00, 250909.00, 520000.00),
	('cmsbx08zq00547doso1s56cj5', 'cmsbx08zq00517dos6fm164mf', 'cmsbx08wj00327doslwr5gf04', 'SRV-001', 2.00, 250000.00, 500000.00, 'IVA_10', 500000.00, 45455.00, 0.00),
	('cmsbx0902005e7dosjmn7byib', 'cmsbx0902005c7dosor1gpslr', 'cmsbx08vs002m7dos5ajdn5js', 'NB-001', 2.00, 4850000.00, 9700000.00, 'IVA_10', 9700000.00, 881818.00, 3900000.00),
	('cmsbx0902005f7doslo03nit6', 'cmsbx0902005c7dosor1gpslr', 'cmsbx08vx002o7dos96363brb', 'MON-002', 2.00, 1290000.00, 2580000.00, 'IVA_10', 2580000.00, 234545.00, 980000.00),
	('cmsbx090c005n7dosuu85gww8', 'cmsbx090c005l7doswza7awkm', 'cmsbx08wg00307dosnyeurlor', 'FON-008', 5.00, 385000.00, 1925000.00, 'IVA_10', 1925000.00, 175000.00, 260000.00),
	('cmsbx090j005v7dosry3j0j1t', 'cmsbx090j005t7dosv6m6mwye', 'cmsbx08w0002q7doswoqvw5mz', 'TEC-003', 4.00, 320000.00, 1280000.00, 'IVA_10', 1280000.00, 116364.00, 210000.00),
	('cmsbx090j005w7dosn4k9cfnc', 'cmsbx090j005t7dosv6m6mwye', 'cmsbx08w4002s7dos8tonodv1', 'MOU-004', 6.00, 145000.00, 870000.00, 'IVA_10', 870000.00, 79091.00, 92000.00),
	('cmsbx090v00667dos3iubh2pg', 'cmsbx090v00647dos4dl1530y', 'cmsbx08vs002m7dos5ajdn5js', 'NB-001', 1.00, 4850000.00, 4850000.00, 'IVA_10', 4850000.00, 440909.00, 3900000.00),
	('cmsbx090v00677dos8yu7xdp5', 'cmsbx090v00647dos4dl1530y', 'cmsbx08wd002y7dosf9xokfz6', 'SSD-007', 1.00, 690000.00, 690000.00, 'IVA_10', 690000.00, 62727.00, 520000.00),
	('cmsbx090v00687dospdzp0lq3', 'cmsbx090v00647dos4dl1530y', 'cmsbx08wj00327doslwr5gf04', 'SRV-001', 3.00, 250000.00, 750000.00, 'IVA_10', 750000.00, 68182.00, 0.00),
	('cmsbx0917006i7dosviu9f2g1', 'cmsbx0917006g7dosu3r25yr6', 'cmsbx08vx002o7dos96363brb', 'MON-002', 1.00, 1290000.00, 1290000.00, 'IVA_10', 1290000.00, 117273.00, 980000.00),
	('cmsbx0917006j7dosc2dt15pe', 'cmsbx0917006g7dosu3r25yr6', 'cmsbx08wa002w7dosazm80db2', 'CAB-006', 4.00, 65000.00, 260000.00, 'IVA_10', 260000.00, 23636.00, 32000.00),
	('cmsbx091k006t7dosb09729az', 'cmsbx091j006r7dostfg73bil', 'cmsbx08wa002w7dosazm80db2', 'CAB-006', 10.00, 32000.00, 320000.00, 'IVA_10', 320000.00, 29091.00, 32000.00),
	('cmsbx091p006x7dospz1eac5m', 'cmsbx091p006v7dosasm6madv', 'cmsbx08wg00307dosnyeurlor', 'FON-008', 20.00, 260000.00, 5200000.00, 'IVA_10', 5200000.00, 472727.00, 260000.00),
	('cmsbx09hp00b57dosqjux6iqp', 'cmsbx09hp00b37dosrmhf9r2v', 'cmsbx09fs00a37doskud69owy', 'SEM-SOJA', 40.00, 480000.00, 19200000.00, 'IVA_10', 19200000.00, 1745455.00, 395000.00),
	('cmsbx09i000bd7dos2tzr6knk', 'cmsbx09i000bb7dos1mvsax97', 'cmsbx09fw00a57dosvc649v33', 'FERT-NPK', 6.00, 5200000.00, 31200000.00, 'IVA_10', 31200000.00, 2836364.00, 4350000.00),
	('cmsbx09ib00bl7dosr3a3do89', 'cmsbx09ib00bj7dosgh1xvc17', 'cmsbx09fz00a77dos1e3sqq6n', 'HERB-GLI', 400.00, 42000.00, 16800000.00, 'IVA_10', 16800000.00, 1527273.00, 31000.00),
	('cmsbx09ij00br7dosmxlg37p7', 'cmsbx09ij00bp7doswzf67dbr', 'cmsbx09g200a97doszmcngfgc', 'FUNG-AZO', 120.00, 185000.00, 22200000.00, 'IVA_10', 22200000.00, 2018182.00, 142000.00),
	('cmsbx09it00bz7dosiwn2150x', 'cmsbx09it00bx7dostb2hc9rx', 'cmsbx09g900ad7dos6zhc5a46', 'SAL-MIN', 25.00, 165000.00, 4125000.00, 'IVA_10', 4125000.00, 375000.00, 128000.00),
	('cmsbx09j100c77dosnv71u9g1', 'cmsbx09j100c57dosyh6puvjf', 'cmsbx09fs00a37doskud69owy', 'SEM-SOJA', 60.00, 480000.00, 28800000.00, 'IVA_10', 28800000.00, 2618182.00, 395000.00),
	('cmsbx09j100c87dosyb1ja1tw', 'cmsbx09j100c57dosyh6puvjf', 'cmsbx09fw00a57dosvc649v33', 'FERT-NPK', 3.00, 5200000.00, 15600000.00, 'IVA_10', 15600000.00, 1418182.00, 4350000.00),
	('cmsbx09ja00cg7dosdvb2q2iy', 'cmsbx09ja00ce7dosd2syciv6', 'cmsbx09g500ab7dosoxyb4281', 'DIESEL', 10.00, 8100.00, 81000.00, 'IVA_10', 81000.00, 7364.00, 8100.00),
	('cmsbx09jg00ck7dosivhzrzy2', 'cmsbx09jg00ci7dosmcyevguw', 'cmsbx09fw00a57dosvc649v33', 'FERT-NPK', 20.00, 4350000.00, 87000000.00, 'IVA_10', 87000000.00, 7909091.00, 4350000.00),
	('cmsbx0a2j00iv7dosltn8zff2', 'cmsbx0a2j00it7dos4ypklb0n', 'cmsbx0a0b00hp7dos58cxckuq', 'CON-GERAL', 1.00, 250000.00, 250000.00, 'IVA_10', 250000.00, 22727.00, 0.00),
	('cmsbx0a2y00j37dos1su8lu93', 'cmsbx0a2x00j17dosqr2dpp71', 'cmsbx0a0i00hr7dosaoxyw08h', 'CON-CARDIO', 1.00, 380000.00, 380000.00, 'IVA_10', 380000.00, 34545.00, 0.00),
	('cmsbx0a2y00j47doscmymqyz3', 'cmsbx0a2x00j17dosqr2dpp71', 'cmsbx0a0o00hv7dosi9heprr6', 'EXA-ECG', 1.00, 190000.00, 190000.00, 'IVA_10', 190000.00, 17273.00, 45000.00),
	('cmsbx0a3b00je7dos91rogavg', 'cmsbx0a3b00jc7dosf75depdv', 'cmsbx0a0l00ht7dos49zzorlo', 'CON-DERMA', 1.00, 350000.00, 350000.00, 'IVA_10', 350000.00, 31818.00, 0.00),
	('cmsbx0a3i00jk7dos1673g95a', 'cmsbx0a3i00ji7doszwnv2fb7', 'cmsbx0a0b00hp7dos58cxckuq', 'CON-GERAL', 2.00, 250000.00, 500000.00, 'IVA_10', 500000.00, 45455.00, 0.00),
	('cmsbx0a3s00js7dosel7e5sbf', 'cmsbx0a3s00jq7dos4fu6qi3n', 'cmsbx0a0i00hr7dosaoxyw08h', 'CON-CARDIO', 1.00, 380000.00, 380000.00, 'IVA_10', 380000.00, 34545.00, 0.00),
	('cmsbx0a4200k07dos2hlc5kkc', 'cmsbx0a4200jy7dosnxfwjp9c', 'cmsbx0a0b00hp7dos58cxckuq', 'CON-GERAL', 1.00, 250000.00, 250000.00, 'IVA_10', 250000.00, 22727.00, 0.00),
	('cmsbx0a4200k17dos3d0p7mb4', 'cmsbx0a4200jy7dosnxfwjp9c', 'cmsbx0a0y00i17dostr0lg0wp', 'MAT-VAC', 1.00, 145000.00, 145000.00, 'IVA_10', 145000.00, 13182.00, 98000.00),
	('cmsbx0a4b00k97dosmjo21tz3', 'cmsbx0a4b00k77dosiqa9pym2', 'cmsbx0a0l00ht7dos49zzorlo', 'CON-DERMA', 2.00, 350000.00, 700000.00, 'IVA_10', 700000.00, 63636.00, 0.00),
	('cmsbx0a4k00kh7dosq1k141jz', 'cmsbx0a4j00kf7doslkgie5gi', 'cmsbx0a0b00hp7dos58cxckuq', 'CON-GERAL', 3.00, 250000.00, 750000.00, 'IVA_10', 750000.00, 68182.00, 0.00),
	('cmsbx0a4k00ki7dosoi76uivz', 'cmsbx0a4j00kf7doslkgie5gi', 'cmsbx0a0o00hv7dosi9heprr6', 'EXA-ECG', 2.00, 190000.00, 380000.00, 'IVA_10', 380000.00, 34545.00, 45000.00),
	('cmsbx0a4v00ks7dosaw3tm8vu', 'cmsbx0a4v00kq7dosgh0qt82f', 'cmsbx0a0i00hr7dosaoxyw08h', 'CON-CARDIO', 10.00, 0.00, 0.00, 'IVA_10', 0.00, 0.00, 0.00),
	('cmsbx0a5100kw7dosadfintfp', 'cmsbx0a5000ku7dosl3tsz0rf', 'cmsbx0a0l00ht7dos49zzorlo', 'CON-DERMA', 20.00, 0.00, 0.00, 'IVA_10', 0.00, 0.00, 0.00);
INSERT INTO public."InventoryMovement" (id, "tenantId", "productId", type, quantity, "unitCost", "totalCost", reason, "warehouseId", "commercialInvoiceId", "createdAt")
SELECT gen_random_uuid()::text, t.id, ii."productId", 'SAIDA'::"MovementType", ii.quantity, ii.cost,
       ii.cost * ii.quantity, 'Venda ' || ci."documentNumber", w.id, ci.id, ci."issuedAt"
FROM public."Tenant" t
JOIN public."CommercialInvoice" ci ON ci."tenantId" = t.id AND ci.type = 'SALES'
JOIN public."InvoiceItem" ii ON ii."commercialInvoiceId" = ci.id
JOIN public."Warehouse" w ON w."tenantId" = t.id AND w."isDefault"
WHERE t.slug IN ('demo-store','demo-farm','demo-clinic');
INSERT INTO public."Payment" (id, "tenantId", "commercialInvoiceId", amount, currency, "exchangeRate", method, "paidAt")
SELECT gen_random_uuid()::text, t.id, ci.id, ci."totalAmount", 'PYG'::"Currency", 1,
       (CASE WHEN seq % 2 = 0 THEN 'CASH' ELSE 'BANK_TRANSFER' END)::"PaymentMethod",
       ci."issuedAt" + interval '1 day'
FROM public."Tenant" t
JOIN LATERAL (
  SELECT i.*, split_part(i."documentNumber", '-', 3)::int AS seq
  FROM public."CommercialInvoice" i
  WHERE i."tenantId" = t.id AND i.type = 'SALES'
) ci ON true
WHERE t.slug IN ('demo-store','demo-farm','demo-clinic') AND ci.seq % 3 <> 0;
INSERT INTO public."Order" (id, "tenantId", type, status, "orderNumber", "customerId", "supplierId", "expectedAt", currency, "totalAmount", notes, "invoiceId", "createdBy", "createdAt", "updatedAt") VALUES
	('cmsbx0920006z7dosdingd41t', 'cmsbx08hy00007dosw14n0tar', 'SALES', 'CONFIRMED', 'PV-000001', 'cmsbx08xf003m7dosxi640lsc', NULL, '2026-08-07 14:48:02.52', 'PYG', 18420000.00, 'Entrega no depósito do cliente.', NULL, NULL, '2026-08-02 14:48:02.521', '2026-08-02 14:48:02.521'),
	('cmsbx092900747dosqe4wc5tg', 'cmsbx08hy00007dosw14n0tar', 'PURCHASE', 'DRAFT', 'PC-000001', NULL, 'cmsbx08xu003u7dosp4yyhy04', '2026-08-14 14:48:02.528', 'PYG', 13800000.00, 'Reposição de estoque — trimestre.', NULL, NULL, '2026-08-02 14:48:02.529', '2026-08-02 14:48:02.529');
INSERT INTO public."OrderItem" (id, "orderId", "productId", quantity, "unitPrice") VALUES
	('cmsbx092000717dos97u1for4', 'cmsbx0920006z7dosdingd41t', 'cmsbx08vs002m7dos5ajdn5js', 3.00, 4850000.00),
	('cmsbx092000727dosq07bw4wp', 'cmsbx0920006z7dosdingd41t', 'cmsbx08vx002o7dos96363brb', 3.00, 1290000.00),
	('cmsbx092900767dosp0djj451', 'cmsbx092900747dosqe4wc5tg', 'cmsbx08wd002y7dosf9xokfz6', 20.00, 690000.00);
INSERT INTO public."JournalEntry" (id, "tenantId", number, date, description, status, "referenceType", "referenceId", "postedAt", "createdBy", "createdAt") VALUES
	('cmsbx092i00787dos50cdqiug', 'cmsbx08hy00007dosw14n0tar', 'LC-000001', '2026-07-13 10:00:00', 'Recebimento de vendas do período', 'POSTED', NULL, NULL, '2026-07-13 10:00:00', NULL, '2026-08-02 14:48:02.538'),
	('cmsbx092o007d7doshydxkuv9', 'cmsbx08hy00007dosw14n0tar', 'LC-000002', '2026-07-21 10:00:00', 'Compra de mercadorias a prazo', 'POSTED', NULL, NULL, '2026-07-21 10:00:00', NULL, '2026-08-02 14:48:02.545'),
	('cmsbx09jm00cm7dosbko8cdus', 'cmsbx092x007h7dosf34r7zj6', 'LC-000001', '2026-07-13 10:00:00', 'Recebimento de vendas do período', 'POSTED', NULL, NULL, '2026-07-13 10:00:00', NULL, '2026-08-02 14:48:03.154'),
	('cmsbx09jq00cr7dos8bne2cxz', 'cmsbx092x007h7dosf34r7zj6', 'LC-000002', '2026-07-21 10:00:00', 'Compra de mercadorias a prazo', 'POSTED', NULL, NULL, '2026-07-21 10:00:00', NULL, '2026-08-02 14:48:03.158'),
	('cmsbx0a5800ky7dos4fv1evef', 'cmsbx09mo00f37dostskf7we1', 'LC-000001', '2026-07-13 10:00:00', 'Recebimento de vendas do período', 'POSTED', NULL, NULL, '2026-07-13 10:00:00', NULL, '2026-08-02 14:48:03.932'),
	('cmsbx0a5d00l37dos17jdytms', 'cmsbx09mo00f37dostskf7we1', 'LC-000002', '2026-07-21 10:00:00', 'Compra de mercadorias a prazo', 'POSTED', NULL, NULL, '2026-07-21 10:00:00', NULL, '2026-08-02 14:48:03.937');
INSERT INTO public."JournalLine" (id, "journalEntryId", "accountId", type, amount, currency, "exchangeRate")
SELECT gen_random_uuid()::text, je.id, a.id, l.tipo, l.valor, 'PYG', 1
FROM public."JournalEntry" je
JOIN public."Tenant" t ON t.id = je."tenantId"
JOIN (VALUES ('LC-000001','1.1.01','DEBIT',18400000),
             ('LC-000001','4.1.01','CREDIT',18400000),
             ('LC-000002','1.2.02','DEBIT',9600000),
             ('LC-000002','2.1.01','CREDIT',9600000)) AS l(num, code, tipo, valor) ON l.num = je.number
JOIN public."Account" a ON a."tenantId" = je."tenantId" AND a.code = l.code
WHERE t.slug IN ('demo-store','demo-farm','demo-clinic');
INSERT INTO public."AuditLog" (id, "tenantId", "userId", action, entity, "entityId", details, "createdAt") VALUES
	('cmsbx08ij002g7doshzuim0ij', 'cmsbx08hy00007dosw14n0tar', NULL, 'PROVISION_TENANT', 'Tenant', 'cmsbx08hy00007dosw14n0tar', '{"nome": "AXIS Store — Demo", "slug": "demo-store", "modulos": ["store"], "vertical": "store", "emailAdmin": "demo@axisstore.com"}', '2026-08-02 14:48:01.82'),
	('cmsbx093c009x7dos6vzhih8m', 'cmsbx092x007h7dosf34r7zj6', NULL, 'PROVISION_TENANT', 'Tenant', 'cmsbx092x007h7dosf34r7zj6', '{"nome": "AXIS Farm — Demo", "slug": "demo-farm", "modulos": ["farm"], "vertical": "farm", "emailAdmin": "demo@axisfarm.com"}', '2026-08-02 14:48:02.568'),
	('cmsbx09n800hj7dosaltyk5sy', 'cmsbx09mo00f37dostskf7we1', NULL, 'PROVISION_TENANT', 'Tenant', 'cmsbx09mo00f37dostskf7we1', '{"nome": "AXIS Clinic — Demo", "slug": "demo-clinic", "modulos": ["clinic"], "vertical": "clinic", "emailAdmin": "demo@axisclinic.com"}', '2026-08-02 14:48:03.284');
INSERT INTO public."Harvest" (id, "tenantId", name, "cropType", "startDate", "endDate", status, "createdAt", "updatedAt") VALUES
	('cmsbx09jw00cw7dos7zgni4v7', 'cmsbx092x007h7dosf34r7zj6', 'Safra 2025/26', 'soja', '2025-09-15 00:00:00', '2026-03-30 00:00:00', 'COMPLETED', '2026-08-02 14:48:03.164', '2026-08-02 14:48:03.164'),
	('cmsbx09jy00cy7dosblvr0vv7', 'cmsbx092x007h7dosf34r7zj6', 'Safra 2026/27', 'soja', '2026-08-01 00:00:00', '2027-03-30 00:00:00', 'ACTIVE', '2026-08-02 14:48:03.167', '2026-08-02 14:48:03.167');
INSERT INTO public."Employee" (id, "tenantId", name, role, phone, status, "createdAt", "updatedAt") VALUES
	('cmsbx09k100d07dosx4g9qp1o', 'cmsbx092x007h7dosf34r7zj6', 'Ramón Duarte', 'tratorista', '0985 331 204', 'ACTIVE', '2026-08-02 14:48:03.169', '2026-08-02 14:48:03.169'),
	('cmsbx09k700d27doscp9dsdbp', 'cmsbx092x007h7dosf34r7zj6', 'Marta Giménez', 'auxiliar administrativo', '0983 550 917', 'ACTIVE', '2026-08-02 14:48:03.169', '2026-08-02 14:48:03.169'),
	('cmsbx09k800d47dosv2pz24ud', 'cmsbx092x007h7dosf34r7zj6', 'Julio Cáceres', 'operador de colheitadeira', '0972 118 445', 'ACTIVE', '2026-08-02 14:48:03.169', '2026-08-02 14:48:03.169'),
	('cmsbx09k900d67doslne0i7wo', 'cmsbx092x007h7dosf34r7zj6', 'Aníbal Ortiz', 'capataz', '0976 402 338', 'LEAVE', '2026-08-02 14:48:03.17', '2026-08-02 14:48:03.17'),
	('cmsbx09ke00d87dosdfz9wiq4', 'cmsbx092x007h7dosf34r7zj6', 'Laura Espínola', 'agrônoma', '0981 774 620', 'ACTIVE', '2026-08-02 14:48:03.17', '2026-08-02 14:48:03.17');
INSERT INTO public."Plot" (id, "tenantId", name, area, unit, "currentCrop", status, "harvestId", "createdAt", "updatedAt") VALUES
	('cmsbx09kj00dd7dosh1y9gufa', 'cmsbx092x007h7dosf34r7zj6', 'Talhão Palmar', 96.40, 'HECTARE', NULL, 'FALLOW', NULL, '2026-08-02 14:48:03.188', '2026-08-02 14:48:03.188'),
	('cmsbx09kj00da7dos628t1sg6', 'cmsbx092x007h7dosf34r7zj6', 'Talhão São João', 320.00, 'HECTARE', 'soja', 'PLANTED', 'cmsbx09jy00cy7dosblvr0vv7', '2026-08-02 14:48:03.187', '2026-08-02 14:48:03.187'),
	('cmsbx09kk00dg7dos96z93tvm', 'cmsbx092x007h7dosf34r7zj6', 'Talhão Corriente', 240.00, 'HECTARE', NULL, 'PREPARING', 'cmsbx09jy00cy7dosblvr0vv7', '2026-08-02 14:48:03.188', '2026-08-02 14:48:03.188'),
	('cmsbx09kk00df7dosj3jhnru2', 'cmsbx092x007h7dosf34r7zj6', 'Talhão Aguará', 185.50, 'HECTARE', 'milho', 'PLANTED', 'cmsbx09jy00cy7dosblvr0vv7', '2026-08-02 14:48:03.188', '2026-08-02 14:48:03.188'),
	('cmsbx09kk00di7dosp5mpohtz', 'cmsbx092x007h7dosf34r7zj6', 'Talhão Yvyrá', 410.00, 'HECTARE', 'soja', 'PLANTED', 'cmsbx09jy00cy7dosblvr0vv7', '2026-08-02 14:48:03.187', '2026-08-02 14:48:03.187');
INSERT INTO public."SoilAnalysis" (id, "tenantId", "plotId", date, ph, phosphorus, potassium, "organicMatter", recommendation, notes, "createdAt", "updatedAt") VALUES
	('cmsbx09kp00dj7dos4fohyn47', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09kj00da7dos628t1sg6', '2026-06-15 10:00:00', 5.80, 14.20, 0.32, 2.90, 'Calagem de 1,5 t/ha antes da semeadura.', NULL, '2026-08-02 14:48:03.193', '2026-08-02 14:48:03.193'),
	('cmsbx09kp00dk7dos5aaw48bz', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09kk00di7dosp5mpohtz', '2026-06-18 10:00:00', 6.20, 21.50, 0.48, 3.40, 'Fertilidade adequada. Manter adubação de manutenção.', NULL, '2026-08-02 14:48:03.193', '2026-08-02 14:48:03.193'),
	('cmsbx09kp00dl7dosmi40v2lr', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09kk00df7dosj3jhnru2', '2026-07-03 10:00:00', 5.40, 9.80, 0.21, 2.10, 'Corrigir acidez e reforçar potássio.', NULL, '2026-08-02 14:48:03.193', '2026-08-02 14:48:03.193');
INSERT INTO public."PlotApplication" (id, "tenantId", "plotId", "harvestId", "productId", quantity, "totalCost", date, "employeeId", notes, "createdAt", "updatedAt") VALUES
	('cmsbx09kv00dn7dosemjra6vg', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09kj00da7dos628t1sg6', 'cmsbx09jy00cy7dosblvr0vv7', 'cmsbx09fz00a77dos1e3sqq6n', 640.00, 19840000.00, '2026-07-09 10:00:00', 'cmsbx09k100d07dosx4g9qp1o', 'Dessecação pré-semeadura.', '2026-08-02 14:48:03.199', '2026-08-02 14:48:03.199'),
	('cmsbx09kz00dp7dosjyfmq1tb', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09kk00di7dosp5mpohtz', 'cmsbx09jy00cy7dosblvr0vv7', 'cmsbx09fs00a37doskud69owy', 205.00, 80975000.00, '2026-07-15 10:00:00', 'cmsbx09k100d07dosx4g9qp1o', 'Semeadura — 50 kg/ha.', '2026-08-02 14:48:03.204', '2026-08-02 14:48:03.204'),
	('cmsbx09l200dr7dosgv1uhw8b', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09kj00da7dos628t1sg6', 'cmsbx09jy00cy7dosblvr0vv7', 'cmsbx09fw00a57dosvc649v33', 9.60, 41760000.00, '2026-07-16 10:00:00', 'cmsbx09ke00d87dosdfz9wiq4', 'Adubação de base.', '2026-08-02 14:48:03.207', '2026-08-02 14:48:03.207'),
	('cmsbx09l500dt7dosx1gxjobo', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09kk00df7dosj3jhnru2', 'cmsbx09jy00cy7dosblvr0vv7', 'cmsbx09g200a97doszmcngfgc', 92.75, 13170500.00, '2026-07-26 10:00:00', 'cmsbx09ke00d87dosdfz9wiq4', 'Controlo preventivo de ferrugem.', '2026-08-02 14:48:03.209', '2026-08-02 14:48:03.209');
INSERT INTO public."IrrigationEvent" (id, "tenantId", "plotId", date, method, "durationHours", "flowRate", "volumeApplied", "employeeId", notes, "createdAt", "updatedAt") VALUES
	('cmsbx09la00du7dos1lxbrcsb', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09kj00da7dos628t1sg6', '2026-07-19 10:00:00', 'pivô central', 8.00, 120.00, 18.50, 'cmsbx09k100d07dosx4g9qp1o', NULL, '2026-08-02 14:48:03.214', '2026-08-02 14:48:03.214'),
	('cmsbx09la00dv7dosd7ncfv25', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09kk00df7dosj3jhnru2', '2026-07-27 10:00:00', 'pivô central', 6.50, 110.00, 14.20, 'cmsbx09k100d07dosx4g9qp1o', NULL, '2026-08-02 14:48:03.214', '2026-08-02 14:48:03.214');
INSERT INTO public."Silo" (id, "tenantId", name, capacity, unit, "currentStock", "createdAt", "updatedAt") VALUES
	('cmsbx09lf00e17dos6fnw1d2a', 'cmsbx092x007h7dosf34r7zj6', 'Silo 1 — Sede', 2500.00, 'TON', 1420.00, '2026-08-02 14:48:03.219', '2026-08-02 14:48:03.219'),
	('cmsbx09lf00dy7dosdgksevi9', 'cmsbx092x007h7dosf34r7zj6', 'Silo 3 — Palmar', 1200.00, 'TON', 0.00, '2026-08-02 14:48:03.219', '2026-08-02 14:48:03.219'),
	('cmsbx09lf00e07dosjeksarph', 'cmsbx092x007h7dosf34r7zj6', 'Silo 2 — Aguará', 1800.00, 'TON', 640.00, '2026-08-02 14:48:03.219', '2026-08-02 14:48:03.219');
INSERT INTO public."Contract" (id, "tenantId", "contractNumber", "harvestId", "siloName", "grainType", quantity, unit, "pricePerUnit", currency, status, "deliveryDate", notes, "createdAt", "updatedAt") VALUES
	('cmsbx09ll00e67dosinqjkbry', 'cmsbx092x007h7dosf34r7zj6', 'CT-2025-031', 'cmsbx09jw00cw7dos7zgni4v7', 'Silo 1 — Sede', 'soja', 950.00, 'TON', 372.00, 'USD', 'COMPLETED', '2026-05-04 10:00:00', NULL, '2026-08-02 14:48:03.225', '2026-08-02 14:48:03.225'),
	('cmsbx09ll00e47dosom6cirks', 'cmsbx092x007h7dosf34r7zj6', 'CT-2026-009', 'cmsbx09jy00cy7dosblvr0vv7', 'Silo 2 — Aguará', 'milho', 800.00, 'TON', 210.00, 'USD', 'ACTIVE', '2026-08-27 10:00:00', NULL, '2026-08-02 14:48:03.225', '2026-08-02 14:48:03.225'),
	('cmsbx09ll00e77dosp3dj1k0e', 'cmsbx092x007h7dosf34r7zj6', 'CT-2026-014', 'cmsbx09jy00cy7dosblvr0vv7', 'Silo 1 — Sede', 'soja', 1200.00, 'TON', 385.00, 'USD', 'ACTIVE', '2026-10-01 10:00:00', NULL, '2026-08-02 14:48:03.225', '2026-08-02 14:48:03.225');
INSERT INTO public."SiloMovement" (id, "tenantId", "siloId", type, quantity, date, "harvestId", "contractId", moisture, "qualityGrade", notes, "createdAt", "updatedAt") VALUES
	('cmsbx09lr00e87dos1zliizsh', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09lf00e17dos6fnw1d2a', 'IN', 880.00, '2026-06-23 10:00:00', 'cmsbx09jw00cw7dos7zgni4v7', NULL, 13.40, 'Tipo 1', NULL, '2026-08-02 14:48:03.231', '2026-08-02 14:48:03.231'),
	('cmsbx09lr00e97doslawq8wou', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09lf00e17dos6fnw1d2a', 'IN', 1050.00, '2026-06-30 10:00:00', 'cmsbx09jw00cw7dos7zgni4v7', NULL, 14.10, 'Tipo 1', NULL, '2026-08-02 14:48:03.231', '2026-08-02 14:48:03.231'),
	('cmsbx09lr00ea7dosx139b02f', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09lf00e17dos6fnw1d2a', 'OUT', 510.00, '2026-07-14 10:00:00', NULL, 'cmsbx09ll00e77dosp3dj1k0e', NULL, NULL, 'Entrega parcial CT-2026-014.', '2026-08-02 14:48:03.231', '2026-08-02 14:48:03.231'),
	('cmsbx09lr00eb7dosml5xw521', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09lf00e07dosjeksarph', 'IN', 760.00, '2026-07-04 10:00:00', 'cmsbx09jw00cw7dos7zgni4v7', NULL, 13.90, 'Tipo 2', NULL, '2026-08-02 14:48:03.231', '2026-08-02 14:48:03.231'),
	('cmsbx09lr00ec7dosd3m6h4f5', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09lf00e07dosjeksarph', 'OUT', 120.00, '2026-07-23 10:00:00', NULL, 'cmsbx09ll00e47dosom6cirks', NULL, NULL, NULL, '2026-08-02 14:48:03.231', '2026-08-02 14:48:03.231');
INSERT INTO public."LivestockBatch" (id, "tenantId", name, category, quantity, "averageWeight", location, status, "createdAt", "updatedAt") VALUES
	('cmsbx09lx00eh7dosr02jx74w', 'cmsbx092x007h7dosf34r7zj6', 'Lote Novilhos 2025', 'novilho', 186, 322.50, 'Piquete 4', 'ACTIVE', '2026-08-02 14:48:03.237', '2026-08-02 14:48:03.237'),
	('cmsbx09lx00eg7dosc3vd54kq', 'cmsbx092x007h7dosf34r7zj6', 'Lote Bezerros Desmama', 'bezerro', 72, 168.40, 'Piquete 7', 'ACTIVE', '2026-08-02 14:48:03.237', '2026-08-02 14:48:03.237'),
	('cmsbx09lx00ei7dos0ytoqkzi', 'cmsbx092x007h7dosf34r7zj6', 'Lote Vacas de Cria', 'vaca', 94, 431.00, 'Piquete 1', 'ACTIVE', '2026-08-02 14:48:03.237', '2026-08-02 14:48:03.237');
INSERT INTO public."LivestockEvent" (id, "tenantId", "batchId", type, date, weight, location, description, "employeeId", notes, "createdAt", "updatedAt") VALUES
	('cmsbx09m100ej7dosbcytgu22', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09lx00eh7dosr02jx74w', 'WEIGHING', '2026-06-28 10:00:00', 298.20, NULL, NULL, 'cmsbx09k900d67doslne0i7wo', NULL, '2026-08-02 14:48:03.242', '2026-08-02 14:48:03.242'),
	('cmsbx09m100ek7dosy4vok16n', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09lx00eh7dosr02jx74w', 'WEIGHING', '2026-07-28 10:00:00', 322.50, NULL, NULL, 'cmsbx09k900d67doslne0i7wo', 'Ganho médio de 0,81 kg/dia.', '2026-08-02 14:48:03.242', '2026-08-02 14:48:03.242'),
	('cmsbx09m100el7dos6nujxtkq', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09lx00eh7dosr02jx74w', 'MOVEMENT', '2026-07-12 10:00:00', NULL, 'Piquete 4', NULL, NULL, 'Rotação de pasto.', '2026-08-02 14:48:03.242', '2026-08-02 14:48:03.242'),
	('cmsbx09m100em7dosnv6lt5hf', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09lx00ei7dos0ytoqkzi', 'HEALTH', '2026-07-17 10:00:00', NULL, NULL, 'Vacinação contra febre aftosa.', 'cmsbx09ke00d87dosdfz9wiq4', NULL, '2026-08-02 14:48:03.242', '2026-08-02 14:48:03.242'),
	('cmsbx09m100en7doso0fvlkbv', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09lx00eg7dosc3vd54kq', 'HEALTH', '2026-07-24 10:00:00', NULL, NULL, 'Vermifugação e suplementação mineral.', NULL, NULL, '2026-08-02 14:48:03.242', '2026-08-02 14:48:03.242');
INSERT INTO public."Vehicle" (id, "tenantId", name, type, plate, status, "currentReading", "createdAt", "updatedAt") VALUES
	('cmsbx09m600es7dos3y48v4hq', 'cmsbx092x007h7dosf34r7zj6', 'Colheitadeira New Holland CR5.85', 'colheitadeira', NULL, 'MAINTENANCE', 2145.00, '2026-08-02 14:48:03.246', '2026-08-02 14:48:03.246'),
	('cmsbx09m600ev7dosqm1s4ww8', 'cmsbx092x007h7dosf34r7zj6', 'Pulverizador Jacto Uniport 3030', 'pulverizador', NULL, 'OPERATIONAL', 1390.00, '2026-08-02 14:48:03.246', '2026-08-02 14:48:03.246'),
	('cmsbx09m600ep7dosmcm10e29', 'cmsbx092x007h7dosf34r7zj6', 'Trator John Deere 6110J', 'trator', NULL, 'OPERATIONAL', 4820.00, '2026-08-02 14:48:03.246', '2026-08-02 14:48:03.246'),
	('cmsbx09m600eu7dosrgbkcan8', 'cmsbx092x007h7dosf34r7zj6', 'Caminhão Volvo VM 270', 'caminhao', 'AABB 123', 'OPERATIONAL', 182400.00, '2026-08-02 14:48:03.247', '2026-08-02 14:48:03.247');
INSERT INTO public."VehicleLog" (id, "tenantId", "vehicleId", type, date, "odometerOrHours", "employeeId", notes, liters, "fuelCost", description, "maintenanceCost", "createdAt", "updatedAt") VALUES
	('cmsbx09mb00ew7dosb1d16jd4', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09m600ep7dosmcm10e29', 'FUEL', '2026-07-13 10:00:00', 4762.00, 'cmsbx09k100d07dosx4g9qp1o', NULL, 180.00, 1602000.00, NULL, NULL, '2026-08-02 14:48:03.251', '2026-08-02 14:48:03.251'),
	('cmsbx09mb00ex7dosbyeeh7va', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09m600ep7dosmcm10e29', 'MAINTENANCE', '2026-07-22 10:00:00', 4800.00, NULL, NULL, NULL, NULL, 'Troca de óleo e filtros — 4.800 h.', 2450000.00, '2026-08-02 14:48:03.251', '2026-08-02 14:48:03.251'),
	('cmsbx09mb00ey7dos1uninvf0', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09m600es7dos3y48v4hq', 'MAINTENANCE', '2026-07-30 10:00:00', 2145.00, NULL, NULL, NULL, NULL, 'Substituição de correia do rotor.', 6800000.00, '2026-08-02 14:48:03.251', '2026-08-02 14:48:03.251'),
	('cmsbx09mb00ez7dosvebgwtjf', 'cmsbx092x007h7dosf34r7zj6', 'cmsbx09m600eu7dosrgbkcan8', 'FUEL', '2026-07-27 10:00:00', 182120.00, 'cmsbx09k800d47dosv2pz24ud', NULL, 320.00, 2848000.00, NULL, NULL, '2026-08-02 14:48:03.251', '2026-08-02 14:48:03.251');
INSERT INTO public."Certification" (id, "tenantId", name, "issuingBody", "certificateNumber", "issueDate", "expiryDate", status, scope, notes, "createdAt", "updatedAt") VALUES
	('cmsbx09mf00f07doserfy27d3', 'cmsbx092x007h7dosf34r7zj6', 'GLOBALG.A.P. — Crops', 'FoodPLUS GmbH', 'GGN-4059883174562', '2026-02-13 10:00:00', '2027-02-13 10:00:00', 'ACTIVE', 'Talhões São João e Yvyrá — Soja', NULL, '2026-08-02 14:48:03.255', '2026-08-02 14:48:03.255'),
	('cmsbx09mf00f17dosdqg5tkfx', 'cmsbx092x007h7dosf34r7zj6', 'Certificação Orgânica IBD', 'IBD Certificações', 'IBD-2025-08841', '2025-09-16 10:00:00', '2026-09-16 10:00:00', 'ACTIVE', 'Talhão Palmar — pousio orgânico', NULL, '2026-08-02 14:48:03.255', '2026-08-02 14:48:03.255'),
	('cmsbx09mf00f27doszn5zoyvl', 'cmsbx092x007h7dosf34r7zj6', 'Rainforest Alliance', 'Rainforest Alliance', 'RA-PY-11207', '2024-12-10 10:00:00', '2026-04-04 10:00:00', 'EXPIRED', 'Unidade produtiva — auditoria de 2024', NULL, '2026-08-02 14:48:03.255', '2026-08-02 14:48:03.255');
INSERT INTO public."Professional" (id, "tenantId", name, specialty, color, "workingHours", "userId", active, "createdAt", "updatedAt") VALUES
	('cmsbx0a5j00l97doshn7f08jp', 'cmsbx09mo00f37dostskf7we1', 'Dr. Rodrigo Meza', 'Cardiologia', '#2f6690', '{"fri": [["08:00", "12:00"]], "mon": [["08:00", "12:00"], ["14:00", "18:00"]], "thu": [["08:00", "12:00"], ["14:00", "18:00"]], "tue": [["08:00", "12:00"], ["14:00", "18:00"]], "wed": [["08:00", "12:00"], ["14:00", "18:00"]]}', NULL, true, '2026-08-02 14:48:03.944', '2026-08-02 14:48:03.944'),
	('cmsbx0a5j00la7dosbvttdx6z', 'cmsbx09mo00f37dostskf7we1', 'Dra. Andrea Villalba', 'Clínica geral', '#3e5c50', '{"fri": [["08:00", "12:00"]], "mon": [["08:00", "12:00"], ["14:00", "18:00"]], "thu": [["08:00", "12:00"], ["14:00", "18:00"]], "tue": [["08:00", "12:00"], ["14:00", "18:00"]], "wed": [["08:00", "12:00"], ["14:00", "18:00"]]}', NULL, true, '2026-08-02 14:48:03.944', '2026-08-02 14:48:03.944'),
	('cmsbx0a5j00lc7dosdlnzmjom', 'cmsbx09mo00f37dostskf7we1', 'Dra. Lucía Franco', 'Dermatologia', '#8c5b3e', '{"fri": [["08:00", "12:00"]], "mon": [["08:00", "12:00"], ["14:00", "18:00"]], "thu": [["08:00", "12:00"], ["14:00", "18:00"]], "tue": [["08:00", "12:00"], ["14:00", "18:00"]], "wed": [["08:00", "12:00"], ["14:00", "18:00"]]}', NULL, true, '2026-08-02 14:48:03.944', '2026-08-02 14:48:03.944');
INSERT INTO public."Service" (id, "tenantId", name, "durationMin", price, active, "createdAt", "updatedAt") VALUES
	('cmsbx0a5p00lj7dos5pici6fx', 'cmsbx09mo00f37dostskf7we1', 'Consulta dermatológica', 30, 350000.000000000000000000000000000000, true, '2026-08-02 14:48:03.949', '2026-08-02 14:48:03.949'),
	('cmsbx0a5p00le7dosc27rrb59', 'cmsbx09mo00f37dostskf7we1', 'Consulta clínica geral', 30, 250000.000000000000000000000000000000, true, '2026-08-02 14:48:03.949', '2026-08-02 14:48:03.949'),
	('cmsbx0a5p00lk7dos3rqy5608', 'cmsbx09mo00f37dostskf7we1', 'Retorno / revisão', 20, 120000.000000000000000000000000000000, true, '2026-08-02 14:48:03.949', '2026-08-02 14:48:03.949'),
	('cmsbx0a5p00li7dosixlg3wkx', 'cmsbx09mo00f37dostskf7we1', 'Eletrocardiograma', 20, 190000.000000000000000000000000000000, true, '2026-08-02 14:48:03.949', '2026-08-02 14:48:03.949'),
	('cmsbx0a5p00lm7doswwasdoil', 'cmsbx09mo00f37dostskf7we1', 'Aplicação de vacina', 15, 95000.000000000000000000000000000000, true, '2026-08-02 14:48:03.949', '2026-08-02 14:48:03.949'),
	('cmsbx0a5y00lo7dosgj78hwk8', 'cmsbx09mo00f37dostskf7we1', 'Consulta cardiológica', 40, 380000.000000000000000000000000000000, true, '2026-08-02 14:48:03.95', '2026-08-02 14:48:03.95');
INSERT INTO public."Appointment" (id, "tenantId", "patientId", "professionalId", "serviceId", "startsAt", "endsAt", status, "clinicalNotes", "chargedAmount", "invoiceId", "createdAt", "updatedAt") VALUES
	('cmsbx0a6600lq7dosbx40ejdc', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a1e00i97dos3o0cw7iz', 'cmsbx0a5j00la7dosbvttdx6z', 'cmsbx0a5p00le7dosc27rrb59', '2026-07-27 08:00:00', '2026-07-27 08:30:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 250000.000000000000000000000000000000, NULL, '2026-08-02 14:48:03.966', '2026-08-02 14:48:03.966'),
	('cmsbx0a6b00ls7dos4txduqbr', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a1i00ib7dos91r7xirg', 'cmsbx0a5j00la7dosbvttdx6z', 'cmsbx0a5p00lk7dos3rqy5608', '2026-07-27 09:00:00', '2026-07-27 09:20:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 120000.000000000000000000000000000000, NULL, '2026-08-02 14:48:03.972', '2026-08-02 14:48:03.972'),
	('cmsbx0a6e00lu7dosq2ofv1by', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a1o00if7dos7v3twm34', 'cmsbx0a5j00l97doshn7f08jp', 'cmsbx0a5y00lo7dosgj78hwk8', '2026-07-27 10:30:00', '2026-07-27 11:10:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 380000.000000000000000000000000000000, NULL, '2026-08-02 14:48:03.975', '2026-08-02 14:48:03.975'),
	('cmsbx0a6h00lw7dosw6pbupdn', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a2200in7dosk9dtoiy2', 'cmsbx0a5j00lc7dosdlnzmjom', 'cmsbx0a5p00lj7dos5pici6fx', '2026-07-27 14:00:00', '2026-07-27 14:30:00', 'FALTOU', NULL, NULL, NULL, '2026-08-02 14:48:03.978', '2026-08-02 14:48:03.978'),
	('cmsbx0a6k00ly7dos527i5161', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a1s00ih7doskj1z62xa', 'cmsbx0a5j00la7dosbvttdx6z', 'cmsbx0a5p00le7dosc27rrb59', '2026-07-27 15:30:00', '2026-07-27 16:00:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 250000.000000000000000000000000000000, NULL, '2026-08-02 14:48:03.981', '2026-08-02 14:48:03.981'),
	('cmsbx0a6o00m07dos6rl25zy0', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a1l00id7dosamaef7s6', 'cmsbx0a5j00la7dosbvttdx6z', 'cmsbx0a5p00le7dosc27rrb59', '2026-07-28 08:30:00', '2026-07-28 09:00:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 250000.000000000000000000000000000000, NULL, '2026-08-02 14:48:03.984', '2026-08-02 14:48:03.984'),
	('cmsbx0a6r00m27dosvfk0jvu7', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a1o00if7dos7v3twm34', 'cmsbx0a5j00l97doshn7f08jp', 'cmsbx0a5p00li7dosixlg3wkx', '2026-07-28 09:30:00', '2026-07-28 09:50:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 190000.000000000000000000000000000000, NULL, '2026-08-02 14:48:03.987', '2026-08-02 14:48:03.987'),
	('cmsbx0a6t00m47dosrzw7skbc', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a1v00ij7dosnp27h2om', 'cmsbx0a5j00lc7dosdlnzmjom', 'cmsbx0a5p00lj7dos5pici6fx', '2026-07-28 11:00:00', '2026-07-28 11:30:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 350000.000000000000000000000000000000, NULL, '2026-08-02 14:48:03.99', '2026-08-02 14:48:03.99'),
	('cmsbx0a6w00m67doslv9gq0k9', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a1z00il7dosy9xy0i15', 'cmsbx0a5j00la7dosbvttdx6z', 'cmsbx0a5p00lm7doswwasdoil', '2026-07-28 14:30:00', '2026-07-28 14:45:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 95000.000000000000000000000000000000, NULL, '2026-08-02 14:48:03.993', '2026-08-02 14:48:03.993'),
	('cmsbx0a6z00m87dosx1y5ydwa', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a1e00i97dos3o0cw7iz', 'cmsbx0a5j00l97doshn7f08jp', 'cmsbx0a5y00lo7dosgj78hwk8', '2026-07-29 08:00:00', '2026-07-29 08:40:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 380000.000000000000000000000000000000, NULL, '2026-08-02 14:48:03.995', '2026-08-02 14:48:03.995'),
	('cmsbx0a7300ma7dosur366kqt', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a1v00ij7dosnp27h2om', 'cmsbx0a5j00la7dosbvttdx6z', 'cmsbx0a5p00le7dosc27rrb59', '2026-07-29 10:00:00', '2026-07-29 10:30:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 250000.000000000000000000000000000000, NULL, '2026-08-02 14:48:03.999', '2026-08-02 14:48:03.999'),
	('cmsbx0a7600mc7dos223zl64t', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a2200in7dosk9dtoiy2', 'cmsbx0a5j00lc7dosdlnzmjom', 'cmsbx0a5p00lj7dos5pici6fx', '2026-07-29 15:00:00', '2026-07-29 15:30:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 350000.000000000000000000000000000000, NULL, '2026-08-02 14:48:04.002', '2026-08-02 14:48:04.002'),
	('cmsbx0a7900me7dosm6wyavys', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a1z00il7dosy9xy0i15', 'cmsbx0a5j00la7dosbvttdx6z', 'cmsbx0a5p00le7dosc27rrb59', '2026-07-30 09:00:00', '2026-07-30 09:30:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 250000.000000000000000000000000000000, NULL, '2026-08-02 14:48:04.005', '2026-08-02 14:48:04.005'),
	('cmsbx0a7c00mg7dosh79lckmn', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a1o00if7dos7v3twm34', 'cmsbx0a5j00l97doshn7f08jp', 'cmsbx0a5p00li7dosixlg3wkx', '2026-07-30 10:30:00', '2026-07-30 10:50:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 190000.000000000000000000000000000000, NULL, '2026-08-02 14:48:04.008', '2026-08-02 14:48:04.008'),
	('cmsbx0a7e00mi7dos4lmzrcvr', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a1i00ib7dos91r7xirg', 'cmsbx0a5j00la7dosbvttdx6z', 'cmsbx0a5p00lk7dos3rqy5608', '2026-07-30 14:00:00', '2026-07-30 14:20:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 120000.000000000000000000000000000000, NULL, '2026-08-02 14:48:04.01', '2026-08-02 14:48:04.01'),
	('cmsbx0a7h00mk7doscf45nbx5', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a1l00id7dosamaef7s6', 'cmsbx0a5j00lc7dosdlnzmjom', 'cmsbx0a5p00lj7dos5pici6fx', '2026-07-30 16:00:00', '2026-07-30 16:30:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 350000.000000000000000000000000000000, NULL, '2026-08-02 14:48:04.013', '2026-08-02 14:48:04.013'),
	('cmsbx0a7j00mm7dosm3308bta', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a1s00ih7doskj1z62xa', 'cmsbx0a5j00la7dosbvttdx6z', 'cmsbx0a5p00le7dosc27rrb59', '2026-07-31 08:30:00', '2026-07-31 09:00:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 250000.000000000000000000000000000000, NULL, '2026-08-02 14:48:04.015', '2026-08-02 14:48:04.015'),
	('cmsbx0a7l00mo7dos15k5jq50', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a1e00i97dos3o0cw7iz', 'cmsbx0a5j00l97doshn7f08jp', 'cmsbx0a5y00lo7dosgj78hwk8', '2026-07-31 10:00:00', '2026-07-31 10:40:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 380000.000000000000000000000000000000, NULL, '2026-08-02 14:48:04.018', '2026-08-02 14:48:04.018'),
	('cmsbx0a7o00mq7dosrj2cdiqe', 'cmsbx09mo00f37dostskf7we1', 'cmsbx0a1v00ij7dosnp27h2om', 'cmsbx0a5j00la7dosbvttdx6z', 'cmsbx0a5p00lm7doswwasdoil', '2026-07-31 11:00:00', '2026-07-31 11:15:00', 'CONCLUIDA', 'Paciente estável. Retorno em 30 dias.', 95000.000000000000000000000000000000, NULL, '2026-08-02 14:48:04.02', '2026-08-02 14:48:04.02');
COMMIT;
