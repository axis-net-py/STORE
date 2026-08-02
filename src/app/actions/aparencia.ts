'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/authz'
import { acentoDoCliente, acentoValido, type Acento } from '@/lib/tema'

/**
 * Cor do design system do cliente.
 *
 * Exige `settings:write` — a mesma permissão de quem mexe nos dados da
 * empresa. Não é uma preferência de quem está a ver: é a identidade visual do
 * cliente, e muda para toda a equipa.
 */

export async function getAcento(): Promise<Acento> {
  const { tenantId } = await requirePermission('settings:read')

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { themeColor: true, modules: true },
  })

  return acentoDoCliente(tenant?.themeColor, tenant?.modules)
}

export async function setAcento(cor: string): Promise<{ ok: true; acento: Acento }> {
  const { tenantId } = await requirePermission('settings:write')

  // Validado no servidor e não só no formulário: uma server action é um
  // endereço HTTP como outro qualquer, e um valor inventado aqui escreveria
  // uma cor que nenhuma paleta define — o painel ficaria sem tema.
  if (!acentoValido(cor)) {
    throw new Error('Cor inválida.')
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { themeColor: cor },
  })

  // O acento é decidido no layout do painel, que é servido do cache. Sem isto
  // a cor só mudava no recarregamento seguinte.
  revalidatePath('/', 'layout')

  return { ok: true, acento: cor }
}
