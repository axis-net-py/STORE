"use server";

import prisma from "@/lib/prisma";
import { Currency, TransactionType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import { z } from "zod";

const FinanceTransactionSchema = z.object({
  type: z.nativeEnum(TransactionType),
  entityId: z.string().min(1, "Entidad es requerida"),
  category: z.string().min(1, "Categoría es requerida"),
  currency: z.nativeEnum(Currency),
  amount: z.number().positive("Monto debe ser mayor a 0"),
  exchangeRate: z.number().positive("Tasa de cambio debe ser positiva").default(1),
});

export type FinanceTransactionInput = z.infer<typeof FinanceTransactionSchema>;

export async function createFinanceTransaction(data: FinanceTransactionInput) {
  try {
    // Lançar dinheiro no razão exige permissão de escrita contabilística, não
    // apenas sessão. Antes disto, um AUDITOR podia criar lançamentos.
    const { tenantId } = await requirePermission("accounting:write");
    const session = { user: { tenantId } };

    const totalPyg = data.currency === Currency.PYG ? data.amount : data.amount * data.exchangeRate;

    const transaction = await prisma.transaction.create({
      data: {
        tenantId: session.user.tenantId,
        type: data.type,
        entityId: data.entityId,
        currency: data.currency,
        amount: data.amount,
        exchangeRate: data.exchangeRate,
        totalPyg: totalPyg,
        // O schema exige category e o model tem a coluna, mas isto estava
        // comentado: a categoria era validada e depois descartada, gravando
        // sempre null. Corrigido na Fase 5 do Projeto 1.
        category: data.category,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        action: "CREATE_FINANCE_TRANSACTION",
        details: {
          transactionId: transaction.id,
          type: data.type,
          entityId: data.entityId,
          amount: data.amount,
          currency: data.currency,
          totalPyg: totalPyg,
        },
      },
    });

    revalidatePath(`/${session.user.tenantId}/finanzas`);
    revalidatePath('/finanzas');
    return { success: true, transaction };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
