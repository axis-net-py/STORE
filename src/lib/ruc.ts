/**
 * RUC paraguaio — validação do dígito verificador.
 *
 * O RUC tem a forma `NNNNNNNN-D`, onde D é um dígito verificador calculado
 * por módulo 11 sobre a base. Um RUC com erro de digitação é rejeitado pela
 * SET, e no pior caso aponta para OUTRO contribuinte — o documento sai com
 * a contraparte errada.
 *
 * Até esta auditoria (2026-07-30) não havia validação nenhuma: qualquer texto
 * era aceite como RUC, tanto no cadastro da empresa como no dos clientes.
 */

/** Reduz a algarismos, descartando pontos, espaços e o hífen. */
function apenasDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Dígito verificador de uma base de RUC, por módulo 11.
 *
 * Os algarismos são multiplicados da direita para a esquerda por 2, 3, 4, 5,
 * 6, 7 e depois recomeça em 2. O resto da soma por 11 dá o dígito: 0 quando o
 * resto é 0 ou 1, caso contrário 11 menos o resto.
 */
export function digitoVerificador(base: string): number | null {
  const digitos = apenasDigitos(base);
  if (digitos.length === 0) return null;

  let soma = 0;
  let multiplicador = 2;

  for (let i = digitos.length - 1; i >= 0; i--) {
    soma += Number(digitos[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = soma % 11;
  return resto > 1 ? 11 - resto : 0;
}

export type ResultadoRuc =
  | { valido: true; base: string; dv: number; formatado: string }
  | { valido: false; motivo: string };

/**
 * Valida um RUC completo.
 *
 * Aceita com ou sem hífen e com pontos de milhar — o que os utilizadores
 * escrevem na prática. Devolve a forma canónica para gravar.
 */
export function validarRuc(entrada: string | null | undefined): ResultadoRuc {
  if (!entrada || !entrada.trim()) {
    return { valido: false, motivo: "RUC não informado." };
  }

  const digitos = apenasDigitos(entrada);

  if (digitos.length < 2) {
    return { valido: false, motivo: "RUC curto demais." };
  }
  // A SET emite RUC até 8 algarismos de base, mais o verificador.
  if (digitos.length > 9) {
    return { valido: false, motivo: "RUC longo demais." };
  }

  const base = digitos.slice(0, -1);
  const dvInformado = Number(digitos.slice(-1));
  const dvEsperado = digitoVerificador(base);

  if (dvEsperado === null) {
    return { valido: false, motivo: "RUC inválido." };
  }
  if (dvInformado !== dvEsperado) {
    return {
      valido: false,
      motivo: `Dígito verificador do RUC não confere (esperado ${dvEsperado}). Confirme o número.`,
    };
  }

  return { valido: true, base, dv: dvEsperado, formatado: `${base}-${dvEsperado}` };
}

/** Forma canónica para gravar, ou null se não for válido. */
export function formatarRuc(entrada: string | null | undefined): string | null {
  const r = validarRuc(entrada);
  return r.valido ? r.formatado : null;
}
