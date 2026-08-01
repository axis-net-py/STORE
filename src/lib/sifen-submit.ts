/**
 * Submissão de documentos à SIFEN.
 *
 * ESTE MÓDULO NÃO PODE SER 'use server'.
 *
 * submitInvoiceToSifen recebe o tenantId por parâmetro. Como server action,
 * isso era um endpoint HTTP público onde qualquer utilizador autenticado
 * podia mandar transmitir à SET uma fatura de OUTRA empresa, em nome dela —
 * um ato com efeitos legais. Auditoria de 2026-07-30.
 *
 * Chamadores legítimos: actions/invoice.ts, servidor para servidor.
 */
import prisma from "@/lib/prisma";
import { getCertificadoAtivo } from "@/lib/certificado-ativo";
import { mapearParaSifen } from "@/lib/sifen-mapa";
import { revalidatePath } from "next/cache";
import type { SifenInvoice, SifenConfig } from "@axis/sifen";
import { SifenClient } from "@axis/sifen";

/**
 * Submit an invoice to SIFEN (silent mode).
 * Never blocks business operations - failures are handled gracefully.
 */
export async function submitInvoiceToSifen(
  tenantId: string,
  invoiceId: string,
  locale: string = "pt-BR"
): Promise<{ success: boolean; message: string; cdc?: string }> {
  try {
    // Fetch invoice with all required data
    const invoice = await prisma.commercialInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        customer: true,
        items: { include: { product: true } },
        tenant: true,
      },
    });

    if (!invoice) {
      return { success: false, message: "Invoice not found" };
    }

    // Get tenant SIFEN config
    const sifenConfig: SifenConfig = {
      ruc: invoice.tenant.ruc || "",
      businessName: invoice.tenant.businessName || "",
      tradeName: invoice.tenant.tradeName || undefined,
      establishment: invoice.tenant.establishment || "001",
      emissionPoint: invoice.tenant.emissionPoint || "001",
      address: invoice.tenant.address || "",
      economicActivity: invoice.tenant.economicActivity || "",
    };

    // Get latest exchange rate
    const exchangeRate = await prisma.exchangeRate.findFirst({
      where: { tenantId },
      orderBy: { date: "desc" },
    });

    // Só se declara à SET o que a empresa emite. Uma fatura de COMPRA foi
    // emitida pelo fornecedor e já foi declarada por ele; transmiti-la em
    // nome desta empresa seria declarar uma venda que não houve. O mapeamento
    // anterior tinha `type === "SALES" ? "FACTURA" : "FACTURA"` — os dois
    // ramos iguais, o que na prática permitia a compra passar.
    if (invoice.type !== "SALES") {
      return { success: false, message: "Apenas faturas de venda são transmitidas à SET." };
    }

    // Mapeamento em lib/sifen-mapa.ts, com testes. Recusa transmitir sem
    // timbrado, sem número ou com o documento do cliente por preencher, em vez
    // de os substituir por vazio e por "00000000" como antes.
    const sifenInvoice: SifenInvoice = mapearParaSifen(
      invoice,
      exchangeRate ? Number(exchangeRate.ratePYGtoUSD) : undefined
    );

    // Certificado DESTE cliente, não o global (spec Projeto 2, §6).
    //
    // O `|| ""` que aqui estava fazia com que um certificado em falta
    // produzisse uma submissão à SET com credencial vazia, falhando com um
    // erro obscuro do lado da autoridade fiscal. Agora falha aqui, claro.
    const credencial = await getCertificadoAtivo(tenantId);
    if (!credencial) {
      throw new Error(
        "Nenhum certificado digital ativo. Carregue o certificado da empresa em Configurações › Fiscal antes de emitir documentos eletrônicos."
      );
    }

    const sifenClient = new SifenClient(sifenConfig, {
      apiUrl: process.env.SIFEN_API_URL || "https://sifen.set.gov.py/de/factura",
      certificate: credencial.certificate,
      certificatePass: credencial.password,
      timeout: 30000,
      retryAttempts: 3,
    });

    // Submit to SIFEN
    const result = await sifenClient.submitInvoice(sifenInvoice);

    // Update invoice with SIFEN response
    // updateMany com o tenantId no filtro, e não update por id: o id já veio
    // de uma consulta filtrada, mas quem escreve o CDC de um documento fiscal
    // não deve depender disso.
    await prisma.commercialInvoice.updateMany({
      where: { id: invoiceId, tenantId },
      data: {
        sifenStatus: result.success ? "APPROVED" : result.shouldRetry ? "PENDING" : "REJECTED",
        // O CDC NÃO se escreve aqui: foi calculado por nós na emissão e já
        // está gravado. Escrevê-lo de novo a partir da resposta permitiria
        // que a resposta trocasse a identidade do documento.
        sifenXmlUrl: result.xmlUrl || undefined,
      },
    });

    // Localize message
    const messages: Record<string, Record<string, string>> = {
      "pt-BR": {
        success: "Fatura enviada ao SIFEN com sucesso",
        pending: "Fatura salva localmente. Tentativa de envio agendada.",
        rejected: "Fatura rejeitada pelo SIFEN",
      },
      "es-PY": {
        success: "Factura enviada a SIFEN exitosamente",
        pending: "Factura guardada localmente. Envío programado.",
        rejected: "Factura rechazada por SIFEN",
      },
    };

    const localized = messages[locale] || messages["pt-BR"];

    if (result.success) {
      revalidatePath(`/${tenantId}/invoices/${invoiceId}`);
      return {
        success: true,
        message: localized.success,
        cdc: result.cdc,
      };
    }

    if (result.savedLocally) {
      return {
        success: false,
        message: localized.pending,
      };
    }

    return {
      success: false,
      message: localized.rejected,
    };
  } catch (error) {
    console.error("[SIFEN] Submission error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * NÃO IMPLEMENTADO. Ver o relatório de auditoria de 2026-07-30, item aberto 1.
 *
 * Devolvia `{ processed: 0, succeeded: 0, failed: 0 }` — a forma exata de uma
 * execução bem-sucedida que não encontrou nada por fazer. Quem ligasse isto a
 * um cron veria zeros todos os dias e concluiria que não havia pendências,
 * enquanto os documentos com sifenStatus 'PENDING' continuavam por declarar à
 * SET. Uma fatura não transmitida é uma fatura não declarada, e o silêncio era
 * indistinguível de estar tudo bem.
 *
 * Falta o essencial: o XML assinado não é guardado em lado nenhum, e sem ele
 * não há o que retransmitir (packages/sifen/services/retry.ts, processRetries,
 * passa `""` como XML). Implementar exige primeiro persistir o XML.
 *
 * Até lá, falha em voz alta em vez de mentir em silêncio.
 */
export async function retryPendingSifenSubmissions(_tenantId: string): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  throw new Error(
    "Retransmissão automática à SET ainda não implementada: o XML assinado não é " +
      "guardado. Reenvie o documento manualmente a partir da fatura."
  );
}
