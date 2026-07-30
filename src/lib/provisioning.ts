import { gerarToken, hashToken, expiraEm, VALIDADE_TOKEN_HORAS } from "@/lib/setup-token";
import prisma from "@/lib/prisma";
import { slugDeNome, slugDisponivel } from "@/lib/tenant-host";
import { seedModulePermissions } from "@/modules/permissions";
import { VERTICALS } from "@/modules/registry";
import { permissoesDoNucleo } from "@/lib/permissoes-nucleo";

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
};

export type ResultadoProvisionamento = {
  tenantId: string;
  slug: string;
  emailAdmin: string;
  /** Token em claro. Existe APENAS aqui — na base guarda-se só o hash. */
  tokenConfiguracao: string;
  expiraEm: Date;
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
    const existe = await prisma.tenant.findUnique({ where: { slug: tentativa }, select: { id: true } });
    if (!existe) return tentativa;
  }
  throw new Error(`Não foi possível encontrar um slug livre a partir de "${base}".`);
}

export async function provisionTenant(
  dados: DadosProvisionamento
): Promise<ResultadoProvisionamento> {
  const email = dados.emailAdmin.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("E-mail do administrador inválido.");

  const jaExiste = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (jaExiste) throw new Error(`Já existe um utilizador com o e-mail ${email}.`);

  const slug = await slugLivre(dados.nome, dados.slug);

  const vertical = dados.vertical ?? "store";
  const modulos = [...new Set([...(VERTICALS[vertical] ?? []), ...(dados.modulosExtra ?? [])])];

  // Token de uso único: o valor em claro existe só nesta variável. Na base
  // guarda-se o hash, para que ler a base não permita usar o link.
  const token = gerarToken();
  const expira = expiraEm();

  const criado = await prisma.$transaction(
    async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dados.nome,
          businessName: dados.nome,
          slug,
          modules: modulos,
          establishment: "001",
          emissionPoint: "001",
          // RUC e atividade económica ficam por preencher: são dados fiscais
          // reais do cliente, e é ele que os introduz.
        },
        select: { id: true },
      });

      const user = await tx.user.create({
        data: {
          name: dados.nomeAdmin ?? `Administrador ${dados.nome}`,
          email,
          // Sem password: define-a o próprio, pelo link de uso único.
          password: null,
          role: "SOVEREIGN",
          tenantId: tenant.id,
        },
        select: { id: true },
      });

      await tx.passwordSetupToken.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt: expira },
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
      await seedModulePermissions(tx, tenant.id, modulos);

      await tx.warehouse.create({
        data: { tenantId: tenant.id, name: "Depósito Principal", code: "MAIN", isDefault: true },
      });

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          action: "PROVISION_TENANT",
          entity: "Tenant",
          entityId: tenant.id,
          details: { nome: dados.nome, slug, vertical, modulos, emailAdmin: email },
        },
      });

      return { tenantId: tenant.id };
    },
    { timeout: 30_000, maxWait: 15_000 }
  );

  return {
    tenantId: criado.tenantId,
    slug,
    emailAdmin: email,
    tokenConfiguracao: token,
    expiraEm: expira,
  };
}

export type ResultadoToken =
  | { ok: true; userId: string }
  | { ok: false; motivo: string };

/** Valida um token de configuração sem o consumir. */
export async function validarToken(token: string): Promise<ResultadoToken> {
  if (!token) return { ok: false, motivo: "Link inválido." };

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
