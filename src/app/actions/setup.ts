'use server'

import { hash } from 'bcryptjs'
import prisma from '@/lib/prisma'
import { hashToken, validarToken } from '@/lib/provisioning'
import { PasswordSchema } from '@/lib/schemas'

/**
 * Definição da primeira password, através do link de uso único.
 *
 * Ao contrário de tudo o resto neste sistema, esta ação NÃO exige sessão: é
 * usada por quem ainda não consegue entrar. A autorização é o próprio token,
 * e por isso ele é de uso único, expira, e só existe em hash na base de dados.
 */

export async function verificarLinkSetup(token: string) {
  const r = await validarToken(token)
  if (!r.ok) return { ok: false as const, motivo: r.motivo }

  const user = await prisma.user.findUnique({
    where: { id: r.userId },
    select: { email: true, name: true, tenant: { select: { name: true } } },
  })
  if (!user) return { ok: false as const, motivo: 'Link inválido.' }

  return {
    ok: true as const,
    email: user.email,
    nome: user.name,
    empresa: user.tenant?.name ?? '',
  }
}

export async function definirPrimeiraSenha(token: string, senha: string) {
  const parsed = PasswordSchema.safeParse(senha)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  const r = await validarToken(token)
  if (!r.ok) throw new Error(r.motivo)

  const senhaHash = await hash(senha, 10)

  await prisma.$transaction(async (tx) => {
    // Marcar o token como usado ANTES de qualquer outra coisa, e só quando
    // ainda está por usar. Duas submissões em paralelo — dois cliques — não
    // podem ambas passar: a segunda encontra usedAt já preenchido.
    const consumido = await tx.passwordSetupToken.updateMany({
      where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    })
    if (consumido.count === 0) throw new Error('Este link já foi utilizado.')

    const user = await tx.user.update({
      where: { id: r.userId },
      data: { password: senhaHash, mustChangePassword: false },
      select: { tenantId: true, email: true },
    })

    await tx.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: r.userId,
        action: 'SETUP_PASSWORD',
        entity: 'User',
        entityId: r.userId,
        // Sem a password nem o token: regista-se o ato, nunca o segredo.
        details: { email: user.email },
      },
    })
  })

  return { ok: true }
}
