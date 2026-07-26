import { createHmac, timingSafeEqual } from "crypto";

/**
 * Níveis de risco e confirmação de intenções do assistente.
 *
 * Princípios P4 e P5 da spec (Projeto 1 §6.3): a IA propõe, o humano confirma;
 * e o que ela pode fazer sem confirmação depende da consequência do ato.
 *
 * A intenção viaja até ao cliente e volta assinada. Sem assinatura, bastaria
 * ao cliente alterar a quantidade entre a proposta e a confirmação — o que
 * transformaria a confirmação em teatro.
 */

export type Nivel = 0 | 1 | 2 | 3;

/**
 * 0 leitura            — livre
 * 1 escrita reversível — executa, fica registada
 * 2 consequência       — exige confirmação explícita
 * 3 fiscal/irreversível— exige confirmação explícita, nunca encadeada
 */
export const NIVEL: Record<string, Nivel> = {
  query_stock: 0,
  query_sales: 0,
  query_balances: 0,

  create_customer: 1,
  create_supplier: 1,

  create_product: 2,
  adjust_stock: 2,
  transfer_stock: 2,
  create_finance_transaction: 2,
  create_order: 2,
  register_payment: 2,

  create_purchase_invoice: 3,
  create_sales_invoice: 3,
};

/** Ações desconhecidas são tratadas como fiscais: o default é o mais cauteloso. */
export function nivelDe(action: string): Nivel {
  return NIVEL[action] ?? 3;
}

export function exigeConfirmacao(action: string): boolean {
  return nivelDe(action) >= 2;
}

// ─── Assinatura ─────────────────────────────────────────────────────────────

function segredo(): string {
  const s =
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV !== "production" ? "axis-store-dev-only-secret" : undefined);
  if (!s) throw new Error("NEXTAUTH_SECRET em falta: não é possível assinar intenções.");
  return s;
}

export type Intencao = {
  action: string;
  data: any;
  tenantId: string;
  userId: string;
  /** Expiração em milissegundos desde a época. */
  exp: number;
};

/** Validade curta: a confirmação é um gesto imediato, não um adiamento. */
const VALIDADE_MS = 10 * 60 * 1000;

export function assinarIntencao(i: Omit<Intencao, "exp">): string {
  const corpo: Intencao = { ...i, exp: Date.now() + VALIDADE_MS };
  const json = JSON.stringify(corpo);
  const b64 = Buffer.from(json, "utf8").toString("base64url");
  const mac = createHmac("sha256", segredo()).update(b64).digest("base64url");
  return `${b64}.${mac}`;
}

export type Verificacao =
  | { ok: true; intencao: Intencao }
  | { ok: false; motivo: string };

/**
 * Verifica assinatura, validade e titularidade.
 *
 * A comparação do MAC é em tempo constante: comparar com === permitiria, em
 * teoria, descobrir a assinatura byte a byte pelo tempo de resposta.
 */
export function verificarIntencao(
  token: string,
  tenantId: string,
  userId: string
): Verificacao {
  const partes = token.split(".");
  if (partes.length !== 2) return { ok: false, motivo: "Confirmação malformada." };

  const [b64, mac] = partes;
  const esperado = createHmac("sha256", segredo()).update(b64).digest("base64url");

  const a = Buffer.from(mac);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, motivo: "Confirmação inválida — a intenção foi alterada." };
  }

  let intencao: Intencao;
  try {
    intencao = JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
  } catch {
    return { ok: false, motivo: "Confirmação ilegível." };
  }

  if (Date.now() > intencao.exp) {
    return { ok: false, motivo: "A confirmação expirou. Repita o comando." };
  }
  // Uma intenção assinada para um tenant não vale noutro, nem para outro utilizador.
  if (intencao.tenantId !== tenantId || intencao.userId !== userId) {
    return { ok: false, motivo: "Confirmação não pertence a esta sessão." };
  }

  return { ok: true, intencao };
}

// ─── Resumo legível ─────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("es-PY");

/** O que o utilizador lê antes de confirmar. Tem de dizer a consequência. */
export function resumirIntencao(action: string, d: any): string {
  const itens = (d?.items ?? []) as any[];
  const listaItens = itens
    .map((i) => `${i.quantity ?? "?"} × ${i.name ?? i.sku ?? "?"}`)
    .join(", ");

  switch (action) {
    case "create_sales_invoice":
      return `Emitir fatura de VENDA para "${d.customerName}": ${listaItens}. Baixa o estoque e gera lançamento contábil.`;
    case "create_purchase_invoice":
      return `Registar fatura de COMPRA de "${d.supplierName}": ${listaItens}. Aumenta o estoque e gera lançamento contábil.`;
    case "create_order":
      return `Criar pedido de ${d.type === "SALES" ? "venda" : "compra"} para "${d.entityName}": ${listaItens}.`;
    case "register_payment":
      return `Registar pagamento de ${fmt.format(Number(d.amount ?? 0))} Gs.`;
    case "adjust_stock":
      return `Ajustar estoque de "${d.productName ?? d.sku}": ${d.type === "SAIDA" ? "saída" : "entrada"} de ${d.quantity}. Altera o inventário.`;
    case "transfer_stock":
      return `Transferir ${d.quantity} de "${d.productName ?? d.sku}" entre depósitos.`;
    case "create_product":
      return `Cadastrar produto "${d.name}" com preço ${fmt.format(Number(d.price ?? 0))} Gs.`;
    case "create_finance_transaction":
      return `Registar ${d.type === "RECEIVABLE" ? "recebimento" : "pagamento"} de ${fmt.format(Number(d.amount ?? 0))} Gs para "${d.entityId}".`;
    default:
      return `Executar "${action}".`;
  }
}
