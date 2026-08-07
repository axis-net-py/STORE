import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import {
  consultaPorNome,
  normalizarDias,
  normalizarDirecao,
  normalizarTipo,
  desdeDias,
  ateDias,
  LIMITE_LINHAS,
  type Resultado,
} from "@/lib/consultas";

/**
 * Execução das consultas do assistente.
 *
 * Uma função por consulta do catálogo, cada uma com o `tenantId` fixado no
 * `where`. É por isto que o modelo não escreve consultas: o filtro por cliente
 * está no código, não numa frase que ele possa ser convencido a mudar.
 *
 * Todas as contas — somas, saldos, médias — são feitas aqui. O modelo recebe
 * números já apurados e limita-se a escrevê-los numa frase. Um modelo que soma
 * é um modelo que um dia soma mal, e ninguém confere um total que veio dentro
 * de uma conversa.
 */

const dec = (v: unknown) => Number(v ?? 0);

/** Saldo em aberto de uma fatura: o que falta receber ou pagar dela. */
function emAberto(inv: { totalAmount: unknown; payments: { amount: unknown }[] }): number {
  return dec(inv.totalAmount) - inv.payments.reduce((s, p) => s + dec(p.amount), 0);
}

const dia = (d: Date | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : null;

export async function executarConsulta(
  nome: string,
  params: Record<string, unknown>,
  tenantId: string
): Promise<Resultado> {
  const consulta = consultaPorNome(nome);
  // Nome fora do catálogo não é um erro do utilizador — é o modelo a inventar.
  // Falha em vez de tentar adivinhar o que ele queria dizer.
  if (!consulta) throw new Error(`Consulta desconhecida: ${nome}`);

  // A permissão é da consulta, não do chat. Perguntar não abre portas que o
  // ecrã correspondente mantém fechadas.
  await requirePermission(consulta.permissao);

  const agora = new Date();

  switch (nome) {
    case "cliente":
      return await fichaEntidade(tenantId, String(params.nome ?? ""), "SALES", agora);

    case "fornecedor":
      return await fichaEntidade(tenantId, String(params.nome ?? ""), "PURCHASE", agora);

    case "produto":
      return await fichaProduto(tenantId, String(params.nome ?? ""), normalizarDias(params.dias, 30), agora);

    case "vencimentos":
      return await vencimentos(tenantId, normalizarDias(params.dias, 7), normalizarDirecao(params.direcao), agora);

    case "vencidas":
      return await vencidas(tenantId, normalizarDirecao(params.direcao), agora);

    case "faturas":
      return await faturas(
        tenantId,
        normalizarTipo(params.tipo),
        params.entidade ? String(params.entidade) : null,
        normalizarDias(params.dias, 90),
        agora
      );

    case "ranking_clientes":
      return await rankingClientes(tenantId, normalizarDias(params.dias, 30), agora);

    case "ranking_produtos":
      return await rankingProdutos(tenantId, normalizarDias(params.dias, 30), agora);

    case "resumo":
      return await resumo(tenantId, normalizarDias(params.dias, 30), agora);

    case "estoque_baixo":
      return await estoqueBaixo(tenantId);

    case "procurar":
      return await procurar(tenantId, String(params.termo ?? ""));

    default:
      throw new Error(`Consulta sem execução: ${nome}`);
  }
}

// ─── Fichas ─────────────────────────────────────────────────────────────────

async function fichaEntidade(
  tenantId: string,
  nome: string,
  tipo: "SALES" | "PURCHASE",
  agora: Date
): Promise<Resultado> {
  const cliente = tipo === "SALES";
  const rotulo = cliente ? "cliente" : "fornecedor";

  const entidade = cliente
    ? await prisma.customer.findFirst({
        where: { tenantId, name: { contains: nome, mode: "insensitive" } },
        select: { id: true, name: true, document: true, phone: true, email: true, city: true },
      })
    : await prisma.supplier.findFirst({
        where: { tenantId, name: { contains: nome, mode: "insensitive" } },
        select: { id: true, name: true, document: true, phone: true, email: true, city: true },
      });

  if (!entidade) {
    return {
      consulta: rotulo,
      titulo: `Nenhum ${rotulo} encontrado com "${nome}"`,
      linhas: [],
    };
  }

  const invoices = await prisma.commercialInvoice.findMany({
    where: {
      tenantId,
      type: tipo,
      status: "APPROVED",
      ...(cliente ? { customerId: entidade.id } : { supplierId: entidade.id }),
    },
    orderBy: { issuedAt: "desc" },
    select: {
      documentNumber: true,
      issuedAt: true,
      dueDate: true,
      totalAmount: true,
      payments: { select: { amount: true } },
    },
  });

  const total = invoices.reduce((s, i) => s + dec(i.totalAmount), 0);
  const aberto = invoices.reduce((s, i) => s + Math.max(0, emAberto(i)), 0);
  const ultima = invoices[0];

  const doDoze = desdeDias(365, agora);
  const totalAno = invoices
    .filter((i) => i.issuedAt >= doDoze)
    .reduce((s, i) => s + dec(i.totalAmount), 0);

  return {
    consulta: rotulo,
    titulo: `Ficha de ${entidade.name}`,
    linhas: [
      {
        nome: entidade.name,
        documento: entidade.document ?? "—",
        telefone: entidade.phone ?? "—",
        email: entidade.email ?? "—",
        cidade: entidade.city ?? "—",
        [cliente ? "ultima_compra" : "ultima_compra_a_ele"]: dia(ultima?.issuedAt) ?? "nunca",
        valor_da_ultima: ultima ? dec(ultima.totalAmount) : 0,
        documento_da_ultima: ultima?.documentNumber ?? "—",
      },
    ],
    totais: {
      "Faturas": invoices.length,
      "Total histórico": total,
      "Últimos 12 meses": totalAno,
      [cliente ? "Em aberto (a receber)" : "Em aberto (a pagar)"]: aberto,
    },
  };
}

async function fichaProduto(
  tenantId: string,
  nome: string,
  dias: number,
  agora: Date
): Promise<Resultado> {
  const produto = await prisma.product.findFirst({
    where: {
      tenantId,
      OR: [
        { name: { contains: nome, mode: "insensitive" } },
        { sku: { contains: nome, mode: "insensitive" } },
      ],
    },
    select: {
      id: true, name: true, sku: true, unit: true,
      price: true, cost: true, currentStock: true, minStock: true,
    },
  });

  if (!produto) {
    return { consulta: "produto", titulo: `Nenhum produto encontrado com "${nome}"`, linhas: [] };
  }

  const desde = desdeDias(dias, agora);

  const [saidas, ultimaCompra, ultimaVenda] = await Promise.all([
    prisma.invoiceItem.findMany({
      where: {
        productId: produto.id,
        commercialInvoice: { tenantId, type: "SALES", status: "APPROVED", issuedAt: { gte: desde } },
      },
      select: { quantity: true, totalPrice: true },
    }),
    prisma.invoiceItem.findFirst({
      where: { productId: produto.id, commercialInvoice: { tenantId, type: "PURCHASE" } },
      orderBy: { commercialInvoice: { issuedAt: "desc" } },
      select: { unitPrice: true, commercialInvoice: { select: { issuedAt: true, supplier: { select: { name: true } } } } },
    }),
    prisma.invoiceItem.findFirst({
      where: { productId: produto.id, commercialInvoice: { tenantId, type: "SALES" } },
      orderBy: { commercialInvoice: { issuedAt: "desc" } },
      select: { unitPrice: true, commercialInvoice: { select: { issuedAt: true } } },
    }),
  ]);

  return {
    consulta: "produto",
    titulo: `Ficha de ${produto.name} (${produto.sku})`,
    linhas: [
      {
        produto: produto.name,
        sku: produto.sku,
        estoque: `${dec(produto.currentStock)} ${produto.unit}`,
        minimo: dec(produto.minStock),
        preco_venda: dec(produto.price),
        custo: dec(produto.cost),
        ultima_compra: dia(ultimaCompra?.commercialInvoice.issuedAt) ?? "nunca",
        ultimo_fornecedor: ultimaCompra?.commercialInvoice.supplier?.name ?? "—",
        preco_da_ultima_compra: ultimaCompra ? dec(ultimaCompra.unitPrice) : 0,
        ultima_venda: dia(ultimaVenda?.commercialInvoice.issuedAt) ?? "nunca",
      },
    ],
    totais: {
      [`Unidades vendidas em ${dias} dias`]: saidas.reduce((s, i) => s + dec(i.quantity), 0),
      [`Faturado em ${dias} dias`]: saidas.reduce((s, i) => s + dec(i.totalPrice), 0),
    },
  };
}

// ─── Contas ─────────────────────────────────────────────────────────────────

/**
 * Faturas com saldo por liquidar.
 *
 * O saldo não está guardado em lado nenhum: é o total menos os pagamentos, e
 * calcula-se aqui a cada pergunta. Guardá-lo seria mais rápido e mais fácil de
 * ficar errado — bastava um pagamento apagado à mão para o número mentir para
 * sempre.
 */
async function porLiquidar(
  tenantId: string,
  direcao: "RECEIVABLE" | "PAYABLE",
  where: Record<string, unknown>
) {
  const invoices = await prisma.commercialInvoice.findMany({
    where: {
      tenantId,
      type: direcao === "RECEIVABLE" ? "SALES" : "PURCHASE",
      status: "APPROVED",
      ...where,
    },
    orderBy: { dueDate: "asc" },
    select: {
      documentNumber: true,
      issuedAt: true,
      dueDate: true,
      totalAmount: true,
      customer: { select: { name: true } },
      supplier: { select: { name: true } },
      payments: { select: { amount: true } },
    },
  });

  return invoices
    .map((i) => ({
      quem: (direcao === "RECEIVABLE" ? i.customer?.name : i.supplier?.name) ?? "—",
      documento: i.documentNumber ?? "—",
      emitida: dia(i.issuedAt),
      vence: dia(i.dueDate),
      saldo: emAberto(i),
    }))
    // Meio guarani de arredondamento não é uma dívida. Sem esta margem, uma
    // fatura paga ao cêntimo aparecia todos os dias na lista de cobranças.
    .filter((x) => x.saldo > 0.009);
}

async function vencimentos(
  tenantId: string,
  dias: number,
  direcao: "RECEIVABLE" | "PAYABLE",
  agora: Date
): Promise<Resultado> {
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);

  const todas = await porLiquidar(tenantId, direcao, {
    dueDate: { gte: hoje, lte: ateDias(dias, agora) },
  });

  return {
    consulta: "vencimentos",
    titulo: `Faturas ${direcao === "RECEIVABLE" ? "a receber" : "a pagar"} que vencem nos próximos ${dias} dias`,
    linhas: todas.slice(0, LIMITE_LINHAS),
    totais: { "Total a vencer": todas.reduce((s, x) => s + x.saldo, 0), "Faturas": todas.length },
    truncado: todas.length > LIMITE_LINHAS,
  };
}

async function vencidas(
  tenantId: string,
  direcao: "RECEIVABLE" | "PAYABLE",
  agora: Date
): Promise<Resultado> {
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);

  const todas = await porLiquidar(tenantId, direcao, { dueDate: { lt: hoje } });
  const comAtraso = todas.map((x) => ({
    ...x,
    dias_de_atraso: x.vence
      ? Math.floor((hoje.getTime() - new Date(x.vence).getTime()) / 86_400_000)
      : 0,
  }));

  return {
    consulta: "vencidas",
    titulo: `Faturas ${direcao === "RECEIVABLE" ? "a receber" : "a pagar"} já vencidas`,
    linhas: comAtraso.slice(0, LIMITE_LINHAS),
    totais: { "Total vencido": todas.reduce((s, x) => s + x.saldo, 0), "Faturas": todas.length },
    truncado: todas.length > LIMITE_LINHAS,
  };
}

// ─── Movimento ──────────────────────────────────────────────────────────────

/**
 * Quando há um nome, é o nome que decide o lado — não a palavra usada.
 *
 * "A última compra do João" quer dizer o que o João comprou, e do lado da
 * empresa isso é uma VENDA. Já "a última compra à Distribuidora" é uma compra.
 * A mesma palavra, os dois sentidos, e nenhuma regra de gramática resolve isso
 * de forma fiável.
 *
 * A base resolve: se o nome está nos clientes, a pergunta é sobre vendas; se
 * está nos fornecedores, sobre compras. Só quando o nome não existe de nenhum
 * dos lados é que se respeita o palpite de quem interpretou a frase.
 */
async function ladoDaEntidade(
  tenantId: string,
  entidade: string,
  palpite: "SALES" | "PURCHASE"
): Promise<"SALES" | "PURCHASE"> {
  const contem = { contains: entidade, mode: "insensitive" as const };
  const [eCliente, eFornecedor] = await Promise.all([
    prisma.customer.count({ where: { tenantId, name: contem } }),
    prisma.supplier.count({ where: { tenantId, name: contem } }),
  ]);

  // Nos dois lados — acontece com quem compra e vende à mesma empresa — fica o
  // palpite, que é a única informação nova que a frase trazia.
  if (eCliente > 0 && eFornecedor === 0) return "SALES";
  if (eFornecedor > 0 && eCliente === 0) return "PURCHASE";
  return palpite;
}

async function faturas(
  tenantId: string,
  tipoPedido: "SALES" | "PURCHASE",
  entidade: string | null,
  dias: number,
  agora: Date
): Promise<Resultado> {
  const tipo = entidade ? await ladoDaEntidade(tenantId, entidade, tipoPedido) : tipoPedido;

  const invoices = await prisma.commercialInvoice.findMany({
    where: {
      tenantId,
      type: tipo,
      status: "APPROVED",
      issuedAt: { gte: desdeDias(dias, agora) },
      ...(entidade
        ? tipo === "SALES"
          ? { customer: { name: { contains: entidade, mode: "insensitive" } } }
          : { supplier: { name: { contains: entidade, mode: "insensitive" } } }
        : {}),
    },
    orderBy: { issuedAt: "desc" },
    take: LIMITE_LINHAS + 1,
    select: {
      documentNumber: true,
      issuedAt: true,
      dueDate: true,
      totalAmount: true,
      currency: true,
      customer: { select: { name: true } },
      supplier: { select: { name: true } },
      items: { select: { sku: true, quantity: true }, take: 5 },
    },
  });

  const truncado = invoices.length > LIMITE_LINHAS;
  const lista = invoices.slice(0, LIMITE_LINHAS);

  return {
    consulta: "faturas",
    titulo: entidade
      ? `Últimas ${tipo === "SALES" ? "vendas a" : "compras a"} "${entidade}" (${dias} dias)`
      : `Últimas ${tipo === "SALES" ? "vendas" : "compras"} (${dias} dias)`,
    linhas: lista.map((i) => ({
      quem: (tipo === "SALES" ? i.customer?.name : i.supplier?.name) ?? "—",
      documento: i.documentNumber ?? "—",
      data: dia(i.issuedAt),
      vence: dia(i.dueDate),
      total: dec(i.totalAmount),
      moeda: i.currency,
      itens: i.items.map((x) => `${dec(x.quantity)}× ${x.sku}`).join(", "),
    })),
    totais: { "Total do período": lista.reduce((s, i) => s + dec(i.totalAmount), 0) },
    truncado,
  };
}

async function rankingClientes(tenantId: string, dias: number, agora: Date): Promise<Resultado> {
  const invoices = await prisma.commercialInvoice.findMany({
    where: { tenantId, type: "SALES", status: "APPROVED", issuedAt: { gte: desdeDias(dias, agora) } },
    select: { totalAmount: true, customer: { select: { name: true } } },
  });

  const por = new Map<string, { total: number; faturas: number }>();
  for (const i of invoices) {
    const n = i.customer?.name ?? "—";
    const atual = por.get(n) ?? { total: 0, faturas: 0 };
    atual.total += dec(i.totalAmount);
    atual.faturas += 1;
    por.set(n, atual);
  }

  const linhas = [...por.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, LIMITE_LINHAS)
    .map(([cliente, v]) => ({ cliente, total: v.total, faturas: v.faturas }));

  return {
    consulta: "ranking_clientes",
    titulo: `Clientes que mais compraram nos últimos ${dias} dias`,
    linhas,
    totais: { "Total vendido": invoices.reduce((s, i) => s + dec(i.totalAmount), 0) },
  };
}

async function rankingProdutos(tenantId: string, dias: number, agora: Date): Promise<Resultado> {
  const itens = await prisma.invoiceItem.findMany({
    where: {
      commercialInvoice: {
        tenantId, type: "SALES", status: "APPROVED", issuedAt: { gte: desdeDias(dias, agora) },
      },
    },
    select: { quantity: true, totalPrice: true, product: { select: { name: true, unit: true } } },
  });

  const por = new Map<string, { qtd: number; valor: number; unidade: string }>();
  for (const i of itens) {
    const n = i.product?.name ?? "—";
    const atual = por.get(n) ?? { qtd: 0, valor: 0, unidade: i.product?.unit ?? "un" };
    atual.qtd += dec(i.quantity);
    atual.valor += dec(i.totalPrice);
    por.set(n, atual);
  }

  const linhas = [...por.entries()]
    .sort((a, b) => b[1].valor - a[1].valor)
    .slice(0, LIMITE_LINHAS)
    .map(([produto, v]) => ({ produto, quantidade: `${v.qtd} ${v.unidade}`, faturado: v.valor }));

  return {
    consulta: "ranking_produtos",
    titulo: `Produtos mais vendidos nos últimos ${dias} dias`,
    linhas,
    totais: { "Total faturado": itens.reduce((s, i) => s + dec(i.totalPrice), 0) },
  };
}

async function resumo(tenantId: string, dias: number, agora: Date): Promise<Resultado> {
  const desde = desdeDias(dias, agora);

  const [vendas, compras] = await Promise.all([
    prisma.commercialInvoice.findMany({
      where: { tenantId, type: "SALES", status: "APPROVED", issuedAt: { gte: desde } },
      select: { totalAmount: true },
    }),
    prisma.commercialInvoice.findMany({
      where: { tenantId, type: "PURCHASE", status: "APPROVED", issuedAt: { gte: desde } },
      select: { totalAmount: true },
    }),
  ]);

  const totalVendas = vendas.reduce((s, i) => s + dec(i.totalAmount), 0);
  const totalCompras = compras.reduce((s, i) => s + dec(i.totalAmount), 0);

  return {
    consulta: "resumo",
    titulo: `Resumo dos últimos ${dias} dias`,
    linhas: [],
    totais: {
      "Vendas": totalVendas,
      "Faturas de venda": vendas.length,
      "Ticket médio": vendas.length ? Math.round(totalVendas / vendas.length) : 0,
      "Compras": totalCompras,
      "Faturas de compra": compras.length,
      "Vendas menos compras": totalVendas - totalCompras,
    },
  };
}

async function estoqueBaixo(tenantId: string): Promise<Resultado> {
  // O mínimo é por produto, portanto a comparação não se faz num `where`
  // simples — tem de ser feita depois de ler.
  const produtos = await prisma.product.findMany({
    where: { tenantId, isActive: true, isService: false, minStock: { gt: 0 } },
    select: { name: true, sku: true, currentStock: true, minStock: true, unit: true },
  });

  const baixos = produtos
    .filter((p) => dec(p.currentStock) < dec(p.minStock))
    .sort((a, b) => dec(a.currentStock) - dec(b.currentStock));

  return {
    consulta: "estoque_baixo",
    titulo: "Produtos abaixo do estoque mínimo",
    linhas: baixos.slice(0, LIMITE_LINHAS).map((p) => ({
      produto: p.name,
      sku: p.sku,
      estoque: `${dec(p.currentStock)} ${p.unit}`,
      minimo: `${dec(p.minStock)} ${p.unit}`,
      faltam: dec(p.minStock) - dec(p.currentStock),
    })),
    totais: { "Produtos em falta": baixos.length },
    truncado: baixos.length > LIMITE_LINHAS,
  };
}

async function procurar(tenantId: string, termo: string): Promise<Resultado> {
  if (termo.trim().length < 2) {
    return { consulta: "procurar", titulo: "Escreva pelo menos duas letras", linhas: [] };
  }
  const contem = { contains: termo, mode: "insensitive" as const };

  const [clientes, fornecedores, produtos] = await Promise.all([
    prisma.customer.findMany({ where: { tenantId, name: contem }, select: { name: true, document: true }, take: 8 }),
    prisma.supplier.findMany({ where: { tenantId, name: contem }, select: { name: true, document: true }, take: 8 }),
    prisma.product.findMany({
      where: { tenantId, OR: [{ name: contem }, { sku: contem }] },
      select: { name: true, sku: true },
      take: 8,
    }),
  ]);

  return {
    consulta: "procurar",
    titulo: `Resultados para "${termo}"`,
    linhas: [
      ...clientes.map((c) => ({ tipo: "cliente", nome: c.name, ref: c.document ?? "—" })),
      ...fornecedores.map((f) => ({ tipo: "fornecedor", nome: f.name, ref: f.document ?? "—" })),
      ...produtos.map((p) => ({ tipo: "produto", nome: p.name, ref: p.sku })),
    ],
  };
}
