"use server";

import prisma from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import { permissoesDoNucleo } from "@/lib/permissoes-nucleo";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";

/**
 * Gestão de equipa e permissões.
 *
 * REGRA DESTE FICHEIRO: o tenant vem SEMPRE da sessão, nunca do parâmetro.
 *
 * As funções mantêm o parâmetro `tenantId` porque a interface o passa, mas ele
 * é ignorado. Usá-lo permitiria a um SOVEREIGN de uma empresa listar, alterar
 * permissões e mudar papéis de utilizadores de OUTRA — a verificação de
 * permissão corre sempre contra o tenant da sessão, e a consulta correria
 * contra o que o cliente pedisse.
 */

async function logAudit(userId: string, tenantId: string, action: string, details: any) {
  await prisma.auditLog.create({
    data: { tenantId, userId, action, details },
  });
}

// ─── Utilizadores do cliente ─────────────────────────────────

export async function getUsers(_tenantId?: string) {
  const { tenantId } = await requirePermission("settings:read");

  return prisma.user.findMany({
    where: { tenantId },
    select: { id: true, email: true, name: true, role: true },
    orderBy: { email: "asc" },
  });
}

// ─── Mudar o papel de um utilizador ──────────────────────────

export async function updateUserRole(userId: string, newRole: Role) {
  const { tenantId, userId: autorId } = await requirePermission("users:manage");

  // O alvo tem de ser do MESMO cliente. Sem este filtro, um SOVEREIGN podia
  // promover-se a si próprio dentro da empresa de outra pessoa.
  const alvo = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { id: true, role: true },
  });
  if (!alvo) throw new Error("Usuário não encontrado");

  // Rebaixar o último SOVEREIGN deixaria a conta sem dono — ninguém poderia
  // voltar a gerir utilizadores nem permissões.
  if (alvo.role === "SOVEREIGN" && newRole !== "SOVEREIGN") {
    const quantos = await prisma.user.count({ where: { tenantId, role: "SOVEREIGN" } });
    if (quantos <= 1) {
      throw new Error("Não é possível rebaixar o único usuário Sovereign da conta.");
    }
  }

  const user = await prisma.user.update({
    where: { id: alvo.id },
    data: { role: newRole },
    select: { id: true, name: true, email: true, role: true },
  });

  await logAudit(autorId, tenantId, "UPDATE_USER_ROLE", {
    userId,
    de: alvo.role,
    para: newRole,
  });
  revalidatePath(`/${tenantId}/settings/team`);
  return { success: true, user };
}

// ─── Permissões ──────────────────────────────────────────────

export async function getPermissions(_tenantId?: string) {
  const { tenantId } = await requirePermission("settings:read");

  return prisma.permission.findMany({
    where: { tenantId },
    orderBy: { action: "asc" },
  });
}

export async function updatePermission(
  _tenantId: string | undefined,
  action: string,
  role: Role,
  enabled: boolean
) {
  const { tenantId, userId } = await requirePermission("settings:write");

  // SOVEREIGN não passa pela matriz (ver lib/authz.ts): dar-lhe ou tirar-lhe
  // linhas não teria efeito, e tirá-las daria a impressão errada de que teve.
  if (role === "SOVEREIGN") {
    throw new Error("O papel Sovereign tem acesso total por definição e não é configurável.");
  }

  if (enabled) {
    await prisma.permission.upsert({
      where: { action_role_tenantId: { action, role, tenantId } },
      update: {},
      create: { action, role, tenantId },
    });
  } else {
    await prisma.permission.deleteMany({ where: { action, role, tenantId } });
  }

  await logAudit(userId, tenantId, "UPDATE_PERMISSION", { action, role, enabled });
  revalidatePath(`/${tenantId}/settings/team`);
  return { success: true };
}

export async function seedDefaultPermissions(_tenantId?: string) {
  const { tenantId, userId } = await requirePermission("settings:write");

  // Usa a matriz oficial (lib/permissoes-nucleo.ts), a mesma do
  // provisionamento. Esta função concedia TODAS as 21 ações a ADMIN, OPERATOR
  // e AUDITOR, incluindo apagar e gerir utilizadores — um clique aqui dava ao
  // AUDITOR, que é quem confere, o poder de apagar faturas.
  const linhas = permissoesDoNucleo(tenantId);
  const r = await prisma.permission.createMany({ data: linhas, skipDuplicates: true });

  await logAudit(userId, tenantId, "SEED_PERMISSIONS", {
    criadas: r.count,
    totalNaMatriz: linhas.length,
  });
  revalidatePath(`/${tenantId}/settings/team`);
  return { success: true, count: r.count };
}

// ─── Criar e remover utilizadores ────────────────────────────

export async function createUserAction(data: { name: string; email: string; role: Role }) {
  const { tenantId, userId: autorId } = await requirePermission("users:manage");

  // Senha temporária aleatória por usuário (nunca uma senha padrão partilhada)
  const tempPassword = `Cx-${randomBytes(9).toString("base64url")}`;
  const hashedPassword = await hash(tempPassword, 10);

  // Normalizado antes da verificação de duplicado E da criação: a coluna é
  // sensível a maiúsculas, e sem isto "Ana@x.com" passaria a verificação e
  // criaria uma segunda conta ao lado de "ana@x.com".
  const email = data.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new Error("E-mail já cadastrado");

  const newUser = await prisma.user.create({
    data: {
      name: data.name,
      email,
      password: hashedPassword,
      role: data.role,
      tenantId,
      mustChangePassword: true,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  await logAudit(autorId, tenantId, "CREATE_USER", {
    userId: newUser.id,
    email: newUser.email,
    role: newUser.role,
  });
  revalidatePath(`/${tenantId}/settings/team`);
  return { success: true, user: newUser, tempPassword };
}

export async function deleteUserAction(userId: string) {
  const { tenantId, userId: autorId } = await requirePermission("users:manage");

  if (autorId === userId) throw new Error("Não é possível excluir seu próprio usuário");

  const targetUser = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!targetUser) throw new Error("Usuário não encontrado ou não pertence a este inquilino");

  if (targetUser.role === "SOVEREIGN") throw new Error("Não é possível excluir um usuário Sovereign");

  await prisma.user.delete({ where: { id: userId } });

  await logAudit(autorId, tenantId, "DELETE_USER", { userId, email: targetUser.email });
  revalidatePath(`/${tenantId}/settings/team`);
  return { success: true };
}
