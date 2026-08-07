import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
import { registoPorTenantId, ligacaoDe } from "@/lib/control-plane";

/**
 * A que base de dados este pedido fala.
 *
 * Um cliente com hospedagem DEDICATED tem um projeto Neon só dele. Um com
 * SHARED vive na base do ambiente, separado por `tenantId`. O código do ERP não
 * quer saber de qual dos dois se trata — continua a escrever `prisma.x.y()` —
 * e é aqui que se decide para onde isso vai.
 *
 * O contexto viaja em AsyncLocalStorage, não numa variável de módulo. A
 * diferença é a que separa isto de funcionar e de ser uma falha de segurança:
 * numa instância serverless que serve dois pedidos ao mesmo tempo, uma variável
 * partilhada faria o segundo pedido ler a base do primeiro. O ALS mantém um
 * valor por cadeia de execução, e duas cadeias nunca se veem.
 *
 * Estabelecer o contexto é obrigação de quem entra: `requirePermission` e o
 * `authorize` do login fazem-no antes da primeira consulta. Sem contexto, cai
 * na base partilhada — que é o comportamento correto para os clientes que lá
 * vivem, e o único possível para código de sistema (crons, provisionamento).
 */

type Contexto = { tenantId: string; client: PrismaClient };

const globalForDb = globalThis as unknown as {
  contexto?: AsyncLocalStorage<Contexto>;
  partilhada?: PrismaClient;
  dedicadas?: Map<string, PrismaClient>;
};

/**
 * O armazenamento vive no globalThis, não numa constante de módulo.
 *
 * O empacotador do Next parte o servidor em vários pedaços, e o mesmo ficheiro
 * pode acabar instanciado mais do que uma vez — uma no pedaço do login, outra
 * no das server actions. Com uma constante de módulo seriam dois ALS
 * diferentes: o login fixava a base num, e a consulta seguinte lia o outro,
 * vazio, e caía na base partilhada. Sintoma: credenciais certas a serem
 * recusadas, sem erro nenhum nos registos.
 */
const contexto: AsyncLocalStorage<Contexto> = (globalForDb.contexto ??=
  new AsyncLocalStorage<Contexto>());

/** A base do ambiente: onde vivem os clientes partilhados. */
export function basePartilhada(): PrismaClient {
  if (!globalForDb.partilhada) globalForDb.partilhada = new PrismaClient();
  return globalForDb.partilhada;
}

/**
 * Cache de clientes por string de ligação.
 *
 * Por ligação e não por `tenantId`: se a string for rodada, a chave muda e o
 * cliente novo é criado sozinho, em vez de a instância continuar agarrada a
 * credenciais revogadas até reiniciar.
 *
 * Cada PrismaClient tem o seu pool de ligações, e o Neon tem limite por
 * projeto. Guardar sem teto numa instância que já serviu cem clientes esgotava
 * o pool; por isso o mapa é limitado e o mais antigo sai.
 */
const MAX_CLIENTES = 25;

function clientePara(ligacao: string): PrismaClient {
  if (!globalForDb.dedicadas) globalForDb.dedicadas = new Map();
  const mapa = globalForDb.dedicadas;

  const existente = mapa.get(ligacao);
  if (existente) {
    // Reinserir põe a chave no fim da ordem de iteração — é o que torna o
    // despejo abaixo um LRU em vez de deitar fora o que está em uso.
    mapa.delete(ligacao);
    mapa.set(ligacao, existente);
    return existente;
  }

  const novo = new PrismaClient({ datasources: { db: { url: ligacao } } });
  mapa.set(ligacao, novo);

  while (mapa.size > MAX_CLIENTES) {
    const maisAntiga = mapa.keys().next().value as string | undefined;
    if (!maisAntiga) break;
    const cliente = mapa.get(maisAntiga);
    mapa.delete(maisAntiga);
    // Fechar sem esperar: as consultas em curso terminam, e um await aqui
    // atrasaria o pedido que só queria abrir uma ligação nova.
    cliente?.$disconnect().catch(() => {});
  }

  return novo;
}

/**
 * Resolve a base de um cliente.
 *
 * Falha em vez de cair na partilhada quando o registo diz DEDICATED mas a
 * ligação não abre. Cair para a partilhada seria pior do que falhar: o cliente
 * veria a base errada — vazia, ou pior, de outra empresa — e acharia que perdeu
 * os dados.
 */
export async function baseDoCliente(tenantId: string): Promise<PrismaClient> {
  const registo = await registoPorTenantId(tenantId).catch(() => null);
  if (!registo || registo.hosting !== "DEDICATED") return basePartilhada();

  const ligacao = await ligacaoDe(registo.id);
  if (!ligacao) {
    throw new Error(
      `Cliente ${registo.slug} está marcado como dedicado mas não tem ligação registada.`
    );
  }
  return clientePara(ligacao);
}

/**
 * Fixa a base deste pedido. SÍNCRONA, e tem de ser.
 *
 * `enterWith` vale para o resto da execução síncrona de quem o chama e para
 * tudo o que essa execução lançar a seguir. Numa função `async`, "quem chama" é
 * a própria função — e quando ela retorna, o chamador volta ao contexto que
 * tinha quando fez `await`. O contexto não sobe.
 *
 * Foi exatamente isso que aconteceu na primeira versão: o login resolvia a base
 * certa, fixava-a dentro de um helper `async`, e a consulta seguinte lia a base
 * partilhada como se nada fosse. Credenciais certas recusadas, sem um erro nos
 * registos que explicasse porquê.
 *
 * Por isso são dois passos: resolver (assíncrono) e fixar (síncrono, no frame
 * de quem vai consultar).
 */
export function fixarBase(tenantId: string, client: PrismaClient): void {
  contexto.enterWith({ tenantId, client });
}

/**
 * Resolve e fixa, para quem puder pagar a ida à base no seu próprio frame.
 *
 * O `await` fica do lado de fora — `await resolverEFixar(...)` no chamador é o
 * que faz o `enterWith` correr no frame certo.
 */
export async function resolverEFixar(tenantId: string): Promise<PrismaClient> {
  const atual = contexto.getStore();
  if (atual?.tenantId === tenantId) return atual.client;
  return await baseDoCliente(tenantId);
}

/** A base deste pedido, ou a partilhada quando ninguém a fixou. */
export function baseAtual(): PrismaClient {
  return contexto.getStore()?.client ?? basePartilhada();
}

/** De que cliente é o contexto atual. Nulo fora de um pedido autenticado. */
export function tenantDoContexto(): string | null {
  return contexto.getStore()?.tenantId ?? null;
}

/**
 * Corre uma função contra a base de um cliente, sem tocar no contexto de fora.
 *
 * Para o provisionamento e para os scripts de migração, que percorrem vários
 * clientes seguidos e não podem deixar o último a contaminar o seguinte.
 */
export async function comBaseDoCliente<T>(
  tenantId: string,
  fn: (db: PrismaClient) => Promise<T>
): Promise<T> {
  const client = await baseDoCliente(tenantId);
  return contexto.run({ tenantId, client }, () => fn(client));
}
