import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { acaoBloqueadaPorModulo } from '@/modules/registry'

export type AuthContext = {
  tenantId: string
  userId: string
  role: string
}

/**
 * Autorização central para server actions.
 *
 * Regras:
 * - SOVEREIGN: acesso total, por definição. É o dono da conta.
 * - Todos os outros papéis, INCLUINDO ADMIN: precisam de uma linha em
 *   Permission (action + role + tenant).
 * - Compatibilidade: se o tenant nunca cadastrou permissões (tabela vazia),
 *   OPERATOR mantém acesso operacional (exceto gestão de usuários/configurações)
 *   e AUDITOR fica restrito a ações de leitura (sufixo ":read").
 *
 * O ADMIN deixou de ter passe livre (auditoria de 2026-07-30). Antes, esta
 * função devolvia acesso total a ADMIN antes sequer de olhar para a matriz —
 * o que tornava a matriz uma declaração sem efeito para esse papel. A política
 * escrita diz que o ADMIN não apaga registos nem gere utilizadores, e o
 * actions/team.ts já a aplicava com uma verificação própria. Agora é a mesma
 * regra em todo o lado.
 */
export async function requirePermission(action: string): Promise<AuthContext> {
  const session = await auth()
  if (!session?.user?.tenantId || !session.user.id) throw new Error('Tenant não encontrado')

  const tenantId = session.user.tenantId as string
  const userId = session.user.id as string

  // Papel sempre lido do banco — o JWT pode estar desatualizado após mudança de
  // papel. Os módulos contratados vêm na mesma consulta, sem ida extra ao banco.
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { role: true, tenant: { select: { modules: true } } },
  })
  if (!user) throw new Error('Forbidden')

  // Módulo não contratado fecha a ação para TODA a gente, SOVEREIGN incluído:
  // isto não é uma questão de papel, é de o módulo não existir para este
  // cliente. O guarda de rotas (modules/guard.ts) fechava o URL, mas as server
  // actions do módulo continuavam chamáveis por HTTP.
  if (acaoBloqueadaPorModulo(action, user.tenant?.modules ?? [])) {
    throw new Error('Forbidden: módulo não contratado')
  }

  const ctx: AuthContext = { tenantId, userId, role: user.role }

  // Só o SOVEREIGN passa sem consultar a matriz.
  if (user.role === 'SOVEREIGN') return ctx

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
    // Tenant sem matriz de permissões configurada — comportamento legado.
    // O ADMIN entra aqui desde que deixou de ter passe livre: sem esta linha,
    // um cliente antigo sem matriz ficaria com o administrador trancado.
    if (user.role === 'ADMIN' && !action.endsWith(':delete') && action !== 'users:manage') return ctx
    if (user.role === 'OPERATOR' && action !== 'users:manage' && action !== 'settings:write') return ctx
    if (user.role === 'AUDITOR' && action.endsWith(':read')) return ctx
  }

  throw new Error('Forbidden: permissão insuficiente para esta operação')
}
