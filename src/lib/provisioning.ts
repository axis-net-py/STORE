import { gerarToken, hashToken, expiraEm, VALIDADE_TOKEN_HORAS } from "@/lib/setup-token";
import prisma from "@/lib/prisma";
import { basePartilhada, resolverEFixar, fixarBase } from "@/lib/tenant-db";
import { randomBytes } from "node:crypto";
import { slugDeNome, slugDisponivel } from "@/lib/tenant-host";
import { seedModulePermissions } from "@/modules/permissions";
import { VERTICALS } from "@/modules/registry";
import { permissoesDoNucleo } from "@/lib/permissoes-nucleo";
import { PrismaClient } from "@prisma/client";
import { criarProjeto, apagarProjeto } from "@/lib/neon-api";
import {
  registarTenant,
  registarEvento,
  marcarStatus,
  registarUtilizador,
  moradaDoEmail,
  registoPorSlug,
} from "@/lib/control-plane";

/**
 * Provisionamento de um cliente novo.
 *
 * Uma função única (spec Projeto 2, §5.1): o script de linha de comandos é uma
 * casca fina à volta dela, e o futuro painel de administração chamará
 * exatamente a mesma. Assim as duas vias nunca divergem.
 *
 * Idempotente no que consegue ser: se o slug ou o email já existirem, recusa
 * em vez de criar um segundo cliente parecido.
 */

/** Plano de contas mínimo, igual ao do seed do núcleo. */
const CONTAS = [
  { code: "1.1.01", namePt: "Caixa", nameEs: "Caja", type: "ASSET" as const },
  { code: "1.1.02", namePt: "Bancos", nameEs: "Bancos", type: "ASSET" as const },
  { code: "1.2.01", namePt: "Clientes", nameEs: "Clientes", type: "ASSET" as const },
  { code: "1.2.02", namePt: "Estoque", nameEs: "Inventario", type: "ASSET" as const },
  { code: "2.1.01", namePt: "Fornecedores", nameEs: "Proveedores", type: "LIABILITY" as const },
  { code: "2.2.01", namePt: "IVA Crédito", nameEs: "IVA Crédito", type: "LIABILITY" as const },
  { code: "2.2.02", namePt: "IVA Débito", nameEs: "IVA Débito", type: "LIABILITY" as const },
  { code: "3.1.01", namePt: "Capital Social", nameEs: "Capital Social", type: "EQUITY" as const },
  { code: "4.1.01", namePt: "Receita de Vendas", nameEs: "Ingresos por Ventas", type: "REVENUE" as const },
  { code: "5.1.01", namePt: "Custo das Mercadorias", nameEs: "Costo de Mercancías", type: "EXPENSE" as const },
  { code: "5.2.01", namePt: "Despesas Operacionais", nameEs: "Gastos Operativos", type: "EXPENSE" as const },
];

export type DadosProvisionamento = {
  nome: string;
  /** Subdomínio. Derivado do nome quando omitido. */
  slug?: string;
  emailAdmin: string;
  nomeAdmin?: string;
  /** Vertical: store, farm, clinic ou food. */
  vertical?: keyof typeof VERTICALS;
  /** Módulos extra, além dos do vertical. */
  modulosExtra?: string[];
  /**
   * Base de dados própria no Neon?
   *
   * Verdadeiro por omissão: a intenção é que cada conta criada tenha a sua.
   * Fica falso quando não há NEON_API_KEY, ou quando se pede explicitamente
   * hospedagem partilhada — que continua a servir os clientes que já existem.
   */
  dedicada?: boolean;
};

export type ResultadoProvisionamento = {
  tenantId: string;
  slug: string;
  emailAdmin: string;
  /** Token em claro. Existe APENAS aqui — na base guarda-se só o hash. */
  tokenConfiguracao: string;
  expiraEm: Date;
  /** Onde os dados deste cliente ficaram. */
  hospedagem: "SHARED" | "DEDICATED";
  /** Projeto Neon criado, quando a hospedagem é dedicada. */
  neonProjectId?: string;
};


/** Slug livre a partir do nome, acrescentando sufixo numérico se preciso. */
export async function slugLivre(nome: string, sugerido?: string): Promise<string> {
  const base = sugerido ?? slugDeNome(nome);
  if (!slugDisponivel(base)) {
    throw new Error(
      `Slug "${base}" inválido ou reservado. Use letras minúsculas, dígitos e hífen (2 a 63 caracteres).`
    );
  }

  for (let i = 0; i < 50; i++) {
    const tentativa = i === 0 ? base : `${base}-${i + 1}`;
    // Nos dois sítios: o control plane é a autoridade sobre subdomínios, mas
    // os clientes anteriores a ele só existem na base partilhada. Um slug
    // repetido é dois clientes a responder no mesmo endereço.
    const [noRegisto, naPartilhada] = await Promise.all([
      registoPorSlug(tentativa).catch(() => null),
      basePartilhada().tenant.findUnique({ where: { slug: tentativa }, select: { id: true } }),
    ]);
    if (!noRegisto && !naPartilhada) return tentativa;
  }
  throw new Error(`Não foi possível encontrar um slug livre a partir de "${base}".`);
}

/**
 * Identificador do cliente, gerado antes de qualquer coisa existir.
 *
 * Tem de ser conhecido ANTES de se criar o projeto Neon: o registo no control
 * plane grava-se primeiro, e sem isto uma reexecução criaria um segundo
 * projeto deixando o primeiro órfão a contar para a quota (spec §5.2).
 */
function novoTenantId(): string {
  return "c" + randomBytes(12).toString("hex");
}

/** Tudo o que um cliente novo precisa de ter na sua base para funcionar. */
async function semear(
  db: any,
  p: {
    tenantId: string;
    nome: string;
    slug: string;
    modulos: string[];
    vertical: string;
    email: string;
    nomeAdmin: string;
    tokenHash: string;
    expira: Date;
  }
) {
  return db.$transaction(
    async (tx: any) => {
      const tenant = await tx.tenant.create({
        data: {
          // Id explícito: já foi registado no control plane antes de a base
          // existir, e tem de ser o mesmo dos dois lados.
          id: p.tenantId,
          name: p.nome,
          businessName: p.nome,
          slug: p.slug,
          modules: p.modulos,
          establishment: "001",
          emissionPoint: "001",
          // RUC e atividade económica ficam por preencher: são dados fiscais
          // reais do cliente, e é ele que os introduz.
        },
        select: { id: true },
      });

      const user = await tx.user.create({
        data: {
          name: p.nomeAdmin,
          email: p.email,
          // Sem password: define-a o próprio, pelo link de uso único.
          password: null,
          role: "SOVEREIGN",
          tenantId: tenant.id,
        },
        select: { id: true },
      });

      await tx.passwordSetupToken.create({
        data: { userId: user.id, tokenHash: p.tokenHash, expiresAt: p.expira },
      });

      // Em lote: dezenas de inserções sequenciais estouram o tempo limite
      // da transação numa ligação com latência.
      await tx.account.createMany({ data: CONTAS.map((c) => ({ ...c, tenantId: tenant.id })) });

      await tx.permission.createMany({
        data: permissoesDoNucleo(tenant.id),
        skipDuplicates: true,
      });

      // Permissões dos módulos contratados. Sem isto, o módulo fica
      // inacessível a OPERATOR e AUDITOR (ver src/modules/permissions.ts).
      await seedModulePermissions(tx, tenant.id, p.modulos);

      await tx.warehouse.create({
        data: { tenantId: tenant.id, name: "Depósito Principal", code: "MAIN", isDefault: true },
      });

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          action: "PROVISION_TENANT",
          entity: "Tenant",
          entityId: tenant.id,
          details: {
            nome: p.nome, slug: p.slug, vertical: p.vertical,
            modulos: p.modulos, emailAdmin: p.email,
          },
        },
      });

      return { tenantId: tenant.id };
    },
    { timeout: 30_000, maxWait: 15_000 }
  );
}

export async function provisionTenant(
  dados: DadosProvisionamento
): Promise<ResultadoProvisionamento> {
  const email = dados.emailAdmin.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("E-mail do administrador inválido.");

  /**
   * O e-mail tem de ser único em TODA a instalação, não só numa base.
   *
   * Com bases dedicadas, dois clientes diferentes podiam ter o mesmo e-mail sem
   * que nenhuma restrição de base o impedisse — e no login não haveria forma de
   * saber a qual das duas empresas a pessoa queria entrar. O diretório do
   * control plane é o que torna essa unicidade global.
   */
  const noDiretorio = await moradaDoEmail(email);
  if (noDiretorio) throw new Error(`Já existe um utilizador com o e-mail ${email}.`);

  const jaExiste = await basePartilhada().user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (jaExiste) throw new Error(`Já existe um utilizador com o e-mail ${email}.`);

  const slug = await slugLivre(dados.nome, dados.slug);

  const vertical = dados.vertical ?? "store";
  const modulos = [...new Set([...(VERTICALS[vertical] ?? []), ...(dados.modulosExtra ?? [])])];

  // Token de uso único: o valor em claro existe só nesta variável. Na base
  // guarda-se o hash, para que ler a base não permita usar o link.
  const token = gerarToken();
  const expira = expiraEm();

  const tenantId = novoTenantId();
  const nomeAdmin = dados.nomeAdmin ?? `Administrador ${dados.nome}`;

  // Base própria por omissão, que é a intenção do produto. Sem chave da API do
  // Neon não há como criar uma, e aí cai na partilhada em vez de falhar — um
  // cliente numa base partilhada funciona; um cliente por criar, não.
  const dedicada = dados.dedicada ?? !!process.env.NEON_API_KEY;

  const comum = {
    tenantId, nome: dados.nome, slug, modulos, vertical,
    email, nomeAdmin, tokenHash: hashToken(token), expira,
  };

  if (!dedicada) {
    await semear(basePartilhada(), comum);
    const registo = await registarTenant({
      slug, name: dados.nome, tenantId, vertical, modules: modulos, hosting: "SHARED",
    }).catch((e) => {
      // Sem control plane o cliente funciona na mesma — a base partilhada é a
      // do ambiente. Fica sem registo, e isso tem de aparecer no log.
      console.error("[provisionamento] Cliente criado sem registo no control plane:", e);
      return null;
    });
    if (registo) await registarUtilizador(email, registo.id, tenantId).catch(() => {});

    return {
      tenantId, slug, emailAdmin: email,
      tokenConfiguracao: token, expiraEm: expira, hospedagem: "SHARED",
    };
  }

  // ─── Base dedicada ────────────────────────────────────────────────────────
  //
  // A ordem importa e não é arbitrária: cria-se o projeto, regista-se JÁ, e só
  // depois se mexe nele. Um projeto criado sem registo é um projeto órfão que
  // ninguém sabe de quem é e que continua a contar para a quota.

  const projeto = await criarProjeto(slug);

  let registoId: string | null = null;
  try {
    const registo = await registarTenant({
      slug,
      name: dados.nome,
      tenantId,
      vertical,
      modules: modulos,
      hosting: "DEDICATED",
      connectionString: projeto.connectionString,
      neonProjectId: projeto.id,
    });
    registoId = registo.id;
    await registarEvento(registoId, "projeto-neon-criado", true, { neonProjectId: projeto.id });

    const { aplicarMigracoes } = await import("@/lib/migrar-base");
    await aplicarMigracoes(projeto.connectionStringDireta);
    await registarEvento(registoId, "migracoes-aplicadas", true);

    const db = new PrismaClient({ datasources: { db: { url: projeto.connectionString } } });
    try {
      await semear(db, comum);
    } finally {
      await db.$disconnect();
    }
    await registarEvento(registoId, "dados-iniciais", true);

    await registarUtilizador(email, registoId, tenantId);
    await marcarStatus(registoId, "ACTIVE");

    return {
      tenantId, slug, emailAdmin: email,
      tokenConfiguracao: token, expiraEm: expira,
      hospedagem: "DEDICATED", neonProjectId: projeto.id,
    };
  } catch (erro) {
    /**
     * Desfaz o que ficou a meio.
     *
     * Um projeto Neon meio-provisionado é pior do que nenhum: conta para a
     * quota, tem um esquema incompleto, e ninguém sabe se lá dentro há dados de
     * alguém. Apaga-se — e este é o ÚNICO sítio onde se apaga um projeto, nunca
     * um cliente ativo.
     */
    if (registoId) {
      await registarEvento(registoId, "falhou", false, { erro: String(erro).slice(0, 500) });
      await marcarStatus(registoId, "FAILED").catch(() => {});
    }
    await apagarProjeto(projeto.id).catch((e) =>
      console.error(
        `[provisionamento] Projeto Neon ${projeto.id} ficou órfão e tem de ser apagado à mão:`,
        e
      )
    );
    throw erro;
  }
}

export type ResultadoToken =
  | { ok: true; userId: string }
  | { ok: false; motivo: string };

/**
 * Valida um token de configuração sem o consumir.
 *
 * O `slug` diz em que base procurar. Não é um segredo — é o subdomínio do
 * cliente, que está à vista no endereço — e sem ele, com bases dedicadas, não
 * havia forma de saber onde o token vive. O segredo continua a ser só o token.
 */
export async function validarToken(token: string, slug?: string): Promise<ResultadoToken> {
  if (!token) return { ok: false, motivo: "Link inválido." };

  if (slug) {
    const registo = await registoPorSlug(slug).catch(() => null);
    if (registo) fixarBase(registo.tenantId, await resolverEFixar(registo.tenantId));
  }

  const linha = await prisma.passwordSetupToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { userId: true, expiresAt: true, usedAt: true },
  });

  if (!linha) return { ok: false, motivo: "Link inválido." };
  if (linha.usedAt) return { ok: false, motivo: "Este link já foi utilizado." };
  if (linha.expiresAt < new Date()) return { ok: false, motivo: "Este link expirou. Peça um novo." };

  return { ok: true, userId: linha.userId };
}

// Reexportadas para quem já as importava daqui.
export { hashToken, VALIDADE_TOKEN_HORAS };
