'use server'

import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'
import { numeroTimbradoValido, diasAteExpirar, restantesNoTimbrado } from '@/lib/timbrado'
import { revalidatePath } from 'next/cache'

/**
 * Cadastro dos timbrados da empresa.
 *
 * O timbrado é a autorização da SET para emitir. Sem ele cadastrado, nenhuma
 * fatura eletrónica é emitida — e é assim de propósito: emitir com um timbrado
 * inventado ou expirado é uma irregularidade fiscal do cliente.
 *
 * Regras de validade e intervalo em lib/timbrado.ts, com testes.
 */

export type TimbradoFormData = {
  numero: string
  establishment?: string
  emissionPoint?: string
  validFrom: Date | string
  validTo?: Date | string | null
  rangeFrom?: number
  rangeTo: number
}

function validar(data: TimbradoFormData) {
  if (!numeroTimbradoValido(data.numero)) {
    throw new Error('O número do timbrado tem de ter exatamente 8 algarismos.')
  }

  const de = new Date(data.validFrom)
  if (Number.isNaN(de.getTime())) throw new Error('A data de início de validade é inválida.')

  const ate = data.validTo ? new Date(data.validTo) : null
  if (ate && Number.isNaN(ate.getTime())) throw new Error('A data de fim de validade é inválida.')
  if (ate && ate < de) {
    throw new Error('A data de fim de validade não pode ser anterior à de início.')
  }

  const rangeFrom = data.rangeFrom ?? 1
  if (!Number.isInteger(rangeFrom) || rangeFrom < 1) {
    throw new Error('O início do intervalo tem de ser um número inteiro maior que zero.')
  }
  if (!Number.isInteger(data.rangeTo) || data.rangeTo < rangeFrom) {
    throw new Error('O fim do intervalo tem de ser maior ou igual ao início.')
  }
  // Um documento tem 7 algarismos de sequencial (EEE-PPP-NNNNNNN).
  if (data.rangeTo > 9_999_999) {
    throw new Error('O fim do intervalo não pode passar de 9.999.999.')
  }

  return { de, ate, rangeFrom }
}

export async function getTimbrados() {
  const { tenantId } = await requirePermission('settings:read')

  const linhas = await prisma.timbrado.findMany({
    where: { tenantId },
    orderBy: [{ isActive: 'desc' }, { validTo: 'asc' }],
  })

  // O que interessa ao utilizador não é a linha crua, é quanto tempo e quantos
  // documentos lhe restam. Um timbrado esgotado a meio do dia para a faturação.
  return linhas.map((t) => ({
    ...t,
    diasAteExpirar: diasAteExpirar(t as any),
    restantes: restantesNoTimbrado(t as any, t.rangeFrom),
  }))
}

export async function createTimbrado(data: TimbradoFormData) {
  const { tenantId, userId } = await requirePermission('settings:write')
  const { de, ate, rangeFrom } = validar(data)

  const establishment = data.establishment?.trim() || '001'
  const emissionPoint = data.emissionPoint?.trim() || '001'

  const existente = await prisma.timbrado.findFirst({
    where: { tenantId, numero: data.numero.trim(), establishment, emissionPoint },
    select: { id: true },
  })
  if (existente) {
    throw new Error('Este timbrado já está cadastrado para este ponto de emissão.')
  }

  const timbrado = await prisma.timbrado.create({
    data: {
      tenantId,
      numero: data.numero.trim(),
      establishment,
      emissionPoint,
      validFrom: de,
      validTo: ate,
      rangeFrom,
      rangeTo: data.rangeTo,
    },
  })

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'CREATE_TIMBRADO',
      entity: 'Timbrado',
      entityId: timbrado.id,
      details: { numero: timbrado.numero, establishment, emissionPoint },
    },
  })

  revalidatePath(`/${tenantId}/settings/fiscal`)
  return { success: true, timbrado }
}

export async function setTimbradoAtivo(id: string, isActive: boolean) {
  const { tenantId, userId } = await requirePermission('settings:write')

  // updateMany com o tenantId no filtro: sem ele, o id de outra empresa
  // desativaria o timbrado dela e pararia a faturação de um cliente alheio.
  const r = await prisma.timbrado.updateMany({
    where: { id, tenantId },
    data: { isActive },
  })
  if (r.count === 0) throw new Error('Timbrado não encontrado.')

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: isActive ? 'ENABLE_TIMBRADO' : 'DISABLE_TIMBRADO',
      entity: 'Timbrado',
      entityId: id,
    },
  })

  revalidatePath(`/${tenantId}/settings/fiscal`)
  return { success: true }
}

export async function deleteTimbrado(id: string) {
  const { tenantId, userId } = await requirePermission('settings:write')

  const timbrado = await prisma.timbrado.findFirst({
    where: { id, tenantId },
    select: { id: true, numero: true },
  })
  if (!timbrado) throw new Error('Timbrado não encontrado.')

  // Um timbrado que já autorizou documentos não se apaga: os documentos
  // emitidos apontam para ele, e uma fiscalização vai querer ver a
  // autorização. Desativa-se.
  const emUso = await prisma.commercialInvoice.count({
    where: { tenantId, timbrado: timbrado.numero },
  })
  if (emUso > 0) {
    throw new Error(
      `Este timbrado já autorizou ${emUso} documento(s) e não pode ser excluído. ` +
        'Desative-o para deixar de o usar em novas emissões.'
    )
  }

  await prisma.timbrado.delete({ where: { id: timbrado.id } })

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'DELETE_TIMBRADO',
      entity: 'Timbrado',
      entityId: id,
      details: { numero: timbrado.numero },
    },
  })

  revalidatePath(`/${tenantId}/settings/fiscal`)
  return { success: true }
}
