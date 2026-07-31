import prisma from "@/lib/prisma";
import { decifrar, CHAVE_TENANT } from "@/lib/crypto";

/**
 * Leitura do certificado digital ativo de um cliente, já decifrado.
 *
 * ESTE MÓDULO NÃO PODE SER 'use server'.
 *
 * Esta função vivia em actions/fiscal-credential.ts, que é um ficheiro
 * 'use server'. No Next.js, TODOS os exports de um ficheiro desses viram
 * endpoints HTTP públicos — não apenas os que a interface chama. Como recebe
 * o tenantId por parâmetro e devolve o certificado e a palavra-passe em
 * claro, qualquer utilizador autenticado podia pedir o certificado digital de
 * OUTRA empresa. Um certificado fiscal equivale à assinatura da empresa.
 *
 * Encontrado na auditoria de 2026-07-30. Um comentário a dizer "não é exposta
 * ao browser" não a tornava privada: o que a torna privada é não estar num
 * módulo de server actions.
 *
 * Chamadores legítimos: actions/sifen.ts, servidor para servidor.
 */
export async function getCertificadoAtivo(tenantId: string): Promise<
  { certificate: string; password: string; environment: string } | null
> {
  const c = await prisma.fiscalCredential.findFirst({
    where: { tenantId, isActive: true },
  });
  if (!c) return null;

  return {
    certificate: decifrar(
      { cipher: c.certificateCipher, iv: c.certificateIv, tag: c.certificateTag },
      CHAVE_TENANT
    ),
    password: decifrar({ cipher: c.passCipher, iv: c.passIv, tag: c.passTag }, CHAVE_TENANT),
    environment: c.environment,
  };
}
