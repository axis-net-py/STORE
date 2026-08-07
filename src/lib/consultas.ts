/**
 * Catálogo de consultas do assistente — puro, sem base de dados.
 *
 * O objetivo é o assistente responder a perguntas sobre os dados da própria
 * empresa: "quando foi a última compra do fulano", "que contas vencem esta
 * semana", "qual o produto que mais vendi este mês".
 *
 * O MODELO NÃO ESCREVE SQL. Escolhe um nome deste catálogo e uns parâmetros; o
 * servidor é que executa, com Prisma, sempre filtrado pelo cliente da sessão.
 * A alternativa — deixar o modelo redigir a consulta — punha um gerador de
 * texto a decidir que linhas da base saem, e bastava uma frase bem escrita numa
 * caixa de chat para ler os dados de outra empresa. Aqui, o pior que uma frase
 * consegue é escolher a consulta errada da lista.
 *
 * Cada consulta tem a sua permissão. Quem não pode ver faturas não passa a
 * poder só porque perguntou em vez de ter aberto o ecrã.
 */

export type ParamSpec = {
  nome: string;
  descricao: string;
};

export type Consulta = {
  nome: string;
  /** Vai para o prompt: é o que o modelo lê para escolher. */
  descricao: string;
  permissao: string;
  params: ParamSpec[];
};

export const CONSULTAS: Consulta[] = [
  {
    nome: "cliente",
    descricao:
      "Ficha de um cliente: contacto, última compra, total comprado e saldo em aberto. Use para 'quando foi a última compra do fulano', 'quanto o fulano já comprou', 'o fulano deve alguma coisa'.",
    permissao: "customers:read",
    params: [{ nome: "nome", descricao: "nome ou parte do nome do cliente" }],
  },
  {
    nome: "fornecedor",
    descricao:
      "Ficha de um fornecedor: contacto, última compra feita a ele, total e saldo a pagar. Use para 'quando comprei da empresa X', 'quanto devo ao fornecedor Y'.",
    permissao: "suppliers:read",
    params: [{ nome: "nome", descricao: "nome ou parte do nome do fornecedor" }],
  },
  {
    nome: "produto",
    descricao:
      "Ficha de um produto: estoque, preço, custo, última compra, última venda e quanto saiu no período. Use para 'quanto tenho de X', 'quando comprei X pela última vez', 'quanto vendi de X'.",
    permissao: "inventory:read",
    params: [
      { nome: "nome", descricao: "nome ou SKU do produto" },
      { nome: "dias", descricao: "janela em dias para as vendas, por omissão 30" },
    ],
  },
  {
    nome: "vencimentos",
    descricao:
      "Faturas que vencem nos próximos dias e ainda não estão pagas. Use para 'que contas vencem esta semana', 'o que tenho a pagar nos próximos dias', 'próximos vencimentos'.",
    permissao: "invoices:read",
    params: [
      { nome: "dias", descricao: "quantos dias para a frente, por omissão 7" },
      { nome: "direcao", descricao: "RECEIVABLE (a receber) ou PAYABLE (a pagar)" },
    ],
  },
  {
    nome: "vencidas",
    descricao:
      "Faturas já vencidas e por pagar, da mais antiga para a mais recente. Use para 'quem está em atraso', 'o que está vencido', 'quem me deve há mais tempo'.",
    permissao: "invoices:read",
    params: [{ nome: "direcao", descricao: "RECEIVABLE ou PAYABLE" }],
  },
  {
    nome: "faturas",
    descricao:
      "Últimas faturas, opcionalmente de um cliente ou fornecedor. Use para 'últimas vendas', 'últimas compras', 'o que o fulano comprou'.",
    permissao: "invoices:read",
    params: [
      { nome: "tipo", descricao: "SALES (vendas) ou PURCHASE (compras)" },
      { nome: "entidade", descricao: "nome do cliente ou fornecedor, opcional" },
      { nome: "dias", descricao: "janela em dias, por omissão 90" },
    ],
  },
  {
    nome: "ranking_clientes",
    descricao:
      "Clientes que mais compraram num período. Use para 'meus melhores clientes', 'quem mais comprou este mês'.",
    permissao: "reports:read",
    params: [{ nome: "dias", descricao: "janela em dias, por omissão 30" }],
  },
  {
    nome: "ranking_produtos",
    descricao:
      "Produtos mais vendidos num período, por quantidade e por valor. Use para 'o que mais vendi', 'produto que mais fatura'.",
    permissao: "reports:read",
    params: [{ nome: "dias", descricao: "janela em dias, por omissão 30" }],
  },
  {
    nome: "resumo",
    descricao:
      "Resumo do período: vendas, compras, número de faturas e ticket médio. Use para 'como foi o mês', 'quanto vendi esta semana', 'resumo de hoje'.",
    permissao: "reports:read",
    params: [{ nome: "dias", descricao: "janela em dias, por omissão 30" }],
  },
  {
    nome: "estoque_baixo",
    descricao:
      "Produtos abaixo do estoque mínimo. Use para 'o que preciso comprar', 'que produtos estão a acabar'.",
    permissao: "inventory:read",
    params: [],
  },
  {
    nome: "procurar",
    descricao:
      "Procura por nome em clientes, fornecedores e produtos. Use quando o nome que o utilizador deu é ambíguo ou não se sabe se é cliente, fornecedor ou produto.",
    permissao: "customers:read",
    params: [{ nome: "termo", descricao: "o que procurar" }],
  },
];

const PORNOME = new Map(CONSULTAS.map((c) => [c.nome, c]));

export function consultaPorNome(nome: string): Consulta | null {
  return PORNOME.get(nome) ?? null;
}

/**
 * Teto de linhas devolvidas.
 *
 * Duas razões, e ambas contam. A primeira é o custo: as linhas vão para o
 * modelo escrever a resposta, e uma lista de mil faturas é dinheiro gasto para
 * dizer o mesmo que dizem as vinte primeiras. A segunda é que ninguém lê mil
 * linhas num balão de chat — quem precisa da lista toda abre o ecrã.
 */
export const LIMITE_LINHAS = 25;

/** Dias válidos para uma janela: entre um dia e dois anos. */
export function normalizarDias(valor: unknown, omissao: number): number {
  const n = Math.floor(Number(valor));
  if (!Number.isFinite(n) || n <= 0) return omissao;
  return Math.min(n, 730);
}

export function normalizarDirecao(valor: unknown): "RECEIVABLE" | "PAYABLE" {
  return String(valor).toUpperCase() === "PAYABLE" ? "PAYABLE" : "RECEIVABLE";
}

export function normalizarTipo(valor: unknown): "SALES" | "PURCHASE" {
  return String(valor).toUpperCase() === "PURCHASE" ? "PURCHASE" : "SALES";
}

/** Início do dia, n dias atrás. */
export function desdeDias(dias: number, agora: Date): Date {
  const d = new Date(agora);
  d.setDate(d.getDate() - dias);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Fim do dia, n dias à frente. */
export function ateDias(dias: number, agora: Date): Date {
  const d = new Date(agora);
  d.setDate(d.getDate() + dias);
  d.setHours(23, 59, 59, 999);
  return d;
}

export type Resultado = {
  consulta: string;
  titulo: string;
  linhas: Record<string, unknown>[];
  /** Contas já feitas — o modelo nunca soma nada. */
  totais?: Record<string, number>;
  /** Dito ao utilizador quando a lista foi cortada. */
  truncado?: boolean;
};

/**
 * Reconhece a pergunta sem modelo.
 *
 * Serve de rede quando não há chave da API ou o modelo falha. Não tenta ser
 * esperto: apanha as formas que as pessoas usam de facto, e devolve null
 * quando não tem a certeza — responder à pergunta errada é pior do que dizer
 * que não se percebeu.
 */
export function consultaLocal(
  texto: string
): { consulta: string; params: Record<string, unknown> } | null {
  const t = texto.toLowerCase().trim();

  const dias = (() => {
    if (/\bhoje\b|\bhoy\b/.test(t)) return 1;
    if (/semana|semanal/.test(t)) return 7;
    if (/m[êe]s|mes\b|mensal/.test(t)) return 30;
    if (/ano|a[ñn]o/.test(t)) return 365;
    const n = t.match(/(\d+)\s*dias?/);
    return n ? Number(n[1]) : undefined;
  })();

  const pagar = /pagar|devo|fornecedor|proveedor|compra/.test(t);

  if (/vencid[ao]s?|atrasad[ao]s?|em atraso|venci[óo]|mora/.test(t)) {
    return { consulta: "vencidas", params: { direcao: pagar ? "PAYABLE" : "RECEIVABLE" } };
  }

  // O número entra no meio — "próximos 15 dias" — e sem o aceitar a pergunta
  // mais comum de todas não era reconhecida.
  if (/vence|vencimento|vencer|a vencer|por vencer|pr[óo]ximos?\s+(?:\d+\s+)?dias/.test(t)) {
    return {
      consulta: "vencimentos",
      params: { dias: dias ?? 7, direcao: pagar ? "PAYABLE" : "RECEIVABLE" },
    };
  }

  if (/estoque baixo|em falta|acabando|a acabar|preciso comprar|stock bajo|reposi[çc][ãa]o/.test(t)) {
    return { consulta: "estoque_baixo", params: {} };
  }

  if (/melhores clientes|maiores clientes|quem mais compr|mejores clientes/.test(t)) {
    return { consulta: "ranking_clientes", params: { dias: dias ?? 30 } };
  }

  if (/mais vendid|que mais vend|produtos? mais|m[áa]s vendid/.test(t)) {
    return { consulta: "ranking_produtos", params: { dias: dias ?? 30 } };
  }

  // "última compra do fulano", "o que a Maria comprou".
  //
  // O `\b` à cabeça não é enfeite: sem ele, o "do" de "quando" servia de
  // preposição e o nome capturado passava a ser "foi a última compra do João".
  const deQuem = texto.match(
    /\b(?:d[oae]s?\s+(?:cliente|fornecedor|proveedor)\s+|d[oae]\s+|para\s+)([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 .&'-]{2,60}?)(?:\?|\.|,|$)/i
  );
  if (/[úu]ltim[ao]s?\s+(compra|venda|fatura|factura|pedido)/.test(t) && deQuem) {
    // "a última compra do João" é o que o João comprou — do nosso lado, uma
    // venda. Só é uma compra nossa quando a frase diz fornecedor. De qualquer
    // forma o servidor confirma pelo nome antes de responder.
    const aFornecedor = /fornecedor|proveedor/.test(t);
    return {
      consulta: "faturas",
      params: {
        tipo: aFornecedor ? "PURCHASE" : "SALES",
        entidade: deQuem[1].trim(),
        dias: dias ?? 365,
      },
    };
  }

  if (/[úu]ltim[ao]s?\s+(compra|venda|fatura|factura)/.test(t)) {
    return { consulta: "faturas", params: { tipo: pagar ? "PURCHASE" : "SALES", dias: dias ?? 90 } };
  }

  if (/quanto vendi|vendas de|faturamento|resumo|como foi/.test(t)) {
    return { consulta: "resumo", params: { dias: dias ?? 30 } };
  }

  return null;
}

/**
 * Resposta sem modelo: os factos, em texto, sem prosa.
 *
 * Feia mas verdadeira. Vale mais do que um "não consegui responder" quando a
 * chave da API falta ou o modelo está em baixo — os números são os mesmos.
 */
export function respostaSemModelo(r: Resultado): string {
  const fmt = new Intl.NumberFormat("es-PY");
  const valor = (v: unknown) =>
    typeof v === "number" ? fmt.format(Math.round(v)) : v === null || v === undefined ? "—" : String(v);

  const partes: string[] = [r.titulo];

  // Uma lista vazia com "Total: 0" por cima diz duas vezes a mesma coisa, e a
  // segunda parece um número apurado quando é só a ausência de dados.
  const temNumeros = r.totais && Object.values(r.totais).some((v) => v !== 0);
  if (r.totais && temNumeros) {
    partes.push(
      Object.entries(r.totais)
        .map(([k, v]) => `${k}: ${fmt.format(Math.round(v))}`)
        .join(" · ")
    );
  }

  if (r.linhas.length === 0) {
    // Num resumo, os totais SÃO a resposta — dizer "nada encontrado" logo a
    // seguir a eles é contradizer-se na mesma mensagem.
    if (!temNumeros) partes.push("Nada encontrado.");
  } else {
    for (const linha of r.linhas) {
      partes.push(
        "• " +
          Object.entries(linha)
            .map(([k, v]) => `${k} ${valor(v)}`)
            .join(", ")
      );
    }
    if (r.truncado) partes.push(`(mostrando as primeiras ${LIMITE_LINHAS})`);
  }

  return partes.join("\n");
}
