import type { PrismaClient } from "@prisma/client";
import { baseAtual, basePartilhada } from "@/lib/tenant-db";

/**
 * O cliente Prisma do pedido em curso.
 *
 * Continua a exportar-se como antes — `import prisma from "@/lib/prisma"` — e
 * as centenas de chamadas espalhadas pelo ERP não mudam uma linha. O que muda é
 * para onde vão: um Proxy resolve, a cada acesso, a base do cliente deste
 * pedido (ver lib/tenant-db.ts).
 *
 * Um Proxy e não uma função `db()` porque a alternativa era reescrever todos os
 * ficheiros que falam com a base — e uma migração dessas ou se faz toda de uma
 * vez ou deixa metade do sistema a ler a base errada durante semanas. Aqui, o
 * dia em que um cliente passa a ter base própria não exige tocar em código de
 * negócio nenhum.
 *
 * O custo é um `getStore()` por acesso a propriedade, que é uma leitura de
 * campo em memória. O ganho é não haver forma de esquecer o encaminhamento.
 */
const prisma = new Proxy({} as PrismaClient, {
  get(_alvo, propriedade, receptor) {
    const cliente = baseAtual();
    const valor = Reflect.get(cliente as object, propriedade, receptor);
    // Ligar ao cliente real: métodos como `$transaction` e `$queryRaw` contam
    // com o seu próprio `this`, e desligados dele rebentam com um erro que não
    // diz o que aconteceu.
    return typeof valor === "function" ? valor.bind(cliente) : valor;
  },
  has(_alvo, propriedade) {
    return propriedade in (baseAtual() as object);
  },
});

export { prisma, basePartilhada };
export default prisma;
