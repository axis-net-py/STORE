/**
 * Numeração de documentos fiscais no formato da SET paraguaia.
 *
 * Formato: EEE-PPP-NNNNNNN
 *   EEE      estabelecimento (3 dígitos)
 *   PPP      ponto de emissão (3 dígitos)
 *   NNNNNNN  sequencial (7 dígitos, com zeros à esquerda)
 *
 * Lógica pura, separada das consultas à base, para poder ser testada sem
 * Postgres — é uma regra fiscal e merece testes próprios.
 */

export const SEQUENCIAL_MAXIMO = 9_999_999;

export function prefixoFiscal(establishment?: string | null, emissionPoint?: string | null): string {
  const est = (establishment || "001").trim().padStart(3, "0");
  const pto = (emissionPoint || "001").trim().padStart(3, "0");
  return `${est}-${pto}-`;
}

export function formatarNumero(prefixo: string, sequencial: number): string {
  return `${prefixo}${String(sequencial).padStart(7, "0")}`;
}

/** Formato aceite pela SET. Rejeita tudo o resto, incluindo espaços. */
export function numeroValido(numero: string): boolean {
  return /^\d{3}-\d{3}-\d{7}$/.test(numero);
}

export function extrairSequencial(numero: string): number | null {
  if (!numeroValido(numero)) return null;
  return parseInt(numero.split("-")[2], 10);
}

/**
 * Próximo número a partir do último emitido.
 *
 * Se o último não existir ou estiver corrompido, recomeça em 1 — mas com o
 * prefixo correto do cliente, nunca com um fixo.
 */
export function proximoNumero(prefixo: string, ultimo?: string | null): string {
  if (!ultimo) return formatarNumero(prefixo, 1);

  const seq = extrairSequencial(ultimo);
  if (seq === null) return formatarNumero(prefixo, 1);

  const proximo = seq + 1;
  if (proximo > SEQUENCIAL_MAXIMO) {
    throw new Error(
      `Sequência esgotada em ${prefixo}: o número ${SEQUENCIAL_MAXIMO} é o último ` +
        `deste ponto de emissão. Solicite um novo timbrado à SET.`
    );
  }
  return formatarNumero(prefixo, proximo);
}
