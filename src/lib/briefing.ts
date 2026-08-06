/**
 * O que merece atenção hoje.
 *
 * Módulo puro: recebe os números já apurados na base e decide o que é alerta,
 * com que gravidade e por que ordem aparece. Sem prisma e sem rede, para poder
 * ser testado — a regra de "isto é urgente" é decisão de negócio e merece
 * testes, não uma leitura à sorte.
 *
 * A divisão importa: **os factos vêm da base, o modelo só os redige.** Um
 * modelo a inventar que há três faturas vencidas quando há uma é pior do que
 * não ter briefing nenhum — e num ERP, onde a seguir alguém vai ligar ao
 * cliente, é pior ainda. Por isso o número, a data e o nome nunca passam pelo
 * modelo para serem calculados; só para serem ditos por palavras.
 */

export type Gravidade = "critico" | "atencao" | "informativo";

export type Alerta = {
  /** Chave estável, para testes e para a interface escolher o ícone. */
  tipo: string;
  gravidade: Gravidade;
  /** Texto pronto a ler, já com os números. */
  texto: string;
  /** Para onde ir resolver, relativo ao cliente. */
  href?: string;
};

/** Números apurados na base. Todos opcionais: nem todo o cliente tem tudo. */
export type Factos = {
  /** Faturas de venda com saldo por receber e vencimento passado. */
  recebimentosVencidos?: { quantidade: number; total: number };
  /** Faturas que vencem hoje. */
  vencemHoje?: { quantidade: number; total: number };
  /** Produtos com estoque abaixo do mínimo definido. */
  estoqueAbaixoMinimo?: { quantidade: number; exemplos: string[] };
  /** Dias até o certificado digital expirar. Negativo = já expirou. */
  diasCertificado?: number | null;
  /** Dias até o timbrado expirar. */
  diasTimbrado?: number | null;
  /** Não há certificado ativo configurado. */
  semCertificado?: boolean;
  /** Consultas marcadas para hoje (clinic). */
  consultasHoje?: number;
  /** Certificações do agronegócio a expirar nos próximos 60 dias (farm). */
  certificacoesAExpirar?: { quantidade: number; exemplos: string[] };
  /** Vendas de ontem, para dar contexto. */
  vendasOntem?: number;
};

const ORDEM: Record<Gravidade, number> = { critico: 0, atencao: 1, informativo: 2 };

function moeda(v: number): string {
  return `${new Intl.NumberFormat("es-PY").format(Math.round(v))} Gs`;
}

function plural(n: number, um: string, muitos: string): string {
  return n === 1 ? um : muitos;
}

/**
 * Traduz factos em alertas, ordenados por gravidade.
 *
 * Só entra o que exige acção. Um estoque saudável e um certificado válido não
 * geram linha: um painel que diz "está tudo bem" em cinco linhas ensina a
 * ignorá-lo, e no dia em que disser algo importante já ninguém o lê.
 */
export function alertasDoDia(f: Factos): Alerta[] {
  const as: Alerta[] = [];

  if (f.semCertificado) {
    as.push({
      tipo: "certificado-ausente",
      gravidade: "critico",
      texto: "Não há certificado digital ativo — nenhum documento eletrônico pode ser emitido.",
      href: "settings/fiscal",
    });
  } else if (typeof f.diasCertificado === "number") {
    if (f.diasCertificado < 0) {
      as.push({
        tipo: "certificado-expirado",
        gravidade: "critico",
        texto: `O certificado digital expirou há ${Math.abs(f.diasCertificado)} ${plural(Math.abs(f.diasCertificado), "dia", "dias")}. A emissão está parada.`,
        href: "settings/fiscal",
      });
    } else if (f.diasCertificado <= 30) {
      as.push({
        tipo: "certificado-a-expirar",
        gravidade: f.diasCertificado <= 7 ? "critico" : "atencao",
        texto: `O certificado digital expira em ${f.diasCertificado} ${plural(f.diasCertificado, "dia", "dias")}. A renovação leva tempo — comece agora.`,
        href: "settings/fiscal",
      });
    }
  }

  if (typeof f.diasTimbrado === "number" && f.diasTimbrado <= 30) {
    as.push({
      tipo: "timbrado-a-expirar",
      gravidade: f.diasTimbrado <= 7 ? "critico" : "atencao",
      texto:
        f.diasTimbrado < 0
          ? `O timbrado expirou há ${Math.abs(f.diasTimbrado)} ${plural(Math.abs(f.diasTimbrado), "dia", "dias")}. Não é possível faturar dentro da lei.`
          : `O timbrado expira em ${f.diasTimbrado} ${plural(f.diasTimbrado, "dia", "dias")}. Solicite o novo à SET.`,
      href: "settings/fiscal",
    });
  }

  if (f.recebimentosVencidos && f.recebimentosVencidos.quantidade > 0) {
    const { quantidade, total } = f.recebimentosVencidos;
    as.push({
      tipo: "recebimentos-vencidos",
      gravidade: "critico",
      texto: `${quantidade} ${plural(quantidade, "fatura vencida", "faturas vencidas")} por receber, somando ${moeda(total)}.`,
      href: "finance",
    });
  }

  if (f.vencemHoje && f.vencemHoje.quantidade > 0) {
    const { quantidade, total } = f.vencemHoje;
    as.push({
      tipo: "vencem-hoje",
      gravidade: "atencao",
      texto: `${quantidade} ${plural(quantidade, "fatura vence", "faturas vencem")} hoje: ${moeda(total)}.`,
      href: "finance",
    });
  }

  if (f.estoqueAbaixoMinimo && f.estoqueAbaixoMinimo.quantidade > 0) {
    const { quantidade, exemplos } = f.estoqueAbaixoMinimo;
    const lista = exemplos.slice(0, 3).join(", ");
    as.push({
      tipo: "estoque-baixo",
      gravidade: "atencao",
      texto: `${quantidade} ${plural(quantidade, "produto está", "produtos estão")} abaixo do estoque mínimo${lista ? `: ${lista}` : ""}${quantidade > 3 ? " e outros" : ""}.`,
      href: "inventory",
    });
  }

  if (f.certificacoesAExpirar && f.certificacoesAExpirar.quantidade > 0) {
    const { quantidade, exemplos } = f.certificacoesAExpirar;
    as.push({
      tipo: "certificacoes-a-expirar",
      gravidade: "atencao",
      texto: `${quantidade} ${plural(quantidade, "certificação expira", "certificações expiram")} nos próximos 60 dias${exemplos.length ? `: ${exemplos.slice(0, 2).join(", ")}` : ""}.`,
      href: "certificacoes",
    });
  }

  if (typeof f.consultasHoje === "number" && f.consultasHoje > 0) {
    as.push({
      tipo: "consultas-hoje",
      gravidade: "informativo",
      texto: `${f.consultasHoje} ${plural(f.consultasHoje, "consulta marcada", "consultas marcadas")} para hoje.`,
      href: "agenda",
    });
  }

  if (typeof f.vendasOntem === "number" && f.vendasOntem > 0) {
    as.push({
      tipo: "vendas-ontem",
      gravidade: "informativo",
      texto: `Ontem faturou ${moeda(f.vendasOntem)}.`,
      href: "reports",
    });
  }

  return as.sort((a, b) => ORDEM[a.gravidade] - ORDEM[b.gravidade]);
}

/**
 * Resumo de recurso, para quando não há modelo configurado ou ele falha.
 *
 * O briefing não pode depender de um serviço externo estar de pé: os factos já
 * estão calculados e valem por si. O modelo acrescenta redação, não conteúdo.
 */
export function resumoSemModelo(alertas: Alerta[]): string {
  if (alertas.length === 0) return "Nada a assinalar hoje. Os indicadores estão dentro do esperado.";

  const criticos = alertas.filter((a) => a.gravidade === "critico").length;
  if (criticos > 0) {
    return `${criticos} ${plural(criticos, "ponto crítico", "pontos críticos")} a resolver hoje, ${plural(criticos, "listado", "listados")} abaixo.`;
  }
  return `${alertas.length} ${plural(alertas.length, "ponto merece", "pontos merecem")} atenção hoje.`;
}

/** Dia a que o briefing pertence, em fuso do Paraguai (chave da cache diária). */
export function chaveDoDia(agora: Date, timeZone = "America/Asuncion"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}
