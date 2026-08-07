/**
 * Cliente mínimo da API do Neon.
 *
 * Só o que o provisionamento precisa: criar um projeto e apagá-lo quando o
 * provisionamento falha a meio. Não é uma biblioteca — é a superfície que
 * usamos, e mantê-la pequena é o que permite lê-la de uma vez.
 *
 * O `fetch` é injetável para os testes poderem verificar o pedido sem chamar a
 * API a sério. Criar um projeto Neon num teste seria criar um projeto Neon a
 * sério, e ninguém quer descobrir isso na fatura.
 */

const API = "https://console.neon.tech/api/v2";

export type ProjetoNeon = {
  id: string;
  /** String de ligação com pooling — a que a aplicação usa. */
  connectionString: string;
  /** Ligação direta, sem pooler: é a que o `prisma migrate` exige. */
  connectionStringDireta: string;
};

export type Buscador = typeof fetch;

function chave(): string {
  const k = process.env.NEON_API_KEY;
  if (!k) {
    throw new Error(
      "NEON_API_KEY em falta: não é possível criar a base de dados do cliente. " +
        "Defina-a no ambiente do servidor."
    );
  }
  return k;
}

/**
 * Nome do projeto no painel do Neon.
 *
 * Prefixado e com o slug do cliente para se saber de quem é sem abrir nada. O
 * dia em que for preciso apagar a base de um cliente que saiu, o nome é a única
 * coisa que impede enganos.
 */
export function nomeDoProjeto(slug: string): string {
  return `axis-${slug}`;
}

/**
 * A ligação que o Prisma Migrate precisa.
 *
 * O Neon devolve por omissão o endereço do pooler (`-pooler` no host). O pooler
 * fala PgBouncer em modo transação, e `prisma migrate deploy` precisa de
 * sessões — com o pooler, as migrações falham com erros que não explicam nada.
 * A ligação direta é a mesma sem esse sufixo.
 */
export function ligacaoDireta(comPooling: string): string {
  return comPooling.replace("-pooler.", ".");
}

type RespostaCriacao = {
  project: { id: string };
  connection_uris?: { connection_uri: string }[];
};

export async function criarProjeto(
  slug: string,
  opcoes: { regiao?: string; buscador?: Buscador } = {}
): Promise<ProjetoNeon> {
  const buscar = opcoes.buscador ?? fetch;

  const r = await buscar(`${API}/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${chave()}`,
    },
    body: JSON.stringify({
      project: {
        name: nomeDoProjeto(slug),
        // A mesma região da base partilhada, para a latência entre a aplicação
        // e a base ser a mesma que já se conhece.
        region_id: opcoes.regiao ?? process.env.NEON_REGION ?? "aws-us-east-1",
        pg_version: 17,
      },
    }),
  });

  if (!r.ok) {
    // O corpo do erro do Neon pode trazer o nome do projeto e a organização,
    // mas nunca credenciais. O estado sozinho não chegava para perceber se foi
    // quota, permissão ou nome repetido.
    const detalhe = await r.text().catch(() => "");
    throw new Error(`Neon recusou criar o projeto (${r.status}): ${detalhe.slice(0, 300)}`);
  }

  const d = (await r.json()) as RespostaCriacao;
  const uri = d.connection_uris?.[0]?.connection_uri;
  if (!d.project?.id || !uri) {
    throw new Error("Neon criou o projeto mas não devolveu a string de ligação.");
  }

  return {
    id: d.project.id,
    connectionString: uri,
    connectionStringDireta: ligacaoDireta(uri),
  };
}

/**
 * Apaga um projeto. Só é chamado para desfazer um provisionamento que falhou.
 *
 * Um projeto meio-criado é pior do que nenhum: fica a contar para a quota e
 * ninguém sabe se tem dados. Nunca é chamado para clientes ativos — a suspensão
 * por falta de pagamento mantém os dados intactos, e apagar é decisão humana.
 */
export async function apagarProjeto(
  projectId: string,
  opcoes: { buscador?: Buscador } = {}
): Promise<void> {
  const buscar = opcoes.buscador ?? fetch;
  const r = await buscar(`${API}/projects/${projectId}`, {
    method: "DELETE",
    headers: { Accept: "application/json", Authorization: `Bearer ${chave()}` },
  });
  if (!r.ok && r.status !== 404) {
    throw new Error(`Não foi possível apagar o projeto Neon ${projectId} (${r.status}).`);
  }
}
