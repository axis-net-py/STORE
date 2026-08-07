import type { PrismaClient } from "@prisma/client";
import { baseDoPedido, basePartilhada } from "@/lib/tenant-db";

/**
 * O cliente Prisma do pedido em curso.
 *
 * Continua a exportar-se como antes — `import prisma from "@/lib/prisma"` — e
 * as centenas de chamadas espalhadas pelo ERP não mudam uma linha. O que muda é
 * para onde vão: cada chamada resolve, no momento em que é feita, a base do
 * cliente deste pedido (ver lib/tenant-db.ts).
 *
 * A RESOLUÇÃO É ASSÍNCRONA, e é isso que obriga a esta forma. Descobrir a base
 * exige ler a sessão e o registo de clientes, e nada disso se faz num getter
 * síncrono. Mas todos os métodos do Prisma já devolvem promessas — `findMany`,
 * `create`, `$transaction`, `$queryRaw` — portanto embrulhá-los numa função
 * `async` é invisível para quem chama.
 *
 * A alternativa era passar o cliente à mão em cada uma das ~60 server actions.
 * Explícito, mas com um buraco: bastava uma ação nova esquecer-se de o usar
 * para ler a base errada, em silêncio, e ninguém dava por isso até um cliente
 * ver dados que não são dele. Aqui não há nada para esquecer.
 */

/** Métodos do cliente que não pertencem a um modelo. */
const DO_CLIENTE = new Set([
  "$transaction",
  "$queryRaw",
  "$queryRawUnsafe",
  "$executeRaw",
  "$executeRawUnsafe",
  "$connect",
  "$disconnect",
  "$runCommandRaw",
]);

/** Envolve um modelo: `prisma.customer.findMany(...)` resolve a base primeiro. */
function modelo(nome: string) {
  return new Proxy(
    {},
    {
      get(_alvo, operacao) {
        if (typeof operacao !== "string") return undefined;
        return async (...args: unknown[]) => {
          const db = await baseDoPedido();
          return (db as any)[nome][operacao](...args);
        };
      },
    }
  );
}

const prisma = new Proxy({} as PrismaClient, {
  get(_alvo, propriedade) {
    if (typeof propriedade !== "string") return undefined;

    // `then` tem de ficar indefinido: sem isto, um `await prisma` — ou o
    // próprio motor de promessas a inspecionar o objeto — pensaria que isto é
    // uma promessa e ficaria à espera de uma resolução que nunca chega.
    if (propriedade === "then") return undefined;

    if (DO_CLIENTE.has(propriedade)) {
      return async (...args: unknown[]) => {
        const db = await baseDoPedido();
        return (db as any)[propriedade](...args);
      };
    }

    if (propriedade.startsWith("$")) {
      // `$extends`, `$on` e afins: pouco usados aqui e não devolvem promessas.
      // Vão para a base partilhada, que é o comportamento de sempre.
      const v = (basePartilhada() as any)[propriedade];
      return typeof v === "function" ? v.bind(basePartilhada()) : v;
    }

    return modelo(propriedade);
  },
});

export { prisma, basePartilhada };
export default prisma;
