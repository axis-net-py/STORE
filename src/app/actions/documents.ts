"use server";

import { auth } from "@/auth";
import { requirePermission } from "@/lib/authz";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ─── Types ──────────────────────────────────────

export type PrintType = "thermal" | "laser";

// ─── Get Document URL for Printing ─────────────────────────

export async function getDocumentUrl(
  type: PrintType,
  documentId: string
): Promise<{ url: string; error?: string }> {
  try {
    await requirePermission("invoices:read");

    if (type === "laser") {
      return { url: `/api/v1/invoices/${documentId}/generate` };
    }
    return { url: `/thermal/${documentId}` };
  } catch (error: any) {
    return {
      url: "",
      error: error.message || "Failed to get document URL",
    };
  }
}

// ─── Validate Document Access ─────────────────────────

export async function validateDocumentAccess(
  documentId: string,
  documentType: "invoice" | "receipt" | "label"
): Promise<{ valid: boolean; tenantId?: string; error?: string }> {
  try {
    const { tenantId } = await requirePermission("invoices:read");

    if (documentType === "invoice") {
      // findFirst com o tenantId no filtro, e não findUnique seguido de
      // comparação: procurar pelo id e só depois comparar deixava a consulta
      // ler a linha de outra empresa antes de a rejeitar. O resultado era o
      // mesmo, mas o filtro no banco é o que se demonstra numa auditoria.
      const doc = await prisma.commercialInvoice.findFirst({
        where: { id: documentId, tenantId },
        select: { id: true },
      });
      if (!doc) {
        return { valid: false, error: "Document not found" };
      }
      return { valid: true, tenantId };
    }

    return { valid: false, error: "Unsupported document type" };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || "Validation failed",
    };
  }
}

// ─── Log Print Action (Audit) ─────────────────────

// O tenantId vinha por parâmetro e era escrito tal e qual no registo de
// auditoria. Como este ficheiro é 'use server', dava para inserir entradas
// forjadas no histórico de auditoria de OUTRA empresa — precisamente o
// registo em que se confia numa fiscalização. Vem da sessão.
export async function logPrintAction(
  documentId: string,
  printType: PrintType,
  _tenantId?: string
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.tenantId) return;
    const tenantId = session.user.tenantId;

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: session.user.id,
        action: "PRINT_DOCUMENT",
        entity: printType,
        entityId: documentId,
        details: {
          documentId,
          printType,
          timestamp: new Date().toISOString(),
        },
      },
    });

    revalidatePath(`/${tenantId}/settings/team`);
  } catch (error) {
    console.error("Failed to log print action:", error);
  }
}
