import { headers } from "next/headers";
import prisma from "@/lib/prisma";

/**
 * Leitura do cliente indicado pelo subdomínio, já em Node.
 *
 * O middleware resolveu o host e escreveu `x-tenant-slug` no pedido. Aqui
 * traduz-se esse slug para o cliente, e verifica-se que a sessão lhe pertence.
 */

/** Slug do subdomínio, ou null quando o acesso é pelo domínio raiz. */
export async function slugDoPedido(): Promise<string | null> {
  const h = await headers();
  return h.get("x-tenant-slug");
}

export async function tenantPorSlug(slug: string) {
  return prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, modules: true },
  });
}

export type Coerencia =
  /** Sem subdomínio: acesso pelo domínio raiz, a sessão manda. */
  | { ok: true; motivo: "sem-subdominio" }
  /** O subdomínio corresponde ao cliente da sessão. */
  | { ok: true; motivo: "coincide"; tenantId: string }
  | { ok: false; motivo: "subdominio-desconhecido" }
  | { ok: false; motivo: "sessao-de-outro-cliente" };

/**
 * Defesa em profundidade (spec Projeto 2, §4.2).
 *
 * A defesa primária é a cookie ser host-only: o navegador nunca envia a de
 * `a.axisstore.com` para `b.axisstore.com`. Esta é a segunda linha — se algo
 * correr mal com a cookie, o pedido não passa na mesma.
 */
export async function verificarCoerencia(tenantIdDaSessao: string): Promise<Coerencia> {
  const slug = await slugDoPedido();
  if (!slug) return { ok: true, motivo: "sem-subdominio" };

  const tenant = await tenantPorSlug(slug);
  if (!tenant) return { ok: false, motivo: "subdominio-desconhecido" };

  if (tenant.id !== tenantIdDaSessao) return { ok: false, motivo: "sessao-de-outro-cliente" };

  return { ok: true, motivo: "coincide", tenantId: tenant.id };
}
