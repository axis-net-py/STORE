import { PrismaClient as ControlClient } from "@/generated/control";
import { cifrar, decifrar, CHAVE_LIGACOES } from "@/lib/crypto";

/**
 * Acesso ao control plane — o registo de clientes (spec Projeto 2, §3.1).
 *
 * Vive num projeto Neon próprio, separado das bases dos clientes, porque
 * guarda as strings de ligação de todos. Nunca guarda dados de negócio.
 */

const globalForControl = globalThis as unknown as { control?: ControlClient };

/**
 * Cliente do control plane, criado à primeira utilização.
 *
 * Preguiçoso e não no topo do módulo: o `next build` carrega os módulos para
 * recolher as rotas, e um PrismaClient construído com a variável em falta atira
 * logo aí — o build inteiro falhava por causa de uma ligação que naquele
 * momento ninguém ia usar.
 *
 * Sem CONTROL_PLANE_DATABASE_URL não há registo de clientes, e isso não é um
 * erro: é uma instalação de base partilhada, que é como o sistema começou. Quem
 * chama trata do null.
 */
export function controlPlane(): ControlClient | null {
  if (!process.env.CONTROL_PLANE_DATABASE_URL) return null;
  if (!globalForControl.control) {
    globalForControl.control = new ControlClient({
      datasources: { db: { url: process.env.CONTROL_PLANE_DATABASE_URL } },
    });
  }
  return globalForControl.control;
}

/** Para quem não sabe funcionar sem control plane — provisionamento e afins. */
function exigirControlPlane(): ControlClient {
  const c = controlPlane();
  if (!c) {
    throw new Error(
      "CONTROL_PLANE_DATABASE_URL em falta: não é possível registar nem localizar clientes."
    );
  }
  return c;
}

export type Hospedagem = "SHARED" | "DEDICATED";

export type RegistoTenant = {
  id: string;
  slug: string;
  name: string;
  tenantId: string;
  hosting: Hospedagem;
  status: string;
  neonProjectId: string | null;
  vertical: string;
  modules: string[];
  schemaVersion: string | null;
};

/** Procura um cliente pelo subdomínio. É o caminho quente de cada pedido. */
export async function registoPorSlug(slug: string): Promise<RegistoTenant | null> {
  const c = controlPlane();
  if (!c) return null;
  const r = await c.tenantRegistry.findUnique({
    where: { slug },
    // Seleção explícita: a string de ligação cifrada NUNCA sai daqui por
    // acidente. Quem precisa dela chama ligacaoDe().
    select: {
      id: true, slug: true, name: true, tenantId: true, hosting: true,
      status: true, neonProjectId: true, vertical: true, modules: true, schemaVersion: true,
    },
  });
  return r as RegistoTenant | null;
}

export async function registoPorTenantId(tenantId: string): Promise<RegistoTenant | null> {
  const c = controlPlane();
  if (!c) return null;
  const r = await c.tenantRegistry.findFirst({
    where: { tenantId },
    select: {
      id: true, slug: true, name: true, tenantId: true, hosting: true,
      status: true, neonProjectId: true, vertical: true, modules: true, schemaVersion: true,
    },
  });
  return r as RegistoTenant | null;
}

/**
 * String de ligação de um cliente, decifrada.
 *
 * Devolve null com hospedagem partilhada: nesse caso usa-se a ligação do
 * ambiente, e não há segredo por cliente para guardar.
 */
export async function ligacaoDe(registoId: string): Promise<string | null> {
  const c = controlPlane();
  if (!c) return null;
  const r = await c.tenantRegistry.findUnique({
    where: { id: registoId },
    select: { hosting: true, connectionCipher: true, connectionIv: true, connectionTag: true },
  });
  if (!r || r.hosting === "SHARED") return null;
  if (!r.connectionCipher || !r.connectionIv || !r.connectionTag) {
    throw new Error(`Cliente ${registoId} é dedicado mas não tem string de ligação registada.`);
  }
  return decifrar(
    { cipher: r.connectionCipher, iv: r.connectionIv, tag: r.connectionTag },
    CHAVE_LIGACOES
  );
}

export type NovoRegisto = {
  slug: string;
  name: string;
  tenantId: string;
  vertical?: string;
  modules?: string[];
  hosting?: Hospedagem;
  /** String de ligação em claro. Cifrada aqui; nunca gravada como veio. */
  connectionString?: string;
  neonProjectId?: string;
};

export async function registarTenant(d: NovoRegisto): Promise<RegistoTenant> {
  const dedicado = d.hosting === "DEDICATED";
  if (dedicado && !d.connectionString) {
    throw new Error("Hospedagem dedicada exige string de ligação.");
  }

  const c = d.connectionString ? cifrar(d.connectionString, CHAVE_LIGACOES) : null;

  const r = await exigirControlPlane().tenantRegistry.create({
    data: {
      slug: d.slug,
      name: d.name,
      tenantId: d.tenantId,
      vertical: d.vertical ?? "store",
      modules: d.modules ?? ["store"],
      hosting: dedicado ? "DEDICATED" : "SHARED",
      status: "ACTIVE",
      neonProjectId: d.neonProjectId ?? null,
      connectionCipher: c?.cipher ?? null,
      connectionIv: c?.iv ?? null,
      connectionTag: c?.tag ?? null,
    },
    select: {
      id: true, slug: true, name: true, tenantId: true, hosting: true,
      status: true, neonProjectId: true, vertical: true, modules: true, schemaVersion: true,
    },
  });
  return r as RegistoTenant;
}

/**
 * Regista um passo do provisionamento.
 *
 * O provisionamento cria recursos FORA da nossa base — projetos Neon — e essa
 * história tem de ficar escrita para se saber onde parou (§5.2).
 */
export async function registarEvento(
  registoId: string,
  step: string,
  ok: boolean,
  detalhe?: unknown
) {
  try {
    await exigirControlPlane().provisioningEvent.create({
      data: { tenantId: registoId, step, ok, detalhe: (detalhe ?? null) as any },
    });
  } catch (e) {
    // O registo do evento nunca pode derrubar o passo que já foi executado.
    console.error(`[control-plane] Falha ao registar evento "${step}":`, e);
  }
}

export async function marcarStatus(registoId: string, status: string) {
  await exigirControlPlane().tenantRegistry.update({ where: { id: registoId }, data: { status: status as any } });
}

/** Clientes ativos, para o script de migrações e o resumo diário. */
export async function tenantsAtivos(): Promise<RegistoTenant[]> {
  const cp = controlPlane();
  if (!cp) return [];
  const r = await cp.tenantRegistry.findMany({
    where: { status: { in: ["ACTIVE", "MIGRATION_FAILED"] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, slug: true, name: true, tenantId: true, hosting: true,
      status: true, neonProjectId: true, vertical: true, modules: true, schemaVersion: true,
    },
  });
  return r as RegistoTenant[];
}

// ─── Diretório de utilizadores ──────────────────────────────────────────────

export type Morada = { registryId: string; tenantId: string };

/**
 * Em que cliente vive este e-mail.
 *
 * Chamado no login, antes de haver sessão. Devolve null quando o e-mail não
 * está no diretório — o que acontece com os clientes partilhados anteriores a
 * isto, e nesse caso o login procura na base partilhada como sempre fez.
 */
export async function moradaDoEmail(email: string): Promise<Morada | null> {
  try {
    const cp = controlPlane();
    if (!cp) return null;
    const r = await cp.userDirectory.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { registryId: true, tenantId: true },
    });
    return r;
  } catch (e) {
    // Control plane em baixo não pode impedir os clientes partilhados de
    // entrarem: para esses, a base do ambiente responde na mesma.
    console.error("[control-plane] Falha ao consultar o diretório:", e);
    return null;
  }
}

/** Regista onde procurar um utilizador. Idempotente. */
export async function registarUtilizador(
  email: string,
  registryId: string,
  tenantId: string
): Promise<void> {
  const chave = email.trim().toLowerCase();
  await exigirControlPlane().userDirectory.upsert({
    where: { email: chave },
    create: { email: chave, registryId, tenantId },
    update: { registryId, tenantId },
  });
}

export async function esquecerUtilizador(email: string): Promise<void> {
  await exigirControlPlane().userDirectory
    .delete({ where: { email: email.trim().toLowerCase() } })
    .catch(() => {});
}
