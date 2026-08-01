import { dataFiscalAAAAMMDD } from "./fuso.ts";

/**
 * CDC — Código de Control do documento eletrónico paraguaio.
 *
 * Módulo puro e sem dependências: é a identidade fiscal do documento e tem de
 * poder ser testado sem base de dados nem rede.
 *
 * O CDC é calculado PELO EMISSOR e vai dentro do próprio documento, no atributo
 * `Id` do elemento `DE`. Não é devolvido pela SET. Até à auditoria de
 * 2026-07-30 não existia em lado nenhum do código: o que havia era o cliente a
 * procurar `/(\d{44})/` na resposta da SET — o que não é gerar um CDC, é
 * procurar um número na resposta.
 *
 * Composição, 44 algarismos:
 *
 *   ┌────┬──────────┬───┬─────┬─────┬─────────┬───┬──────────┬───┬───────────┬───┐
 *   │ 2  │    8     │ 1 │  3  │  3  │    7    │ 1 │    8     │ 1 │     9     │ 1 │
 *   ├────┼──────────┼───┼─────┼─────┼─────────┼───┼──────────┼───┼───────────┼───┤
 *   │tipo│RUC emissor│DV │estab│ponto│  número │tipo│ AAAAMMDD│tipo│ código de │DV │
 *   │ DE │ (sem DV) │RUC│     │emis.│documento│cont│  emissão │emis│ segurança │CDC│
 *   └────┴──────────┴───┴─────┴─────┴─────────┴───┴──────────┴───┴───────────┴───┘
 *
 * O código de segurança são 9 algarismos aleatórios escolhidos pelo emissor.
 * Tem de ser GUARDADO: entra no CDC e no QR do documento, e sem ele o CDC não
 * se consegue recalcular nem conferir.
 *
 * HOMOLOGAÇÃO PENDENTE: o algoritmo está implementado a partir da
 * especificação do Manual Técnico da SET, mas não foi confrontado com o
 * ambiente de teste da SET. Antes de emitir para um cliente real, gerar um
 * documento no ambiente de homologação e confirmar que o CDC é aceite.
 */

/** Tipos de documento eletrónico (iTiDE). */
export const TIPO_DE = {
  FACTURA: "01",
  NOTA_CREDITO: "05",
  NOTA_DEBITO: "06",
  REMISION: "07",
} as const;

export type TipoDE = (typeof TIPO_DE)[keyof typeof TIPO_DE];

/** 1 = pessoa física, 2 = pessoa jurídica. */
export type TipoContribuinte = "1" | "2";

/** 1 = normal, 2 = contingência. */
export type TipoEmissao = "1" | "2";

export type DadosCDC = {
  tipoDocumento: TipoDE;
  /** RUC do emissor, sem o dígito verificador. */
  rucEmissor: string;
  /** Dígito verificador do RUC do emissor. */
  dvRucEmissor: number | string;
  establecimiento: string;
  puntoExpedicion: string;
  numeroDocumento: string;
  tipoContribuinte: TipoContribuinte;
  dataEmissao: Date;
  tipoEmissao: TipoEmissao;
  /** 9 algarismos. Ver gerarCodigoSeguranca. */
  codigoSeguranca: string;
};

export class CDCInvalido extends Error {
  constructor(motivo: string) {
    super(`Não é possível calcular o CDC: ${motivo}`);
    this.name = "CDCInvalido";
  }
}

function apenasDigitos(s: string): string {
  return String(s ?? "").replace(/\D/g, "");
}

/** Preenche com zeros à esquerda; corta pela direita se vier maior. */
function pad(valor: string, tamanho: number): string {
  const d = apenasDigitos(valor);
  return d.length >= tamanho ? d.slice(-tamanho) : d.padStart(tamanho, "0");
}

/**
 * Dígito verificador do CDC, por módulo 11.
 *
 * ATENÇÃO: os multiplicadores vão de 2 a 9 e recomeçam, ao contrário do RUC
 * (src/lib/ruc.ts), onde vão de 2 a 7. São dois algoritmos parecidos e
 * distintos; usar um no lugar do outro produz um CDC que a SET rejeita.
 */
export function digitoVerificadorCDC(base43: string): number {
  const digitos = apenasDigitos(base43);
  let soma = 0;
  let multiplicador = 2;

  for (let i = digitos.length - 1; i >= 0; i--) {
    soma += Number(digitos[i]) * multiplicador;
    multiplicador = multiplicador === 9 ? 2 : multiplicador + 1;
  }

  const resto = soma % 11;
  return resto > 1 ? 11 - resto : 0;
}

/**
 * Código de segurança: 9 algarismos aleatórios.
 *
 * Aleatório de verdade (crypto), não Math.random: é um valor que entra na
 * identidade do documento fiscal, e um gerador previsível permitiria a
 * terceiros antecipar o CDC de documentos ainda por emitir.
 */
export function gerarCodigoSeguranca(): string {
  const bytes = new Uint8Array(9);
  globalThis.crypto.getRandomValues(bytes);
  // Um algarismo por byte, com rejeição do resto para não enviesar os dígitos
  // baixos (256 não é múltiplo de 10).
  let saida = "";
  let i = 0;
  while (saida.length < 9) {
    if (i >= bytes.length) {
      globalThis.crypto.getRandomValues(bytes);
      i = 0;
    }
    const b = bytes[i++];
    if (b < 250) saida += String(b % 10);
  }
  return saida;
}

/** Calcula o CDC completo, 44 algarismos. */
export function gerarCDC(dados: DadosCDC): string {
  const ruc = apenasDigitos(dados.rucEmissor);
  if (ruc.length === 0) throw new CDCInvalido("a empresa não tem RUC cadastrado");
  if (ruc.length > 8) throw new CDCInvalido("o RUC da empresa tem mais de 8 algarismos");

  const numero = apenasDigitos(dados.numeroDocumento);
  if (numero.length === 0) throw new CDCInvalido("o documento não tem número");
  if (numero.length > 7) throw new CDCInvalido("o número do documento excede 7 algarismos");

  const codigo = apenasDigitos(dados.codigoSeguranca);
  if (codigo.length !== 9) {
    throw new CDCInvalido("o código de segurança tem de ter exatamente 9 algarismos");
  }

  if (Number.isNaN(dados.dataEmissao.getTime())) {
    throw new CDCInvalido("a data de emissão é inválida");
  }

  const base =
    dados.tipoDocumento +
    pad(ruc, 8) +
    pad(String(dados.dvRucEmissor), 1) +
    pad(dados.establecimiento, 3) +
    pad(dados.puntoExpedicion, 3) +
    pad(numero, 7) +
    dados.tipoContribuinte +
    dataFiscalAAAAMMDD(dados.dataEmissao) +
    dados.tipoEmissao +
    codigo;

  if (base.length !== 43) {
    throw new CDCInvalido(`a base do CDC ficou com ${base.length} algarismos em vez de 43`);
  }

  return base + String(digitoVerificadorCDC(base));
}

/** Confere um CDC recebido: 44 algarismos e dígito verificador certo. */
export function cdcValido(cdc: string | null | undefined): boolean {
  const d = apenasDigitos(cdc ?? "");
  if (d.length !== 44) return false;
  return digitoVerificadorCDC(d.slice(0, 43)) === Number(d[43]);
}

/** Parte o CDC nos seus campos, para o mostrar e para conferir. */
export function lerCDC(cdc: string): {
  tipoDocumento: string;
  rucEmissor: string;
  dvRucEmissor: string;
  establecimiento: string;
  puntoExpedicion: string;
  numeroDocumento: string;
  tipoContribuinte: string;
  dataEmissao: string;
  tipoEmissao: string;
  codigoSeguranca: string;
  dv: string;
} {
  const d = apenasDigitos(cdc);
  if (d.length !== 44) throw new CDCInvalido("o CDC não tem 44 algarismos");

  return {
    tipoDocumento: d.slice(0, 2),
    rucEmissor: d.slice(2, 10),
    dvRucEmissor: d.slice(10, 11),
    establecimiento: d.slice(11, 14),
    puntoExpedicion: d.slice(14, 17),
    numeroDocumento: d.slice(17, 24),
    tipoContribuinte: d.slice(24, 25),
    dataEmissao: d.slice(25, 33),
    tipoEmissao: d.slice(33, 34),
    codigoSeguranca: d.slice(34, 43),
    dv: d.slice(43, 44),
  };
}
