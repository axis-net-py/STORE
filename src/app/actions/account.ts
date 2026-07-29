'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { compare, hash } from 'bcryptjs'
import { PasswordSchema } from '@/lib/schemas'

export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.tenantId) throw new Error('Não autenticado')
  const userId = session.user.id as string
  const tenantId = session.user.tenantId as string

  const parsed = PasswordSchema.safeParse(newPassword)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { password: true },
  })
  if (!user) throw new Error('Usuário não encontrado')

  // Utilizador recém-provisionado ainda não definiu password: não há "senha
  // atual" para confirmar, e este não é o caminho certo. Ele usa o link de
  // configuração de uso único (spec Projeto 2, §5.3).
  if (!user.password) {
    throw new Error(
      'Esta conta ainda não tem senha definida. Use o link de configuração que recebeu para criar a sua.'
    )
  }

  const valid = await compare(currentPassword, user.password)
  if (!valid) throw new Error('Senha atual incorreta')

  if (currentPassword === newPassword) {
    throw new Error('A nova senha deve ser diferente da atual')
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: await hash(newPassword, 10),
      mustChangePassword: false,
    },
  })

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'CHANGE_PASSWORD',
      entity: 'User',
      entityId: userId,
    },
  })

  return { success: true, tenantId }
}

// Indica se o usuário logado precisa trocar a senha (primeiro acesso)
export async function getMustChangePassword(): Promise<boolean> {
  const session = await auth()
  if (!session?.user?.id) return false
  const user = await prisma.user.findUnique({
    where: { id: session.user.id as string },
    select: { mustChangePassword: true },
  })
  return !!user?.mustChangePassword
}
