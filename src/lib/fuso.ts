/**
 * A que dia pertence um documento fiscal.
 *
 * Módulo puro. Parece uma questão trivial e não é: o Paraguai está em UTC−3 o
 * ano inteiro, e o JavaScript trata a mesma string de duas maneiras conforme
 * quem a escreveu.
 *
 * O problema, encontrado na auditoria de 2026-07-30:
 *
 *   new Date('2026-08-01')   →  2026-08-01T00:00:00Z  →  31/07 às 21h em Assunção
 *
 * Um `<input type="date">` devolve exatamente isto. O utilizador escolheu
 * "1 de agosto"; se lermos a data no fuso do Paraguai, obtemos 31 de julho, e
 * com julho fechado a fatura era recusada. Era o defeito conhecido do
 * assertPeriodOpen.
 *
 * Mas ler tudo em UTC também está errado: às 22h de 31 de julho em Assunção,
 * `new Date()` dá 01/08 às 01h UTC, e um documento que fiscalmente é de julho
 * passaria a agosto.
 *
 * Nem UTC nem hora local estão certos isoladamente, porque as duas coisas que
 * chegam aqui são diferentes:
 *
 *   - uma DATA DE CALENDÁRIO, sem hora, escolhida por uma pessoa
 *   - um INSTANTE, com hora, produzido pelo relógio
 *
 * A distinção é observável: uma data de calendário aterra exatamente na
 * meia-noite UTC, porque foi assim que o JavaScript a interpretou. Um instante
 * real quase nunca cai nesse segundo. É essa a regra abaixo.
 *
 * Limite conhecido: um documento emitido exatamente às 21:00:00 de Assunção
 * cai na meia-noite UTC e é lido como sendo do dia seguinte. É uma janela de
 * um segundo por dia. A alternativa — normalizar todas as datas na gravação e
 * migrar o histórico — foi considerada e adiada; quando se fizer, esta função
 * é o único sítio a mudar.
 */

export const FUSO_PARAGUAI = "America/Asuncion";

export type ParteData = { ano: number; mes: number; dia: number };

/** Verdadeiro se o instante é exatamente meia-noite UTC. */
function ehDataDeCalendario(d: Date): boolean {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

/**
 * Ano, mês e dia a que o documento pertence fiscalmente.
 *
 * `mes` é 1–12, não 0–11: isto é uma data fiscal, não um índice de array.
 */
export function parteDataFiscal(entrada: Date | string): ParteData {
  const d = entrada instanceof Date ? entrada : new Date(entrada);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Data inválida.");
  }

  // Data de calendário: os componentes UTC são exatamente o que a pessoa
  // escolheu. Convertê-los recuaria um dia.
  if (ehDataDeCalendario(d)) {
    return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
  }

  // Instante real: o dia é o do relógio de Assunção.
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_PARAGUAI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

  const [ano, mes, dia] = partes.split("-").map(Number);
  return { ano, mes, dia };
}

/** AAAAMMDD — o formato das datas nos documentos da SET. */
export function dataFiscalAAAAMMDD(entrada: Date | string): string {
  const { ano, mes, dia } = parteDataFiscal(entrada);
  return `${ano}${String(mes).padStart(2, "0")}${String(dia).padStart(2, "0")}`;
}

/** AAAA-MM-DD, para mostrar e para gravar em campos de data. */
export function dataFiscalISO(entrada: Date | string): string {
  const { ano, mes, dia } = parteDataFiscal(entrada);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
