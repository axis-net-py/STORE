"use client";

import { Printer, Receipt, Pencil, Eye, Send, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CommercialInvoiceSheet } from "@/components/CommercialInvoiceSheet";
import { resubmitInvoiceToSifen } from "@/app/actions/sifen";

interface InvoiceActionsProps {
  invoice: any;
  tenantId: string;
}

export function InvoiceActions({ invoice, tenantId }: InvoiceActionsProps) {
  const router = useRouter();
  const [printingA4, setPrintingA4] = useState(false);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);

  const isSifen = !!invoice.sifenStatus;
  const isSales = invoice.type !== "PURCHASE";
  const a4Url = isSifen
    ? `/api/v1/invoices/${invoice.id}/generate`
    : `/api/invoices/${invoice.id}/pdf`;
  const receiptUrl = `/api/invoices/${invoice.id}/receipt`;

  // SIFEN-resubmittable when a sales invoice is stuck PENDING or was REJECTED.
  const canResubmitSifen =
    isSales && (invoice.sifenStatus === "PENDING" || invoice.sifenStatus === "REJECTED");
  const sifenApproved = isSales && invoice.sifenStatus === "APPROVED";

  const handlePrint = (url: string, setPrinting: (v: boolean) => void) => {
    setPrinting(true);
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.visibility = "hidden";
    iframe.src = url;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error("Direct printing failed, opening in new tab", e);
        window.open(url, "_blank");
      } finally {
        setPrinting(false);
        setTimeout(() => {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        }, 5000);
      }
    };

    iframe.onerror = () => {
      console.error("Failed to load PDF in iframe, opening in new tab");
      window.open(url, "_blank");
      setPrinting(false);
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    };
  };

  const handlePreview = () => {
    window.open(a4Url, "_blank", "noopener,noreferrer");
  };

  const handleResubmit = async () => {
    setResubmitting(true);
    try {
      const res = await resubmitInvoiceToSifen(invoice.id);
      if (res.success) {
        toast.success(res.message || "Fatura enviada ao SIFEN.", {
          description: res.cdc ? `CDC: ${res.cdc}` : undefined,
        });
      } else {
        toast.error(res.message || "Falha ao enviar ao SIFEN.");
      }
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao reenviar ao SIFEN.");
    } finally {
      setResubmitting(false);
    }
  };

  const handleCopyCdc = async () => {
    if (!invoice.sifenCdc) return;
    try {
      await navigator.clipboard.writeText(invoice.sifenCdc);
      toast.success("CDC copiado para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar o CDC.");
    }
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <CommercialInvoiceSheet
        tenantId={tenantId}
        invoice={invoice}
        trigger={
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs flex items-center gap-1.5 bg-card hover:bg-accent border-border"
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Editar</span>
          </Button>
        }
      />

      {isSales && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            title="Visualizar PDF em nova aba"
            className="h-8 px-2.5 text-xs flex items-center gap-1.5 bg-card hover:bg-accent border-border"
          >
            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Ver</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={printingA4}
            onClick={() => handlePrint(a4Url, setPrintingA4)}
            className="h-8 px-2.5 text-xs flex items-center gap-1.5 bg-card hover:bg-accent border-border"
          >
            <Printer className="w-3.5 h-3.5 text-muted-foreground" />
            <span>A4</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={printingReceipt}
            onClick={() => handlePrint(receiptUrl, setPrintingReceipt)}
            className="h-8 px-2.5 text-xs flex items-center gap-1.5 bg-card hover:bg-accent border-border"
          >
            <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
            <span>80mm</span>
          </Button>
        </>
      )}

      {canResubmitSifen && (
        <Button
          variant="outline"
          size="sm"
          disabled={resubmitting}
          onClick={handleResubmit}
          title={
            invoice.sifenStatus === "REJECTED"
              ? "Fatura rejeitada pelo SIFEN — tentar reenviar"
              : "Envio ao SIFEN pendente — tentar reenviar"
          }
          className={`h-8 px-2.5 text-xs flex items-center gap-1.5 bg-card hover:bg-accent ${
            invoice.sifenStatus === "REJECTED"
              ? "border-red-300 text-red-600 hover:text-red-700"
              : "border-amber-300 text-amber-600 hover:text-amber-700"
          }`}
        >
          {resubmitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>{resubmitting ? "Enviando..." : "Reenviar SET"}</span>
        </Button>
      )}

      {sifenApproved && invoice.sifenCdc && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyCdc}
          title={`CDC: ${invoice.sifenCdc}\n(clique para copiar)`}
          className="h-8 px-2.5 text-xs flex items-center gap-1.5 bg-card hover:bg-accent border-emerald-300 text-emerald-600 hover:text-emerald-700"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>CDC</span>
        </Button>
      )}
    </div>
  );
}
