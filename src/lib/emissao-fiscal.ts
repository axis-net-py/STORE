/**
 * O que um documento precisa de ter para ser fiscal.
 *
 * ESTE MÓDULO NÃO PODE SER 'use server' — recebe o tenantId por parâmetro e só
 * tem chamadores internos. Ver lib/server-actions-contrato.test.ts.
 *
 * Junta num sítio só as três coisas que faltavam à emissão (auditoria de
 * 2026-07-30):
 *
 *   - o timbrado que autoriza este número, nesta data (lib/timbrado.ts)
 *   - o código de segurança, 9 algarismos que têm de ser guardados
 *   - o CDC, calculado por nós e não devolvido pela SET (lib/cdc.ts)
 *
 * Falha em vez de emitir um documento incompleto. Um documento sem timbrado
 * válido ou sem CDC não é um documento fiscal, e emiti-lo assim transfere o
 * problema para o cliente no dia da fiscalização.
 */

import { gerarCDC, gerarCodigoSeguranca, TIPO_DE, type TipoContribuinte } from "@/lib/cdc";
import { escolherTimbrado, type Timbrado } from "@/lib/timbrado";
import { extrairSequencial } from "@/lib/numeracao-fiscal";
import { validarRuc } from "@/lib/ruc";

export type DadosEmissao = {
  timbrado: string;
  codigoSeguranca: string;
  cdc: string;
};

export class EmissaoFiscalInvalida extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "EmissaoFiscalInvalida";
  }
}

/**
 * @param db  prisma ou a transação em curso — tem de ser a MESMA transação da
 *            criação da fatura, senão um timbrado desativado a meio da emissão
 *            passaria despercebido.
 */
export async function prepararEmissaoFiscal(
  db: any,
  tenantId: string,
  numeroDocumento: string,
  dataEmissao: Date
): Promise<DadosEmissao> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      ruc: true,
      establishment: true,
      emissionPoint: true,
      taxpayerType: true,
    },
  });

  if (!tenant) throw new EmissaoFiscalInvalida("Empresa não encontrada.");

  const ruc = validarRuc(tenant.ruc);
  if (!ruc.valido) {
    throw new EmissaoFiscalInvalida(
      `O RUC da empresa não é válido (${ruc.motivo}). ` +
        "Corrija-o em Configurações › Fiscal antes de emitir documentos eletrônicos."
    );
  }

  // O estabelecimento e o ponto de emissão vêm do NÚMERO do documento, não do
  // cadastro: é o número que já foi atribuído que manda, e tem de ser o mesmo
  // que vai no CDC.
  const partes = numeroDocumento.split("-");
  const establishment = partes[0] ?? tenant.establishment ?? "001";
  const emissionPoint = partes[1] ?? tenant.emissionPoint ?? "001";

  const sequencial = extrairSequencial(numeroDocumento);
  if (sequencial === null) {
    throw new EmissaoFiscalInvalida(
      `O número ${numeroDocumento} não está no formato EEE-PPP-NNNNNNN.`
    );
  }

  const timbrados: Timbrado[] = await db.timbrado.findMany({
    where: { tenantId, isActive: true },
  });

  const escolha = escolherTimbrado(
    timbrados,
    establishment,
    emissionPoint,
    dataEmissao,
    sequencial
  );
  if ("erro" in escolha) throw new EmissaoFiscalInvalida(escolha.erro);

  const codigoSeguranca = gerarCodigoSeguranca();

  const cdc = gerarCDC({
    tipoDocumento: TIPO_DE.FACTURA,
    rucEmissor: ruc.base,
    dvRucEmissor: ruc.dv,
    establecimiento: establishment,
    puntoExpedicion: emissionPoint,
    numeroDocumento: String(sequencial),
    tipoContribuinte: (tenant.taxpayerType === "1" ? "1" : "2") as TipoContribuinte,
    dataEmissao,
    tipoEmissao: "1",
    codigoSeguranca,
  });

  return { timbrado: escolha.timbrado.numero, codigoSeguranca, cdc };
}
