'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { compare, hash } from 'bcryptjs'
import { z } from 'zod'

const PasswordSchema = z
  .string()
  .min(8, 'A nova senha deve ter no mínimo 8 caracteres')
  .regex(/[a-zA-Z]/, 'A nova senha deve conter letras')
  .regex(/[0-9]/, 'A nova senha deve conter números')

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
