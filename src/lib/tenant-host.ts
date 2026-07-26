/**
 * Resolução do cliente a partir do endereço.
 *
 * `smartbuy.axisstore.com` → cliente `smartbuy`. Um único deploy serve todos
 * os clientes; o subdomínio diz qual (spec Projeto 2, §3 e §4.3).
 *
 * Isto é lógica pura de strings de propósito: corre no middleware, em Edge
 * runtime, onde o Prisma não funciona. A tradução de slug para base de dados
 * acontece depois, já em Node.
 */

/** Nunca vendáveis como slug: colidiriam com endereços do próprio sistema. */
export const SLUGS_RESERVADOS = new Set([
  "www", "api", "app", "admin", "login", "auth", "static", "assets",
  "cdn", "mail", "ftp", "blog", "docs", "status", "help", "suporte",
]);

export type Resolucao =
  | { tipo: "tenant"; slug: string }
  /** Subdomínio do sistema (admin, www…), não é cliente. */
  | { tipo: "reservado"; nome: string }
  /** Domínio raiz ou host de deploy: sem cliente associado. */
  | { tipo: "raiz" };

/**
 * Domínios sob os quais um subdomínio identifica um cliente.
 * Configurável por ambiente: em produção `axisstore.com,axisfarm.com,…`,
 * em desenvolvimento `localhost` (com `smartbuy.localhost:3000` a funcionar).
 */
export function dominiosBase(env = process.env.TENANT_BASE_DOMAINS): string[] {
  // `||` e não `??`: a variável definida como string vazia é caso comum em
  // painéis de configuração, e deve cair no valor por omissão na mesma.
  return (env || "localhost")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Formato aceite para slug: minúsculas, dígitos e hífen interno.
 * Entre 2 e 63 caracteres — um só carácter é curto de mais para um negócio,
 * e 63 é o limite de um rótulo DNS.
 */
export function slugValido(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(slug) && !slug.includes("--");
}

export function slugDisponivel(slug: string): boolean {
  return slugValido(slug) && !SLUGS_RESERVADOS.has(slug);
}

/**
 * Deriva um slug a partir do nome do cliente: "Smart Buy" → "smart-buy".
 * Não garante unicidade — isso é do provisionamento, que consulta a base.
 */
export function slugDeNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos combinantes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 63);
}

/**
 * Resolve o host de um pedido.
 *
 * Hosts de deploy (`*.vercel.app`) são propositadamente tratados como raiz:
 * `axisretail.vercel.app` é o endereço da aplicação, não um cliente chamado
 * "axisretail". Só os domínios configurados em TENANT_BASE_DOMAINS carregam
 * clientes em subdomínio.
 */
export function resolverHost(
  host: string | null | undefined,
  bases = dominiosBase()
): Resolucao {
  if (!host) return { tipo: "raiz" };

  // Fora a porta, e sem distinguir maiúsculas.
  const limpo = host.split(":")[0].trim().toLowerCase();
  if (!limpo) return { tipo: "raiz" };

  for (const base of bases) {
    if (limpo === base) return { tipo: "raiz" };

    if (limpo.endsWith(`.${base}`)) {
      const prefixo = limpo.slice(0, -(base.length + 1));
      // Só o primeiro nível conta: `a.b.axisstore.com` não é o cliente "a.b".
      if (prefixo.includes(".")) return { tipo: "raiz" };
      if (SLUGS_RESERVADOS.has(prefixo)) return { tipo: "reservado", nome: prefixo };
      if (!slugValido(prefixo)) return { tipo: "raiz" };
      return { tipo: "tenant", slug: prefixo };
    }
  }

  return { tipo: "raiz" };
}
