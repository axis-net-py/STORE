/**
 * Timbrado — a autorização da SET para emitir documentos.
 *
 * Módulo puro, sem dependências.
 *
 * O timbrado não é um número solto: é uma autorização com prazo e com um
 * intervalo de numeração. A SET exige que, na data de emissão, o timbrado
 * esteja dentro da validade e o número do documento dentro do intervalo
 * autorizado.
 *
 * Até à auditoria de 2026-07-30 o timbrado era uma coluna de texto livre no
 * documento — sem validade, sem intervalo, sem verificação nenhuma. O sistema
 * emitia alegremente com um timbrado expirado ou fora do intervalo, e quem
 * responde perante a SET é o cliente, não nós.
 */

import { parteDataFiscal } from "./fuso.ts";

export type Timbrado = {
  numero: string;
  establishment: string;
  emissionPoint: string;
  validFrom: Date;
  /** Nulo = sem data de fim declarada. */
  validTo: Date | null;
  rangeFrom: number;
  rangeTo: number;
  isActive: boolean;
};

export type ResultadoTimbrado = { ok: true } | { ok: false; motivo: string };

/** Número do timbrado: 8 algarismos. */
export function numeroTimbradoValido(numero: string | null | undefined): boolean {
  return /^\d{8}$/.test((numero ?? "").trim());
}

/** Compara duas datas apenas pelo dia fiscal, ignorando a hora. */
function diaFiscal(d: Date): number {
  const { ano, mes, dia } = parteDataFiscal(d);
  return ano * 10000 + mes * 100 + dia;
}

function formatarDia(d: Date): string {
  const { ano, mes, dia } = parteDataFiscal(d);
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
}

/**
 * O timbrado autoriza este documento, nesta data, com este número?
 *
 * Devolve o motivo em vez de um booleano: a mensagem tem de dizer ao
 * utilizador o que fazer, e "timbrado inválido" não diz nada.
 */
export function timbradoAutoriza(
  timbrado: Timbrado,
  dataEmissao: Date,
  sequencial: number
): ResultadoTimbrado {
  if (!timbrado.isActive) {
    return { ok: false, motivo: `O timbrado ${timbrado.numero} está desativado.` };
  }

  if (!numeroTimbradoValido(timbrado.numero)) {
    return { ok: false, motivo: "O número do timbrado tem de ter 8 algarismos." };
  }

  const dia = diaFiscal(dataEmissao);

  if (dia < diaFiscal(timbrado.validFrom)) {
    return {
      ok: false,
      motivo:
        `O timbrado ${timbrado.numero} só é válido a partir de ` +
        `${formatarDia(timbrado.validFrom)}. Não é possível emitir com data anterior.`,
    };
  }

  if (timbrado.validTo && dia > diaFiscal(timbrado.validTo)) {
    return {
      ok: false,
      motivo:
        `O timbrado ${timbrado.numero} expirou em ${formatarDia(timbrado.validTo)}. ` +
        "Solicite um novo timbrado à SET e cadastre-o em Configurações › Fiscal.",
    };
  }

  if (!Number.isInteger(sequencial) || sequencial < 1) {
    return { ok: false, motivo: "O número do documento é inválido." };
  }

  if (sequencial < timbrado.rangeFrom || sequencial > timbrado.rangeTo) {
    return {
      ok: false,
      motivo:
        `O número ${sequencial} está fora do intervalo autorizado pelo timbrado ` +
        `${timbrado.numero} (${timbrado.rangeFrom} a ${timbrado.rangeTo}). ` +
        "Solicite um novo timbrado à SET.",
    };
  }

  return { ok: true };
}

/**
 * Quantos documentos faltam para esgotar o intervalo.
 *
 * Serve para avisar antes de acabar: um timbrado esgotado a meio do dia para
 * a faturação da empresa, e obter outro junto da SET não é imediato.
 */
export function restantesNoTimbrado(timbrado: Timbrado, proximoSequencial: number): number {
  return Math.max(0, timbrado.rangeTo - proximoSequencial + 1);
}

/** Dias até expirar. Negativo se já expirou, null se não tem data de fim. */
export function diasAteExpirar(timbrado: Timbrado, hoje: Date = new Date()): number | null {
  if (!timbrado.validTo) return null;
  const umDia = 86_400_000;
  const a = Date.UTC(
    parteDataFiscal(hoje).ano,
    parteDataFiscal(hoje).mes - 1,
    parteDataFiscal(hoje).dia
  );
  const b = Date.UTC(
    parteDataFiscal(timbrado.validTo).ano,
    parteDataFiscal(timbrado.validTo).mes - 1,
    parteDataFiscal(timbrado.validTo).dia
  );
  return Math.round((b - a) / umDia);
}

/**
 * Escolhe o timbrado a usar para um ponto de emissão.
 *
 * Havendo mais do que um válido, usa o que expira primeiro — assim os
 * timbrados gastam-se por ordem de validade em vez de deixar um a caducar
 * por usar.
 */
export function escolherTimbrado(
  timbrados: Timbrado[],
  establishment: string,
  emissionPoint: string,
  dataEmissao: Date,
  sequencial: number
): { timbrado: Timbrado } | { erro: string } {
  const doPonto = timbrados.filter(
    (t) => t.establishment === establishment && t.emissionPoint === emissionPoint
  );

  if (doPonto.length === 0) {
    return {
      erro:
        `Não há timbrado cadastrado para o estabelecimento ${establishment}, ` +
        `ponto de emissão ${emissionPoint}. Cadastre-o em Configurações › Fiscal.`,
    };
  }

  const validos = doPonto.filter((t) => timbradoAutoriza(t, dataEmissao, sequencial).ok);

  if (validos.length === 0) {
    // Devolve o motivo do primeiro, que é o mais informativo que temos.
    const r = timbradoAutoriza(doPonto[0], dataEmissao, sequencial);
    return { erro: r.ok ? "Nenhum timbrado válido." : r.motivo };
  }

  validos.sort((a, b) => {
    const fa = a.validTo ? diaFiscal(a.validTo) : Number.MAX_SAFE_INTEGER;
    const fb = b.validTo ? diaFiscal(b.validTo) : Number.MAX_SAFE_INTEGER;
    return fa - fb;
  });

  return { timbrado: validos[0] };
}
