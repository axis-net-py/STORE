/**
 * Aviso de expiração de certificado fiscal (spec Projeto 2, §6.5).
 *
 * Um certificado que expira em silêncio significa um cliente que não consegue
 * faturar — e a primeira coisa que ele vai pensar é que o sistema avariou.
 * O aviso automático transforma uma emergência num lembrete.
 *
 * Lógica pura, sem base de dados, para poder ser testada a sério.
 */

/** Marcos de aviso, do mais distante ao mais próximo. */
export const MARCOS = [30, 14, 7, 3, 1] as const;

export type Severidade = "ok" | "aviso" | "urgente" | "expirado" | "sem-certificado";

export type Estado = {
  severidade: Severidade;
  dias: number | null;
  /** Marco atingido, quando há um. Serve para não repetir o mesmo aviso. */
  marco: number | null;
};

/** Dias inteiros até à data, contados do início do dia — não de hora a hora. */
export function diasAte(validUntil: Date | null | undefined, agora = new Date()): number | null {
  if (!validUntil) return null;
  const dia = 86_400_000;
  const a = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate());
  const b = Date.UTC(validUntil.getUTCFullYear(), validUntil.getUTCMonth(), validUntil.getUTCDate());
  return Math.round((b - a) / dia);
}

/**
 * Classifica o estado de um certificado.
 *
 * Sem data de validade não há aviso possível: devolve "ok" em vez de fingir
 * que sabe. Quem não a preencheu fica sem rede, e isso é visível na página.
 */
export function estadoDoCertificado(
  validUntil: Date | null | undefined,
  temCertificado = true,
  agora = new Date()
): Estado {
  if (!temCertificado) return { severidade: "sem-certificado", dias: null, marco: null };

  const dias = diasAte(validUntil, agora);
  if (dias === null) return { severidade: "ok", dias: null, marco: null };

  if (dias < 0) return { severidade: "expirado", dias, marco: null };

  // O marco é o menor que ainda cobre os dias restantes.
  const marco = MARCOS.filter((m) => dias <= m).sort((a, b) => a - b)[0] ?? null;

  if (dias <= 7) return { severidade: "urgente", dias, marco };
  if (dias <= 30) return { severidade: "aviso", dias, marco };
  return { severidade: "ok", dias, marco: null };
}

/** Se este estado justifica escrever um novo aviso no registo. */
export function deveAvisar(e: Estado): boolean {
  return e.severidade === "expirado" || e.severidade === "sem-certificado" || e.marco !== null;
}

export function mensagem(e: Estado, nomeCliente: string): string {
  switch (e.severidade) {
    case "sem-certificado":
      return `${nomeCliente}: nenhum certificado digital ativo — não é possível emitir documentos eletrônicos.`;
    case "expirado":
      return `${nomeCliente}: certificado EXPIRADO há ${Math.abs(e.dias!)} dia(s). A emissão de documentos eletrônicos está bloqueada.`;
    case "urgente":
      return `${nomeCliente}: certificado expira em ${e.dias} dia(s). Renove com urgência.`;
    case "aviso":
      return `${nomeCliente}: certificado expira em ${e.dias} dia(s).`;
    default:
      return `${nomeCliente}: certificado válido.`;
  }
}
