/**
 * Tradução de uma fatura nossa para o formato que se declara à SET.
 *
 * Módulo puro e sem dependências de propósito: isto é o conteúdo de uma
 * declaração fiscal, e tem de poder ser testado sem base de dados.
 *
 * Auditoria de 2026-07-30. O mapeamento anterior descartava, em silêncio, os
 * dados fiscais que a fatura já tinha guardados:
 *
 *   stamp: ""                              // o timbrado ia vazio
 *   totalIva10: 0, totalIva5: 0,           // "Calculate from items"
 *   totalExento: 0                         //   — nunca foi calculado
 *   taxType: "IVA_10", taxAmount: 0        // fixo, item a item
 *   customerType: "JURIDICA"               // fixo
 *   customerDocument: … || "00000000"      // documento inventado
 *
 * Ou seja: cada documento transmitido declarava zero de IVA, sem timbrado, com
 * todos os itens a 10% e o cliente como pessoa jurídica. As colunas
 * totalIva10, totalIva5, totalExento e InvoiceItem.taxType/taxAmount existem e
 * estavam corretamente preenchidas — só não eram lidas.
 *
 * Declarar IVA a zero em todas as vendas é uma declaração falsa perante a SET,
 * com o agravante de os nossos próprios registos dizerem outra coisa: numa
 * fiscalização, a divergência aparece à primeira conferência.
 */

export type TipoImposto = "IVA_10" | "IVA_5" | "EXENTO";
export type TipoDocCliente = "RUC" | "CEDULA" | "PASAPORTE" | "EXTRANJERO";
export type TipoPessoa = "FISICA" | "JURIDICA";

export type FaturaParaSifen = {
  documentNumber: string | null;
  timbrado: string | null;
  issuedAt: Date;
  totalAmount: unknown;
  totalIva10: unknown;
  totalIva5: unknown;
  totalExento: unknown;
  currency: string;
  items: {
    quantity: unknown;
    unitPrice: unknown;
    totalPrice: unknown;
    taxType: string;
    taxAmount: unknown;
    product: { name: string | null; unit: string | null };
  }[];
  customer: { name: string; document: string | null; documentType: string | null } | null;
};

export type DocumentoSifen = {
  documentType: "FACTURA";
  documentNumber: string;
  stamp: string;
  issueDate: Date;
  totalAmount: number;
  totalIva10: number;
  totalIva5: number;
  totalExento: number;
  currency: "PYG" | "USD" | "BRL";
  exchangeRate?: number;
  items: {
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    description: string;
    taxType: TipoImposto;
    taxAmount: number;
    unit: string;
  }[];
  customerDocument: string;
  customerName: string;
  customerType: TipoPessoa;
  customerDocType: TipoDocCliente;
};

/** Erro com a lista do que falta, para a mensagem dizer o que corrigir. */
export class DadosFiscaisIncompletos extends Error {
  readonly faltas: string[];

  constructor(faltas: string[]) {
    super(
      `Não é possível transmitir à SET: ${faltas.join("; ")}. ` +
        "Corrija a fatura e tente novamente."
    );
    this.name = "DadosFiscaisIncompletos";
    this.faltas = faltas;
  }
}

/** Decimal do Prisma, string ou number — tudo vira number. */
function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

function normalizarImposto(v: string): TipoImposto {
  return v === "IVA_5" || v === "EXENTO" ? v : "IVA_10";
}

/**
 * RUC → jurídica; cédula, passaporte e estrangeiro → física.
 *
 * É uma aproximação: no Paraguai uma pessoa física também pode ter RUC. Mas é
 * a única informação que temos, e escolher a partir dela é melhor do que a
 * constante "JURIDICA" que aqui estava. Quando o cadastro do cliente passar a
 * distinguir os dois, esta função é o único sítio a mudar.
 */
function tipoDeDocumento(bruto: string | null): { docType: TipoDocCliente; pessoa: TipoPessoa } {
  const t = (bruto ?? "").trim().toUpperCase();
  if (t === "CEDULA" || t === "CI") return { docType: "CEDULA", pessoa: "FISICA" };
  if (t === "PASAPORTE") return { docType: "PASAPORTE", pessoa: "FISICA" };
  if (t === "EXTRANJERO") return { docType: "EXTRANJERO", pessoa: "FISICA" };
  return { docType: "RUC", pessoa: "JURIDICA" };
}

function moeda(v: string): "PYG" | "USD" | "BRL" {
  return v === "USD" || v === "BRL" ? v : "PYG";
}

export function mapearParaSifen(
  fatura: FaturaParaSifen,
  exchangeRate?: number
): DocumentoSifen {
  const faltas: string[] = [];

  if (!fatura.documentNumber?.trim()) faltas.push("a fatura não tem número");

  // Sem timbrado, o documento não é fiscal. Ia vazio para a SET.
  if (!fatura.timbrado?.trim()) {
    faltas.push("a fatura não tem timbrado (Configurações › Fiscal)");
  }

  // Um documento inventado ("00000000") no lugar do RUC do cliente é uma
  // declaração falsa. Melhor recusar e obrigar a preencher o cadastro.
  if (!fatura.customer) faltas.push("a fatura não tem cliente");
  else if (!fatura.customer.document?.trim()) {
    faltas.push(`o cliente ${fatura.customer.name} não tem documento (RUC ou cédula)`);
  }

  if (fatura.items.length === 0) faltas.push("a fatura não tem itens");

  if (faltas.length > 0) throw new DadosFiscaisIncompletos(faltas);

  const cliente = fatura.customer!;
  const { docType, pessoa } = tipoDeDocumento(cliente.documentType);

  return {
    documentType: "FACTURA",
    documentNumber: fatura.documentNumber!.trim(),
    stamp: fatura.timbrado!.trim(),
    issueDate: fatura.issuedAt,
    totalAmount: num(fatura.totalAmount),
    totalIva10: num(fatura.totalIva10),
    totalIva5: num(fatura.totalIva5),
    totalExento: num(fatura.totalExento),
    currency: moeda(fatura.currency),
    exchangeRate,
    items: fatura.items.map((item) => ({
      quantity: num(item.quantity),
      unitPrice: num(item.unitPrice),
      totalPrice: num(item.totalPrice),
      description: item.product.name ?? "",
      taxType: normalizarImposto(item.taxType),
      taxAmount: num(item.taxAmount),
      unit: item.product.unit ?? "un",
    })),
    customerDocument: cliente.document!.trim(),
    customerName: cliente.name,
    customerType: pessoa,
    customerDocType: docType,
  };
}
