/**
 * Contas de demonstração — uma por vertical: store, farm e clinic.
 *
 * Serve para apresentar o ERP sem tocar em dados de clientes reais. Cada
 * vertical é um cliente (tenant) próprio, com o seu subdomínio, os seus
 * módulos e dados que enchem os ecrãs: faturas ao longo do último mês para o
 * dashboard ter linha de tendência, estoque com mínimos, talhões e rebanho no
 * farm, agenda da semana corrente no clinic.
 *
 * Uso:
 *   npx tsx prisma/seed-demo.ts
 *   DEMO_PASSWORD='outra-senha' npx tsx prisma/seed-demo.ts
 *
 * Duas decisões que merecem explicação:
 *
 * 1. O cliente é criado por `provisionTenant()` — a MESMA função que provisiona
 *    um cliente pago. Se a demonstração usasse um caminho próprio, mostraria um
 *    sistema que não é o que se entrega, e as permissões dos módulos ficariam
 *    diferentes das reais.
 *
 * 2. A senha é definida aqui, o que o provisionamento normal nunca faz (o
 *    cliente define a dele por link de uso único, para o fornecedor não
 *    conhecer credenciais alheias). Numa conta de demonstração é o contrário:
 *    a senha TEM de ser conhecida, porque é para ser mostrada. Por isso estas
 *    contas vivem em clientes só de demonstração, sem dados de ninguém.
 *
 * Idempotente: correr outra vez repõe a senha e completa o que faltar, sem
 * duplicar nada nem apagar o que já lá está.
 */

import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import prisma from "../src/lib/prisma.ts";
import { provisionTenant } from "../src/lib/provisioning.ts";
import { digitoVerificador } from "../src/lib/ruc.ts";
import { calculateTax } from "../src/lib/tax.ts";

// ─── Configuração ───────────────────────────────────────────

/** Senha das três contas. Igual nas três: numa apresentação escreve-se ao vivo. */
const SENHA = process.env.DEMO_PASSWORD || "Axis@Demo2026";

type Vertical = "store" | "farm" | "clinic";

type Demo = {
  vertical: Vertical;
  nome: string;
  slug: string;
  email: string;
  nomeAdmin: string;
  businessName: string;
  tradeName: string;
  /** Base do RUC, sem verificador — o dígito é calculado, nunca inventado. */
  rucBase: string;
  address: string;
  economicActivity: string;
};

const DEMOS: Demo[] = [
  {
    vertical: "store",
    nome: "AXIS Store — Demo",
    slug: "demo-store",
    email: "demo@axisstore.com",
    nomeAdmin: "Demonstração Store",
    businessName: "Comercial Aurora S.A.",
    tradeName: "Aurora Tecnologia",
    rucBase: "80087412",
    address: "Av. Mariscal López 1234, Asunción",
    economicActivity: "Comércio a retalho de equipamento informático",
  },
  {
    vertical: "farm",
    nome: "AXIS Farm — Demo",
    slug: "demo-farm",
    email: "demo@axisfarm.com",
    nomeAdmin: "Demonstração Farm",
    businessName: "Estancia Guaraní S.A.",
    tradeName: "Estancia Guaraní",
    rucBase: "80059273",
    address: "Ruta PY02 km 218, Colonia Independencia, Guairá",
    economicActivity: "Produção agrícola e pecuária",
  },
  {
    vertical: "clinic",
    nome: "AXIS Clinic — Demo",
    slug: "demo-clinic",
    email: "demo@axisclinic.com",
    nomeAdmin: "Demonstração Clinic",
    businessName: "Clínica San Rafael S.A.",
    tradeName: "Clínica San Rafael",
    rucBase: "80064158",
    address: "Av. España 890, Asunción",
    economicActivity: "Atividades de atenção à saúde humana",
  },
];

// ─── Utilitários ────────────────────────────────────────────

/** RUC completo a partir da base, com o verificador calculado (src/lib/ruc.ts). */
function ruc(base: string): string {
  return `${base}-${digitoVerificador(base)}`;
}

const DIA = 86_400_000;

/** Data de há `n` dias, à hora indicada. Tudo no seed é relativo a hoje. */
function haDias(n: number, hora = 10, minuto = 0): Date {
  const d = new Date(Date.now() - n * DIA);
  d.setHours(hora, minuto, 0, 0);
  return d;
}

/** Segunda-feira 00:00 da semana corrente — a agenda do clinic assenta nela. */
function segundaDestaSemana(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dia = d.getDay(); // 0 = domingo
  d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
  return d;
}

/** Dia da semana corrente (0 = segunda), à hora indicada. */
function diaDaSemana(indice: number, hora: number, minuto = 0): Date {
  const d = segundaDestaSemana();
  d.setDate(d.getDate() + indice);
  d.setHours(hora, minuto, 0, 0);
  return d;
}

function dec(v: number | string): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

// ─── Cliente e utilizador ───────────────────────────────────

/**
 * Garante o cliente de demonstração. Cria-o pelo provisionamento normal na
 * primeira vez; nas seguintes reaproveita o que existe.
 */
async function garantirTenant(d: Demo): Promise<string> {
  const existente = await prisma.tenant.findUnique({
    where: { slug: d.slug },
    select: { id: true },
  });

  let tenantId: string;

  if (existente) {
    tenantId = existente.id;
    console.log(`  cliente ${d.slug} já existia — a completar`);
  } else {
    const r = await provisionTenant({
      nome: d.nome,
      slug: d.slug,
      emailAdmin: d.email,
      nomeAdmin: d.nomeAdmin,
      vertical: d.vertical,
    });
    tenantId = r.tenantId;
    console.log(`  cliente ${d.slug} provisionado`);
  }

  // Dados fiscais de fachada. O provisionamento deixa-os por preencher de
  // propósito (são do cliente real); numa demonstração os ecrãs precisam deles.
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      name: d.nome,
      businessName: d.businessName,
      tradeName: d.tradeName,
      ruc: ruc(d.rucBase),
      address: d.address,
      economicActivity: d.economicActivity,
      establishment: "001",
      emissionPoint: "001",
      taxpayerType: "2",
      modules: [d.vertical],
    },
  });

  return tenantId;
}

async function definirSenha(email: string): Promise<void> {
  const user = await prisma.user.update({
    where: { email },
    data: { password: await hash(SENHA, 12), mustChangePassword: false },
    select: { id: true },
  });

  // Queima os links de configuração por usar. A conta já tem senha conhecida;
  // deixar um link válido a apontar para ela seria uma segunda via sem dono.
  await prisma.passwordSetupToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });
}

// ─── Dados comuns a qualquer vertical ───────────────────────

/**
 * Timbrado ativo. Sem ele não se emite nada (src/lib/timbrado.ts), e emitir
 * uma fatura ao vivo é meia apresentação.
 */
async function garantirTimbrado(tenantId: string, numero: string): Promise<void> {
  const ano = new Date().getFullYear();
  await prisma.timbrado.upsert({
    where: {
      tenantId_numero_establishment_emissionPoint: {
        tenantId,
        numero,
        establishment: "001",
        emissionPoint: "001",
      },
    },
    update: { isActive: true },
    create: {
      tenantId,
      numero,
      establishment: "001",
      emissionPoint: "001",
      validFrom: new Date(ano, 0, 1),
      validTo: new Date(ano + 1, 11, 31),
      rangeFrom: 1,
      rangeTo: 9_999_999,
      isActive: true,
    },
  });
}

async function garantirCambio(tenantId: string): Promise<void> {
  const tem = await prisma.exchangeRate.count({ where: { tenantId } });
  if (tem > 0) return;

  await prisma.exchangeRate.create({
    data: {
      tenantId,
      ratePYGtoUSD: dec(7_320),
      ratePYGtoBRL: dec(1_285),
      source: "BCP_API",
      isManual: false,
    },
  });
}

type ProdutoDemo = {
  sku: string;
  name: string;
  price: number;
  cost: number;
  currentStock: number;
  minStock: number;
  unit?: string;
  isService?: boolean;
};

async function semearProdutos(tenantId: string, produtos: ProdutoDemo[]): Promise<void> {
  for (const p of produtos) {
    await prisma.product.upsert({
      where: { tenantId_sku: { tenantId, sku: p.sku } },
      update: {
        name: p.name,
        price: dec(p.price),
        cost: dec(p.cost),
        currentStock: dec(p.currentStock),
        minStock: dec(p.minStock),
        unit: p.unit ?? "un",
        isService: p.isService ?? false,
      },
      create: {
        tenantId,
        sku: p.sku,
        name: p.name,
        price: dec(p.price),
        cost: dec(p.cost),
        currentStock: dec(p.currentStock),
        minStock: dec(p.minStock),
        unit: p.unit ?? "un",
        isService: p.isService ?? false,
      },
    });
  }

  // Espelha o estoque no depósito principal: a página de multi-depósito
  // ficaria a zeros enquanto a de produtos mostrava saldo, o que numa
  // apresentação parece um erro do sistema.
  const deposito = await prisma.warehouse.findFirst({
    where: { tenantId, isDefault: true },
    select: { id: true },
  });
  if (!deposito) return;

  const linhas = await prisma.product.findMany({
    where: { tenantId, isService: false },
    select: { id: true, currentStock: true },
  });

  for (const l of linhas) {
    await prisma.warehouseStock.upsert({
      where: { warehouseId_productId: { warehouseId: deposito.id, productId: l.id } },
      update: { quantity: l.currentStock },
      create: { warehouseId: deposito.id, productId: l.id, quantity: l.currentStock },
    });
  }
}

type ClienteDemo = {
  name: string;
  document: string;
  documentType: string;
  email?: string;
  phone?: string;
  city?: string;
  category?: string;
  birthDate?: Date;
  healthNotes?: string;
};

async function semearClientes(tenantId: string, clientes: ClienteDemo[]): Promise<void> {
  for (const c of clientes) {
    const existe = await prisma.customer.findFirst({
      where: { tenantId, document: c.document },
      select: { id: true },
    });
    if (existe) continue;

    await prisma.customer.create({ data: { tenantId, country: "PY", ...c } });
  }
}

type FornecedorDemo = {
  name: string;
  businessName: string;
  document: string;
  documentType: string;
  email?: string;
  country?: string;
  paymentTerms?: string;
};

async function semearFornecedores(tenantId: string, fs: FornecedorDemo[]): Promise<void> {
  for (const f of fs) {
    const existe = await prisma.supplier.findFirst({
      where: { tenantId, document: f.document },
      select: { id: true },
    });
    if (existe) continue;

    await prisma.supplier.create({ data: { tenantId, country: "PY", ...f } });
  }
}

/**
 * Faturas de venda ao longo do último mês, mais duas compras.
 *
 * As vendas ficam espalhadas por dias diferentes de propósito: o dashboard
 * agrupa por dia, e todas na mesma data dariam um gráfico de uma só barra.
 */
async function semearFaturas(
  tenantId: string,
  timbrado: string,
  vendasPorDia: Array<{ dias: number; skus: Array<[string, number]> }>
): Promise<void> {
  const jaTem = await prisma.commercialInvoice.count({ where: { tenantId } });
  if (jaTem > 0) return;

  const produtos = await prisma.product.findMany({
    where: { tenantId },
    select: { id: true, sku: true, price: true, cost: true },
  });
  const porSku = new Map(produtos.map((p) => [p.sku, p]));

  const clientes = await prisma.customer.findMany({
    where: { tenantId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const fornecedores = await prisma.supplier.findMany({
    where: { tenantId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (clientes.length === 0) return;

  const deposito = await prisma.warehouse.findFirst({
    where: { tenantId, isDefault: true },
    select: { id: true },
  });

  let sequencial = 0;

  for (const venda of vendasPorDia) {
    sequencial += 1;
    const numero = `001-001-${String(sequencial).padStart(7, "0")}`;
    const emitida = haDias(venda.dias, 9 + (sequencial % 8));
    const cliente = clientes[sequencial % clientes.length];

    const itens = venda.skus
      .map(([sku, qtd]) => {
        const p = porSku.get(sku);
        if (!p) return null;
        const total = dec(p.price).times(qtd);
        const { taxAmount, taxBase } = calculateTax(total, "IVA_10");
        return {
          productId: p.id,
          sku,
          quantity: dec(qtd),
          unitPrice: dec(p.price),
          totalPrice: total,
          taxType: "IVA_10" as const,
          taxBase,
          taxAmount,
          cost: dec(p.cost),
        };
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);

    if (itens.length === 0) continue;

    const totalAmount = itens.reduce((s, i) => s.plus(i.totalPrice), dec(0));
    const totalIva10 = itens.reduce((s, i) => s.plus(i.taxAmount), dec(0));

    const fatura = await prisma.commercialInvoice.create({
      data: {
        tenantId,
        type: "SALES",
        status: "APPROVED",
        documentNumber: numero,
        timbrado,
        customerId: cliente.id,
        issuedAt: emitida,
        currency: "PYG",
        totalAmount,
        totalIva10,
        items: { create: itens },
      },
      select: { id: true },
    });

    // Saída de estoque, para a página de movimentos não nascer vazia.
    for (const i of itens) {
      await prisma.inventoryMovement.create({
        data: {
          tenantId,
          productId: i.productId,
          type: "SAIDA",
          quantity: i.quantity,
          unitCost: i.cost,
          totalCost: i.cost ? dec(i.cost).times(i.quantity) : null,
          reason: `Venda ${numero}`,
          warehouseId: deposito?.id ?? null,
          commercialInvoiceId: fatura.id,
          createdAt: emitida,
        },
      });
    }

    // Duas em cada três já pagas: contas a receber com saldo em aberto e
    // recebimentos no histórico, que é o que se quer mostrar no financeiro.
    if (sequencial % 3 !== 0) {
      await prisma.payment.create({
        data: {
          tenantId,
          commercialInvoiceId: fatura.id,
          amount: totalAmount,
          currency: "PYG",
          method: sequencial % 2 === 0 ? "CASH" : "BANK_TRANSFER",
          paidAt: new Date(emitida.getTime() + DIA),
        },
      });
    }
  }

  // Compras: sem elas o dashboard mostra margem igual à receita.
  if (fornecedores.length > 0) {
    const compras = [
      { dias: 26, sku: [...porSku.keys()][0], qtd: 10 },
      { dias: 12, sku: [...porSku.keys()][1] ?? [...porSku.keys()][0], qtd: 20 },
    ];

    let seqCompra = 0;
    for (const c of compras) {
      const p = porSku.get(c.sku);
      if (!p) continue;
      seqCompra += 1;

      const total = dec(p.cost).times(c.qtd);
      const { taxAmount, taxBase } = calculateTax(total, "IVA_10");
      const emitida = haDias(c.dias, 15);

      await prisma.commercialInvoice.create({
        data: {
          tenantId,
          type: "PURCHASE",
          status: "APPROVED",
          documentNumber: `001-002-${String(seqCompra).padStart(7, "0")}`,
          supplierId: fornecedores[seqCompra % fornecedores.length].id,
          issuedAt: emitida,
          currency: "PYG",
          totalAmount: total,
          totalIva10: taxAmount,
          items: {
            create: [
              {
                productId: p.id,
                sku: p.sku,
                quantity: dec(c.qtd),
                unitPrice: dec(p.cost),
                totalPrice: total,
                taxType: "IVA_10",
                taxBase,
                taxAmount,
                cost: dec(p.cost),
              },
            ],
          },
        },
      });
    }
  }
}

/**
 * Dois lançamentos contabilísticos, equilibrados. A contabilidade é um dos
 * ecrãs que se mostra, e um razão vazio não diz nada sobre o produto.
 */
async function semearContabilidade(tenantId: string): Promise<void> {
  const jaTem = await prisma.journalEntry.count({ where: { tenantId } });
  if (jaTem > 0) return;

  const contas = await prisma.account.findMany({
    where: { tenantId },
    select: { id: true, code: true },
  });
  const porCodigo = new Map(contas.map((c) => [c.code, c.id]));

  const caixa = porCodigo.get("1.1.01");
  const receita = porCodigo.get("4.1.01");
  const fornecedores = porCodigo.get("2.1.01");
  const estoque = porCodigo.get("1.2.02");
  if (!caixa || !receita || !fornecedores || !estoque) return;

  const lancamentos = [
    {
      number: "LC-000001",
      date: haDias(20),
      description: "Recebimento de vendas do período",
      linhas: [
        { accountId: caixa, type: "DEBIT", amount: dec(18_400_000) },
        { accountId: receita, type: "CREDIT", amount: dec(18_400_000) },
      ],
    },
    {
      number: "LC-000002",
      date: haDias(12),
      description: "Compra de mercadorias a prazo",
      linhas: [
        { accountId: estoque, type: "DEBIT", amount: dec(9_600_000) },
        { accountId: fornecedores, type: "CREDIT", amount: dec(9_600_000) },
      ],
    },
  ];

  for (const l of lancamentos) {
    await prisma.journalEntry.create({
      data: {
        tenantId,
        number: l.number,
        date: l.date,
        description: l.description,
        status: "POSTED",
        postedAt: l.date,
        lines: { create: l.linhas },
      },
    });
  }
}

// ─── Vertical: store ────────────────────────────────────────

async function semearStore(tenantId: string): Promise<void> {
  await garantirTimbrado(tenantId, "12557896");

  await semearProdutos(tenantId, [
    { sku: "NB-001", name: 'Notebook Lenovo IdeaPad 15"', price: 4_850_000, cost: 3_900_000, currentStock: 12, minStock: 3 },
    { sku: "MON-002", name: 'Monitor LG 24" Full HD', price: 1_290_000, cost: 980_000, currentStock: 25, minStock: 5 },
    { sku: "TEC-003", name: "Teclado mecânico Redragon Kumara", price: 320_000, cost: 210_000, currentStock: 40, minStock: 10 },
    { sku: "MOU-004", name: "Mouse sem fio Logitech M280", price: 145_000, cost: 92_000, currentStock: 60, minStock: 15 },
    { sku: "IMP-005", name: "Impressora Epson EcoTank L3250", price: 1_750_000, cost: 1_380_000, currentStock: 8, minStock: 2 },
    { sku: "CAB-006", name: "Cabo HDMI 2.0 — 2 m", price: 65_000, cost: 32_000, currentStock: 120, minStock: 30 },
    { sku: "SSD-007", name: "SSD Kingston NV2 1 TB", price: 690_000, cost: 520_000, currentStock: 30, minStock: 8 },
    // Abaixo do mínimo de propósito: o alerta de estoque baixo tem de aparecer.
    { sku: "FON-008", name: "Fone de ouvido JBL Tune 520BT", price: 385_000, cost: 260_000, currentStock: 4, minStock: 12 },
    { sku: "SRV-001", name: "Instalação e configuração (hora técnica)", price: 250_000, cost: 0, currentStock: 0, minStock: 0, unit: "hora", isService: true },
  ]);

  await semearClientes(tenantId, [
    { name: "María Fernanda Ayala", document: "3845219", documentType: "CI", email: "mf.ayala@email.com", phone: "0981 442 118", city: "Asunción", category: "retail" },
    { name: "Distribuidora del Este S.R.L.", document: ruc("80028461"), documentType: "RUC", email: "compras@deleste.com.py", phone: "021 445 900", city: "Ciudad del Este", category: "wholesale" },
    { name: "Tecno Import S.A.", document: ruc("80031947"), documentType: "RUC", email: "admin@tecnoimport.com.py", city: "Asunción", category: "wholesale" },
    { name: "Carlos Benítez", document: "2117884", documentType: "CI", email: "cbenitez@email.com", phone: "0971 208 553", city: "Lambaré", category: "retail" },
    { name: "Colegio San Andrés", document: ruc("80042336"), documentType: "RUC", email: "administracion@sanandres.edu.py", city: "San Lorenzo", category: "vip" },
  ]);

  await semearFornecedores(tenantId, [
    { name: "Tech Import Paraguay", businessName: "Tech Import Paraguay S.A.", document: ruc("80017725"), documentType: "RUC", email: "ventas@techimport.com.py", paymentTerms: "30 días" },
    { name: "Nova Distribuidora", businessName: "Nova Distribuidora Ltda.", document: "18452796000134", documentType: "CNPJ", email: "comercial@novadist.com.br", country: "BR", paymentTerms: "Net 45" },
  ]);

  await semearFaturas(tenantId, "12557896", [
    { dias: 28, skus: [["NB-001", 1], ["MOU-004", 1]] },
    { dias: 25, skus: [["CAB-006", 6], ["TEC-003", 2]] },
    { dias: 21, skus: [["MON-002", 3]] },
    { dias: 18, skus: [["IMP-005", 1], ["CAB-006", 2]] },
    { dias: 15, skus: [["SSD-007", 4], ["SRV-001", 2]] },
    { dias: 11, skus: [["NB-001", 2], ["MON-002", 2]] },
    { dias: 8, skus: [["FON-008", 5]] },
    { dias: 5, skus: [["TEC-003", 4], ["MOU-004", 6]] },
    { dias: 3, skus: [["NB-001", 1], ["SSD-007", 1], ["SRV-001", 3]] },
    { dias: 1, skus: [["MON-002", 1], ["CAB-006", 4]] },
  ]);

  await semearPedidos(tenantId);
  await semearContabilidade(tenantId);
}

/** Pedidos: a fase anterior à fatura, exclusiva do módulo store. */
async function semearPedidos(tenantId: string): Promise<void> {
  const jaTem = await prisma.order.count({ where: { tenantId } });
  if (jaTem > 0) return;

  const produtos = await prisma.product.findMany({
    where: { tenantId },
    select: { id: true, sku: true, price: true },
  });
  const porSku = new Map(produtos.map((p) => [p.sku, p]));

  const clientes = await prisma.customer.findMany({
    where: { tenantId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const fornecedores = await prisma.supplier.findMany({
    where: { tenantId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (clientes.length === 0) return;

  const venda = [
    { sku: "NB-001", qtd: 3 },
    { sku: "MON-002", qtd: 3 },
  ]
    .map((l) => ({ ...l, p: porSku.get(l.sku) }))
    .filter((l) => l.p);

  if (venda.length > 0) {
    const total = venda.reduce((s, l) => s.plus(dec(l.p!.price).times(l.qtd)), dec(0));
    await prisma.order.create({
      data: {
        tenantId,
        type: "SALES",
        status: "CONFIRMED",
        orderNumber: "PV-000001",
        customerId: clientes[1]?.id ?? clientes[0].id,
        expectedAt: new Date(Date.now() + 5 * DIA),
        totalAmount: total,
        notes: "Entrega no depósito do cliente.",
        items: {
          create: venda.map((l) => ({
            productId: l.p!.id,
            quantity: dec(l.qtd),
            unitPrice: dec(l.p!.price),
          })),
        },
      },
    });
  }

  const compraSku = porSku.get("SSD-007");
  if (compraSku && fornecedores.length > 0) {
    await prisma.order.create({
      data: {
        tenantId,
        type: "PURCHASE",
        status: "DRAFT",
        orderNumber: "PC-000001",
        supplierId: fornecedores[0].id,
        expectedAt: new Date(Date.now() + 12 * DIA),
        totalAmount: dec(compraSku.price).times(20),
        notes: "Reposição de estoque — trimestre.",
        items: {
          create: [{ productId: compraSku.id, quantity: dec(20), unitPrice: dec(compraSku.price) }],
        },
      },
    });
  }
}

// ─── Vertical: farm ─────────────────────────────────────────

async function semearFarm(tenantId: string): Promise<void> {
  await garantirTimbrado(tenantId, "12604417");

  await semearProdutos(tenantId, [
    { sku: "SEM-SOJA", name: "Semente de soja BRS 388 (saco 40 kg)", price: 480_000, cost: 395_000, currentStock: 320, minStock: 60, unit: "saco" },
    { sku: "FERT-NPK", name: "Fertilizante NPK 04-30-10", price: 5_200_000, cost: 4_350_000, currentStock: 45, minStock: 10, unit: "ton" },
    { sku: "HERB-GLI", name: "Herbicida glifosato 480 SL", price: 42_000, cost: 31_000, currentStock: 1_800, minStock: 400, unit: "L" },
    { sku: "FUNG-AZO", name: "Fungicida azoxistrobina + ciproconazol", price: 185_000, cost: 142_000, currentStock: 260, minStock: 80, unit: "L" },
    { sku: "DIESEL", name: "Diesel S-10", price: 8_900, cost: 8_100, currentStock: 12_000, minStock: 4_000, unit: "L" },
    { sku: "SAL-MIN", name: "Sal mineral bovino (saco 30 kg)", price: 165_000, cost: 128_000, currentStock: 38, minStock: 50, unit: "saco" },
  ]);

  await semearClientes(tenantId, [
    { name: "Cargill Agropecuaria S.A.C.I.", document: ruc("80005681"), documentType: "RUC", email: "originacion@cargill.com.py", city: "Asunción", category: "wholesale" },
    { name: "ADM Paraguay S.A.E.C.A.", document: ruc("80012842"), documentType: "RUC", email: "granos@adm.com.py", city: "Encarnación", category: "wholesale" },
    { name: "Cooperativa Colonias Unidas", document: ruc("80006114"), documentType: "RUC", email: "acopio@colonias.coop.py", city: "Obligado", category: "wholesale" },
    { name: "Frigorífico Guaraní S.A.", document: ruc("80023519"), documentType: "RUC", email: "compras@frigoguarani.com.py", city: "Villeta", category: "wholesale" },
  ]);

  await semearFornecedores(tenantId, [
    { name: "Agro Insumos del Sur", businessName: "Agro Insumos del Sur S.A.", document: ruc("80019473"), documentType: "RUC", email: "ventas@agroinsumos.com.py", paymentTerms: "60 días" },
    { name: "Tractores y Máquinas", businessName: "Tractores y Máquinas S.R.L.", document: ruc("80027358"), documentType: "RUC", email: "posventa@tracmaq.com.py", paymentTerms: "30 días" },
  ]);

  await semearFaturas(tenantId, "12604417", [
    { dias: 27, skus: [["SEM-SOJA", 40]] },
    { dias: 22, skus: [["FERT-NPK", 6]] },
    { dias: 17, skus: [["HERB-GLI", 400]] },
    { dias: 13, skus: [["FUNG-AZO", 120]] },
    { dias: 9, skus: [["SAL-MIN", 25]] },
    { dias: 4, skus: [["SEM-SOJA", 60], ["FERT-NPK", 3]] },
  ]);

  await semearContabilidade(tenantId);
  await semearAgro(tenantId);
}

async function semearAgro(tenantId: string): Promise<void> {
  if ((await prisma.harvest.count({ where: { tenantId } })) > 0) return;

  const ano = new Date().getFullYear();

  const anterior = await prisma.harvest.create({
    data: {
      tenantId,
      name: `Safra ${ano - 1}/${String(ano).slice(2)}`,
      cropType: "soja",
      startDate: new Date(ano - 1, 8, 15),
      endDate: new Date(ano, 2, 30),
      status: "COMPLETED",
    },
    select: { id: true },
  });

  const atual = await prisma.harvest.create({
    data: {
      tenantId,
      name: `Safra ${ano}/${String(ano + 1).slice(2)}`,
      cropType: "soja",
      startDate: new Date(ano, 7, 1),
      endDate: new Date(ano + 1, 2, 30),
      status: "ACTIVE",
    },
    select: { id: true },
  });

  // ── Funcionários ──
  const funcionarios = await Promise.all(
    [
      { name: "Ramón Duarte", role: "tratorista", phone: "0985 331 204" },
      { name: "Laura Espínola", role: "agrônoma", phone: "0981 774 620" },
      { name: "Julio Cáceres", role: "operador de colheitadeira", phone: "0972 118 445" },
      { name: "Marta Giménez", role: "auxiliar administrativo", phone: "0983 550 917" },
      { name: "Aníbal Ortiz", role: "capataz", phone: "0976 402 338", status: "LEAVE" },
    ].map((f) => prisma.employee.create({ data: { tenantId, ...f }, select: { id: true, role: true } }))
  );
  const tratorista = funcionarios[0].id;
  const agronoma = funcionarios[1].id;

  // ── Talhões ──
  const talhoes = await Promise.all(
    [
      { name: "Talhão São João", area: 320, currentCrop: "soja", status: "PLANTED", harvestId: atual.id },
      { name: "Talhão Yvyrá", area: 410, currentCrop: "soja", status: "PLANTED", harvestId: atual.id },
      { name: "Talhão Aguará", area: 185.5, currentCrop: "milho", status: "PLANTED", harvestId: atual.id },
      { name: "Talhão Corriente", area: 240, currentCrop: null, status: "PREPARING", harvestId: atual.id },
      { name: "Talhão Palmar", area: 96.4, currentCrop: null, status: "FALLOW", harvestId: null },
    ].map((t) =>
      prisma.plot.create({
        data: { tenantId, name: t.name, area: dec(t.area), unit: "HECTARE", currentCrop: t.currentCrop, status: t.status, harvestId: t.harvestId },
        select: { id: true, name: true },
      })
    )
  );

  // ── Análises de solo ──
  await prisma.soilAnalysis.createMany({
    data: [
      { tenantId, plotId: talhoes[0].id, date: haDias(48), ph: dec(5.8), phosphorus: dec(14.2), potassium: dec(0.32), organicMatter: dec(2.9), recommendation: "Calagem de 1,5 t/ha antes da semeadura." },
      { tenantId, plotId: talhoes[1].id, date: haDias(45), ph: dec(6.2), phosphorus: dec(21.5), potassium: dec(0.48), organicMatter: dec(3.4), recommendation: "Fertilidade adequada. Manter adubação de manutenção." },
      { tenantId, plotId: talhoes[2].id, date: haDias(30), ph: dec(5.4), phosphorus: dec(9.8), potassium: dec(0.21), organicMatter: dec(2.1), recommendation: "Corrigir acidez e reforçar potássio." },
    ],
  });

  // ── Aplicações de insumos ──
  const produtos = await prisma.product.findMany({
    where: { tenantId },
    select: { id: true, sku: true, cost: true },
  });
  const porSku = new Map(produtos.map((p) => [p.sku, p]));

  const aplicacoes = [
    { plot: 0, sku: "HERB-GLI", quantity: 640, dias: 24, employeeId: tratorista, notes: "Dessecação pré-semeadura." },
    { plot: 1, sku: "SEM-SOJA", quantity: 205, dias: 18, employeeId: tratorista, notes: "Semeadura — 50 kg/ha." },
    { plot: 0, sku: "FERT-NPK", quantity: 9.6, dias: 17, employeeId: agronoma, notes: "Adubação de base." },
    { plot: 2, sku: "FUNG-AZO", quantity: 92.75, dias: 7, employeeId: agronoma, notes: "Controlo preventivo de ferrugem." },
  ];

  for (const a of aplicacoes) {
    const p = porSku.get(a.sku);
    if (!p) continue;
    await prisma.plotApplication.create({
      data: {
        tenantId,
        plotId: talhoes[a.plot].id,
        harvestId: atual.id,
        productId: p.id,
        quantity: dec(a.quantity),
        totalCost: dec(p.cost).times(a.quantity),
        date: haDias(a.dias),
        employeeId: a.employeeId,
        notes: a.notes,
      },
    });
  }

  // ── Irrigação ──
  await prisma.irrigationEvent.createMany({
    data: [
      { tenantId, plotId: talhoes[0].id, date: haDias(14), method: "pivô central", durationHours: dec(8), flowRate: dec(120), volumeApplied: dec(18.5), employeeId: tratorista },
      { tenantId, plotId: talhoes[2].id, date: haDias(6), method: "pivô central", durationHours: dec(6.5), flowRate: dec(110), volumeApplied: dec(14.2), employeeId: tratorista },
    ],
  });

  // ── Silos ──
  const silos = await Promise.all(
    [
      { name: "Silo 1 — Sede", capacity: 2_500, currentStock: 1_420 },
      { name: "Silo 2 — Aguará", capacity: 1_800, currentStock: 640 },
      { name: "Silo 3 — Palmar", capacity: 1_200, currentStock: 0 },
    ].map((s) =>
      prisma.silo.create({
        data: { tenantId, name: s.name, capacity: dec(s.capacity), unit: "TON", currentStock: dec(s.currentStock) },
        select: { id: true, name: true },
      })
    )
  );

  // ── Contratos de venda de grão ──
  const contratos = await Promise.all(
    [
      { contractNumber: "CT-2026-014", siloName: silos[0].name, grainType: "soja", quantity: 1_200, pricePerUnit: 385, deliveryDias: -60, status: "ACTIVE" },
      { contractNumber: "CT-2026-009", siloName: silos[1].name, grainType: "milho", quantity: 800, pricePerUnit: 210, deliveryDias: -25, status: "ACTIVE" },
      { contractNumber: "CT-2025-031", siloName: silos[0].name, grainType: "soja", quantity: 950, pricePerUnit: 372, deliveryDias: 90, status: "COMPLETED" },
    ].map((c) =>
      prisma.contract.create({
        data: {
          tenantId,
          contractNumber: c.contractNumber,
          harvestId: c.status === "COMPLETED" ? anterior.id : atual.id,
          siloName: c.siloName,
          grainType: c.grainType,
          quantity: dec(c.quantity),
          unit: "TON",
          pricePerUnit: dec(c.pricePerUnit),
          currency: "USD",
          status: c.status,
          deliveryDate: haDias(c.deliveryDias),
        },
        select: { id: true },
      })
    )
  );

  // ── Movimentos de silo ──
  await prisma.siloMovement.createMany({
    data: [
      { tenantId, siloId: silos[0].id, type: "IN", quantity: dec(880), date: haDias(40), harvestId: anterior.id, moisture: dec(13.4), qualityGrade: "Tipo 1" },
      { tenantId, siloId: silos[0].id, type: "IN", quantity: dec(1_050), date: haDias(33), harvestId: anterior.id, moisture: dec(14.1), qualityGrade: "Tipo 1" },
      { tenantId, siloId: silos[0].id, type: "OUT", quantity: dec(510), date: haDias(19), contractId: contratos[0].id, notes: "Entrega parcial CT-2026-014." },
      { tenantId, siloId: silos[1].id, type: "IN", quantity: dec(760), date: haDias(29), harvestId: anterior.id, moisture: dec(13.9), qualityGrade: "Tipo 2" },
      { tenantId, siloId: silos[1].id, type: "OUT", quantity: dec(120), date: haDias(10), contractId: contratos[1].id },
    ],
  });

  // ── Rebanho ──
  const lotes = await Promise.all(
    [
      { name: "Lote Novilhos 2025", category: "novilho", quantity: 186, averageWeight: 322.5, location: "Piquete 4" },
      { name: "Lote Vacas de Cria", category: "vaca", quantity: 94, averageWeight: 431, location: "Piquete 1" },
      { name: "Lote Bezerros Desmama", category: "bezerro", quantity: 72, averageWeight: 168.4, location: "Piquete 7" },
    ].map((l) =>
      prisma.livestockBatch.create({
        data: { tenantId, name: l.name, category: l.category, quantity: l.quantity, averageWeight: dec(l.averageWeight), location: l.location },
        select: { id: true },
      })
    )
  );

  await prisma.livestockEvent.createMany({
    data: [
      { tenantId, batchId: lotes[0].id, type: "WEIGHING", date: haDias(35), weight: dec(298.2), employeeId: funcionarios[4].id },
      { tenantId, batchId: lotes[0].id, type: "WEIGHING", date: haDias(5), weight: dec(322.5), employeeId: funcionarios[4].id, notes: "Ganho médio de 0,81 kg/dia." },
      { tenantId, batchId: lotes[0].id, type: "MOVEMENT", date: haDias(21), location: "Piquete 4", notes: "Rotação de pasto." },
      { tenantId, batchId: lotes[1].id, type: "HEALTH", date: haDias(16), description: "Vacinação contra febre aftosa.", employeeId: agronoma },
      { tenantId, batchId: lotes[2].id, type: "HEALTH", date: haDias(9), description: "Vermifugação e suplementação mineral." },
    ],
  });

  // ── Frota ──
  const veiculos = await Promise.all(
    [
      { name: "Trator John Deere 6110J", type: "trator", plate: null, status: "OPERATIONAL", currentReading: 4_820 },
      { name: "Colheitadeira New Holland CR5.85", type: "colheitadeira", plate: null, status: "MAINTENANCE", currentReading: 2_145 },
      { name: "Pulverizador Jacto Uniport 3030", type: "pulverizador", plate: null, status: "OPERATIONAL", currentReading: 1_390 },
      { name: "Caminhão Volvo VM 270", type: "caminhao", plate: "AABB 123", status: "OPERATIONAL", currentReading: 182_400 },
    ].map((v) =>
      prisma.vehicle.create({
        data: { tenantId, name: v.name, type: v.type, plate: v.plate, status: v.status, currentReading: dec(v.currentReading) },
        select: { id: true },
      })
    )
  );

  await prisma.vehicleLog.createMany({
    data: [
      { tenantId, vehicleId: veiculos[0].id, type: "FUEL", date: haDias(20), odometerOrHours: dec(4_762), liters: dec(180), fuelCost: dec(1_602_000), employeeId: tratorista },
      { tenantId, vehicleId: veiculos[0].id, type: "MAINTENANCE", date: haDias(11), odometerOrHours: dec(4_800), description: "Troca de óleo e filtros — 4.800 h.", maintenanceCost: dec(2_450_000) },
      { tenantId, vehicleId: veiculos[1].id, type: "MAINTENANCE", date: haDias(3), odometerOrHours: dec(2_145), description: "Substituição de correia do rotor.", maintenanceCost: dec(6_800_000) },
      { tenantId, vehicleId: veiculos[3].id, type: "FUEL", date: haDias(6), odometerOrHours: dec(182_120), liters: dec(320), fuelCost: dec(2_848_000), employeeId: funcionarios[2].id },
    ],
  });

  // ── Certificações ──
  await prisma.certification.createMany({
    data: [
      {
        tenantId,
        name: "GLOBALG.A.P. — Crops",
        issuingBody: "FoodPLUS GmbH",
        certificateNumber: "GGN-4059883174562",
        issueDate: haDias(170),
        expiryDate: haDias(-195),
        status: "ACTIVE",
        scope: "Talhões São João e Yvyrá — Soja",
      },
      {
        // Expira dentro de mês e meio: é o caso que justifica a página existir.
        tenantId,
        name: "Certificação Orgânica IBD",
        issuingBody: "IBD Certificações",
        certificateNumber: "IBD-2025-08841",
        issueDate: haDias(320),
        expiryDate: haDias(-45),
        status: "ACTIVE",
        scope: "Talhão Palmar — pousio orgânico",
      },
      {
        tenantId,
        name: "Rainforest Alliance",
        issuingBody: "Rainforest Alliance",
        certificateNumber: "RA-PY-11207",
        issueDate: haDias(600),
        expiryDate: haDias(120),
        status: "EXPIRED",
        scope: "Unidade produtiva — auditoria de 2024",
      },
    ],
  });
}

// ─── Vertical: clinic ───────────────────────────────────────

async function semearClinic(tenantId: string): Promise<void> {
  await garantirTimbrado(tenantId, "12588203");

  await semearProdutos(tenantId, [
    { sku: "CON-GERAL", name: "Consulta clínica geral", price: 250_000, cost: 0, currentStock: 0, minStock: 0, unit: "consulta", isService: true },
    { sku: "CON-CARDIO", name: "Consulta cardiológica", price: 380_000, cost: 0, currentStock: 0, minStock: 0, unit: "consulta", isService: true },
    { sku: "CON-DERMA", name: "Consulta dermatológica", price: 350_000, cost: 0, currentStock: 0, minStock: 0, unit: "consulta", isService: true },
    { sku: "EXA-ECG", name: "Eletrocardiograma", price: 190_000, cost: 45_000, currentStock: 0, minStock: 0, unit: "exame", isService: true },
    { sku: "MAT-LUV", name: "Luvas de procedimento (caixa 100)", price: 78_000, cost: 52_000, currentStock: 60, minStock: 15, unit: "caixa" },
    { sku: "MAT-SER", name: "Seringa descartável 5 ml", price: 2_500, cost: 1_400, currentStock: 800, minStock: 200, unit: "un" },
    { sku: "MAT-VAC", name: "Vacina antigripal tetravalente", price: 145_000, cost: 98_000, currentStock: 24, minStock: 30, unit: "dose" },
  ]);

  // Numa clínica o cliente é o paciente: mesma tabela, com data de nascimento
  // e notas clínicas preenchidas (ver labelOverrides no manifesto do módulo).
  await semearClientes(tenantId, [
    { name: "Rosa Elena Cabrera", document: "1994228", documentType: "CI", phone: "0981 220 774", city: "Asunción", birthDate: new Date(1968, 3, 12), healthNotes: "Hipertensa. Losartana 50 mg/dia." },
    { name: "Diego Armando Ruiz", document: "4028117", documentType: "CI", phone: "0972 884 011", city: "Fernando de la Mora", birthDate: new Date(1991, 10, 3), healthNotes: "Sem alergias conhecidas." },
    { name: "Sofía Britez", document: "5511903", documentType: "CI", phone: "0983 117 226", city: "Luque", birthDate: new Date(2001, 6, 27), healthNotes: "Alergia a penicilina." },
    { name: "Juan Carlos Ovelar", document: "1442785", documentType: "CI", phone: "0985 640 338", city: "Asunción", birthDate: new Date(1957, 0, 19), healthNotes: "Diabético tipo 2. Controlo trimestral." },
    { name: "Liz Paola Franco", document: "4783250", documentType: "CI", phone: "0971 553 902", city: "San Lorenzo", birthDate: new Date(1995, 8, 8) },
    { name: "Ana Lucía Meza", document: "6102448", documentType: "CI", phone: "0976 210 887", city: "Asunción", birthDate: new Date(2015, 1, 22), healthNotes: "Acompanhamento pediátrico. Mãe: Liz Franco." },
    { name: "Hugo Ramírez", document: "2874119", documentType: "CI", phone: "0982 447 105", city: "Capiatá", birthDate: new Date(1979, 4, 30) },
    { name: "Marta Elizabeth Sosa", document: "3320876", documentType: "CI", phone: "0984 902 611", city: "Ñemby", birthDate: new Date(1973, 11, 5), healthNotes: "Dermatite atópica em tratamento." },
  ]);

  await semearFornecedores(tenantId, [
    { name: "Distribuidora Médica del Paraguay", businessName: "Distribuidora Médica del Paraguay S.A.", document: ruc("80021640"), documentType: "RUC", email: "ventas@dimepa.com.py", paymentTerms: "30 días" },
    { name: "Laboratorios Catedral", businessName: "Laboratorios Catedral S.A.", document: ruc("80003392"), documentType: "RUC", email: "institucional@catedral.com.py", paymentTerms: "45 días" },
  ]);

  await semearFaturas(tenantId, "12588203", [
    { dias: 26, skus: [["CON-GERAL", 1]] },
    { dias: 23, skus: [["CON-CARDIO", 1], ["EXA-ECG", 1]] },
    { dias: 19, skus: [["CON-DERMA", 1]] },
    { dias: 16, skus: [["CON-GERAL", 2]] },
    { dias: 12, skus: [["CON-CARDIO", 1]] },
    { dias: 9, skus: [["CON-GERAL", 1], ["MAT-VAC", 1]] },
    { dias: 6, skus: [["CON-DERMA", 2]] },
    { dias: 2, skus: [["CON-GERAL", 3], ["EXA-ECG", 2]] },
  ]);

  await semearContabilidade(tenantId);
  await semearAgenda(tenantId);
}

async function semearAgenda(tenantId: string): Promise<void> {
  if ((await prisma.appointment.count({ where: { tenantId } })) > 0) return;

  // Manhã e tarde, de segunda a sexta. A grelha da agenda vai das 07h às 20h.
  const horario = {
    mon: [["08:00", "12:00"], ["14:00", "18:00"]],
    tue: [["08:00", "12:00"], ["14:00", "18:00"]],
    wed: [["08:00", "12:00"], ["14:00", "18:00"]],
    thu: [["08:00", "12:00"], ["14:00", "18:00"]],
    fri: [["08:00", "12:00"]],
  };

  const profissionais = await Promise.all(
    [
      { name: "Dra. Andrea Villalba", specialty: "Clínica geral", color: "#3e5c50" },
      { name: "Dr. Rodrigo Meza", specialty: "Cardiologia", color: "#2f6690" },
      { name: "Dra. Lucía Franco", specialty: "Dermatologia", color: "#8c5b3e" },
    ].map((p) =>
      prisma.professional.create({
        data: { tenantId, name: p.name, specialty: p.specialty, color: p.color, workingHours: horario },
        select: { id: true },
      })
    )
  );

  const servicos = await Promise.all(
    [
      { name: "Consulta clínica geral", durationMin: 30, price: 250_000 },
      { name: "Consulta cardiológica", durationMin: 40, price: 380_000 },
      { name: "Eletrocardiograma", durationMin: 20, price: 190_000 },
      { name: "Consulta dermatológica", durationMin: 30, price: 350_000 },
      { name: "Retorno / revisão", durationMin: 20, price: 120_000 },
      { name: "Aplicação de vacina", durationMin: 15, price: 95_000 },
    ].map((s) =>
      prisma.service.create({
        data: { tenantId, name: s.name, durationMin: s.durationMin, price: dec(s.price) },
        select: { id: true, durationMin: true, price: true },
      })
    )
  );

  const pacientes = await prisma.customer.findMany({
    where: { tenantId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (pacientes.length === 0) return;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  /** [dia da semana (0=seg), hora, minuto, profissional, serviço, paciente] */
  const marcacoes: Array<[number, number, number, number, number, number]> = [
    [0, 8, 0, 0, 0, 0],
    [0, 9, 0, 0, 4, 1],
    [0, 10, 30, 1, 1, 3],
    [0, 14, 0, 2, 3, 7],
    [0, 15, 30, 0, 0, 4],
    [1, 8, 30, 0, 0, 2],
    [1, 9, 30, 1, 2, 3],
    [1, 11, 0, 2, 3, 5],
    [1, 14, 30, 0, 5, 6],
    [2, 8, 0, 1, 1, 0],
    [2, 10, 0, 0, 0, 5],
    [2, 15, 0, 2, 3, 7],
    [3, 9, 0, 0, 0, 6],
    [3, 10, 30, 1, 2, 3],
    [3, 14, 0, 0, 4, 1],
    [3, 16, 0, 2, 3, 2],
    [4, 8, 30, 0, 0, 4],
    [4, 10, 0, 1, 1, 0],
    [4, 11, 0, 0, 5, 5],
  ];

  for (const [dia, hora, minuto, prof, serv, pac] of marcacoes) {
    const servico = servicos[serv];
    const inicio = diaDaSemana(dia, hora, minuto);
    const fim = new Date(inicio.getTime() + servico.durationMin * 60_000);

    // Estado coerente com o relógio: o que já passou está concluído, o de hoje
    // confirmado, o que vem a seguir apenas agendado. Uma agenda toda
    // "AGENDADA" no passado é a primeira coisa que salta à vista.
    let status: "CONCLUIDA" | "CONFIRMADA" | "AGENDADA" | "FALTOU" = "AGENDADA";
    const inicioDia = new Date(inicio);
    inicioDia.setHours(0, 0, 0, 0);

    if (inicioDia < hoje) status = pac === 7 && dia === 0 ? "FALTOU" : "CONCLUIDA";
    else if (inicioDia.getTime() === hoje.getTime()) status = inicio < new Date() ? "CONCLUIDA" : "CONFIRMADA";

    await prisma.appointment.create({
      data: {
        tenantId,
        patientId: pacientes[pac % pacientes.length].id,
        professionalId: profissionais[prof].id,
        serviceId: servico.id,
        startsAt: inicio,
        endsAt: fim,
        status,
        clinicalNotes: status === "CONCLUIDA" ? "Paciente estável. Retorno em 30 dias." : null,
        chargedAmount: status === "CONCLUIDA" ? servico.price : null,
      },
    });
  }
}

// ─── Execução ───────────────────────────────────────────────

async function main() {
  console.log("Contas de demonstração — store, farm e clinic\n");

  for (const d of DEMOS) {
    console.log(`${d.vertical}:`);
    const tenantId = await garantirTenant(d);
    await definirSenha(d.email);
    await garantirCambio(tenantId);

    if (d.vertical === "store") await semearStore(tenantId);
    if (d.vertical === "farm") await semearFarm(tenantId);
    if (d.vertical === "clinic") await semearClinic(tenantId);

    console.log(`  dados de demonstração prontos\n`);
  }

  const linha = "─".repeat(70);
  console.log(linha);
  console.log("CREDENCIAIS DE APRESENTAÇÃO");
  console.log(linha);
  for (const d of DEMOS) {
    console.log(`${d.vertical.padEnd(7)} ${d.email.padEnd(24)} ${SENHA}`);
  }
  console.log(linha);
  console.log("Papel: SOVEREIGN (acesso total) em cada cliente.");
  console.log("Contas de demonstração: não colocar dados reais nelas.");
  console.log(linha);
}

main()
  .catch((e) => {
    console.error("Falhou:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
