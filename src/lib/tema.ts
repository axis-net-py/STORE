/**
 * Cores do design system, por cliente.
 *
 * Módulo puro, sem dependências: é política de apresentação e tem de poder ser
 * testada sem base de dados nem React.
 *
 * Antes da unificação cada vertical era uma aplicação com a sua cor — o store
 * azul, o farm verde, o clinic offwhite. Ao juntar tudo numa só build, ficou a
 * paleta do store para toda a gente, e os outros dois perderam a identidade.
 * Aqui a cor volta a ser um atributo do cliente: por omissão a do seu vertical,
 * e alterável nas configurações para qualquer uma das quatro.
 */

export const ACENTOS = ["blue", "green", "red", "offwhite"] as const;

export type Acento = (typeof ACENTOS)[number];

/** Cor de origem de cada vertical, usada enquanto o cliente não escolher outra. */
const POR_VERTICAL: Record<string, Acento> = {
  store: "blue",
  farm: "green",
  clinic: "offwhite",
  food: "red",
};

export function acentoValido(valor: unknown): valor is Acento {
  return typeof valor === "string" && (ACENTOS as readonly string[]).includes(valor);
}

/**
 * Cor efetiva de um cliente.
 *
 * A escolha explícita ganha sempre. Sem ela, decide o primeiro módulo
 * contratado — que é o vertical do cliente. Um cliente com mais do que um
 * módulo herda a cor do primeiro; a partir daí escolhe.
 *
 * Nunca devolve nulo: um valor inválido guardado na base (migração a meio,
 * edição manual) não pode deixar a aplicação sem paleta.
 */
export function acentoDoCliente(
  escolhido: string | null | undefined,
  modulos: readonly string[] | null | undefined
): Acento {
  if (acentoValido(escolhido)) return escolhido;

  for (const m of modulos ?? []) {
    const cor = POR_VERTICAL[m];
    if (cor) return cor;
  }

  return "blue";
}
