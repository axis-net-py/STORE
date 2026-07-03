import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export type AuthContext = {
  tenantId: string
  userId: string
  role: string
}

/**
 * Autorização central para server actions.
 *
 * Regras:
 * - SOVEREIGN e ADMIN: acesso total.
 * - OPERATOR/AUDITOR: precisam de uma linha em Permission (action + role + tenant).
 * - Compatibilidade: se o tenant nunca cadastrou permissões (tabela vazia),
 *   OPERATOR mantém acesso operacional (exceto gestão de usuários/configurações)
 *   e AUDITOR fica restrito a ações de leitura (sufixo ":read").
 */
export async function requirePermission(action: string): Promise<AuthContext> {
  const session = await auth()
  if (!session?.user?.tenantId || !session.user.id) throw new Error('Tenant não encontrado')

  const tenantId = session.user.tenantId as string
  const userId = session.user.id as string

  // Papel sempre lido do banco — o JWT pode estar desatualizado após mudança de papel
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { role: true },
  })
  if (!user) throw new Error('Forbidden')

  const ctx: AuthContext = { tenantId, userId, role: user.role }

  if (user.role === 'SOVEREIGN' || user.role === 'ADMIN') return ctx

  const perm = await prisma.permission.findFirst({
    where: { tenantId, role: user.role, action },
    select: { id: true },
  })
  if (perm) return ctx

  const anyPermission = await prisma.permission.findFirst({
    where: { tenantId },
    select: { id: true },
  })
  if (!anyPermission) {
    // Tenant sem matriz de permissões configurada — comportamento legado
    if (user.role === 'OPERATOR' && action !== 'users:manage' && action !== 'settings:write') return ctx
    if (user.role === 'AUDITOR' && action.endsWith(':read')) return ctx
  }

  throw new Error('Forbidden: permissão insuficiente para esta operação')
}
