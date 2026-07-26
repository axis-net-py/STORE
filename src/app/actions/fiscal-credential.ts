'use server'

import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'
import { cifrar, decifrar, CHAVE_TENANT } from '@/lib/crypto'
import { revalidatePath } from 'next/cache'

/**
 * Certificado digital fiscal (SIFEN) por cliente.
 *
 * Substitui as variáveis de ambiente globais SIFEN_CERTIFICATE e
 * SIFEN_CERTIFICATE_PASS, que serviam um só certificado para toda a
 * instalação — impossível de vender a mais do que um cliente.
 *
 * O ficheiro chega por HTTPS, é cifrado em memória e escrito já cifrado.
 * Nunca vai para disco, nunca aparece em logs. O fornecedor do sistema não
 * chega a manipular o certificado do cliente (spec Projeto 2, §6.4) — um
 * certificado digital fiscal equivale à assinatura da empresa.
 */

export type CredencialResumo = {
  id: string
  fileName: string | null
  validFrom: Date | null
  validUntil: Date | null
  environment: string
  isActive: boolean
  createdAt: Date
  /** Dias até expirar; negativo se já expirou. Null se não tiver data. */
  diasParaExpirar: number | null
}

function diasAte(d: Date | null): number | null {
  if (!d) return null
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000)
}

/** Lista as credenciais do cliente. NUNCA devolve o certificado nem a senha. */
export async function getFiscalCredentials(): Promise<CredencialResumo[]> {
  const { tenantId } = await requirePermission('settings:read')

  const linhas = await prisma.fiscalCredential.findMany({
    where: { tenantId },
    // Seleção explícita: sem isto, um `include` distraído devolveria o
    // certificado cifrado ao browser sem ninguém dar por isso.
    select: {
      id: true, fileName: true, validFrom: true, validUntil: true,
      environment: true, isActive: true, createdAt: true,
    },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  })

  return linhas.map((l) => ({ ...l, diasParaExpirar: diasAte(l.validUntil) }))
}

export type NovaCredencial = {
  /** Conteúdo do .p12 em base64. */
  certificateBase64: string
  password: string
  fileName?: string
  validFrom?: Date | string | null
  validUntil?: Date | string | null
  environment?: 'test' | 'prod'
  /** Ativar já, desativando a anterior. */
  ativar?: boolean
}

export async function uploadFiscalCredential(data: NovaCredencial) {
  const { tenantId, userId } = await requirePermission('settings:write')

  if (!data.certificateBase64?.trim()) throw new Error('Certificado em falta.')
  if (!data.password) throw new Error('A senha do certificado é obrigatória.')

  const cert = cifrar(data.certificateBase64, CHAVE_TENANT)
  const senha = cifrar(data.password, CHAVE_TENANT)

  const criada = await prisma.$transaction(async (tx) => {
    // Um só certificado ativo de cada vez: dois ativos tornariam indeterminado
    // qual assina os documentos.
    if (data.ativar) {
      await tx.fiscalCredential.updateMany({
        where: { tenantId, isActive: true },
        data: { isActive: false },
      })
    }

    return tx.fiscalCredential.create({
      data: {
        tenantId,
        certificateCipher: cert.cipher,
        certificateIv: cert.iv,
        certificateTag: cert.tag,
        passCipher: senha.cipher,
        passIv: senha.iv,
        passTag: senha.tag,
        fileName: data.fileName ?? null,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        environment: data.environment ?? 'test',
        isActive: !!data.ativar,
      },
      select: { id: true },
    })
  })

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'UPLOAD_FISCAL_CREDENTIAL',
      entity: 'FiscalCredential',
      entityId: criada.id,
      // Sem conteúdo nem senha: a auditoria regista o ato, não o segredo.
      details: {
        fileName: data.fileName ?? null,
        environment: data.environment ?? 'test',
        validUntil: data.validUntil ? String(data.validUntil) : null,
        ativada: !!data.ativar,
      },
    },
  })

  revalidatePath(`/${tenantId}/settings/fiscal`)
  return { id: criada.id }
}

export async function activateFiscalCredential(id: string) {
  const { tenantId, userId } = await requirePermission('settings:write')

  await prisma.$transaction(async (tx) => {
    const existe = await tx.fiscalCredential.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existe) throw new Error('Certificado não encontrado.')

    await tx.fiscalCredential.updateMany({ where: { tenantId, isActive: true }, data: { isActive: false } })
    await tx.fiscalCredential.update({ where: { id }, data: { isActive: true } })
  })

  await prisma.auditLog.create({
    data: { tenantId, userId, action: 'ACTIVATE_FISCAL_CREDENTIAL', entity: 'FiscalCredential', entityId: id },
  })

  revalidatePath(`/${tenantId}/settings/fiscal`)
}

export async function deleteFiscalCredential(id: string) {
  const { tenantId, userId } = await requirePermission('settings:write')

  const r = await prisma.fiscalCredential.deleteMany({ where: { id, tenantId } })
  if (r.count === 0) throw new Error('Certificado não encontrado.')

  await prisma.auditLog.create({
    data: { tenantId, userId, action: 'DELETE_FISCAL_CREDENTIAL', entity: 'FiscalCredential', entityId: id },
  })

  revalidatePath(`/${tenantId}/settings/fiscal`)
}

/**
 * Devolve o certificado ativo, decifrado, para uso da integração SIFEN.
 *
 * NÃO é uma server action exposta ao browser: é chamada de servidor para
 * servidor, a partir de actions/sifen.ts. Devolver isto ao cliente entregaria
 * a assinatura digital da empresa a quem abrisse as ferramentas do navegador.
 */
export async function getCertificadoAtivo(tenantId: string): Promise<
  { certificate: string; password: string; environment: string } | null
> {
  const c = await prisma.fiscalCredential.findFirst({
    where: { tenantId, isActive: true },
  })
  if (!c) return null

  return {
    certificate: decifrar(
      { cipher: c.certificateCipher, iv: c.certificateIv, tag: c.certificateTag },
      CHAVE_TENANT
    ),
    password: decifrar({ cipher: c.passCipher, iv: c.passIv, tag: c.passTag }, CHAVE_TENANT),
    environment: c.environment,
  }
}
