"use client";

import { Printer, Receipt, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CommercialInvoiceSheet } from "@/components/CommercialInvoiceSheet";
import { cancelInvoice } from "@/app/actions/invoice";

interface InvoiceActionsProps {
  invoice: any;
  tenantId: string;
}

export function InvoiceActions({ invoice, tenantId }: InvoiceActionsProps) {
  const [printingA4, setPrintingA4] = useState(false);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const router = useRouter();

  const isCancelled = invoice.status === "CANCELLED";

  const handleCancel = async () => {
    if (isCancelled || cancelling) return;
    if (!window.confirm(`Excluir a fatura ${invoice.documentNumber || ""}? O estoque e os lançamentos contábeis serão revertidos. Esta ação não pode ser desfeita.`)) return;
    setCancelling(true);
    try {
      await cancelInvoice(invoice.id);
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Erro ao excluir a fatura.");
    } finally {
      setCancelling(false);
    }
  };

  const isSifen = !!invoice.sifenStatus;
  const a4Url = isSifen 
    ? `/api/v1/invoices/${invoice.id}/generate` 
    : `/api/invoices/${invoice.id}/pdf`;
  const receiptUrl = `/api/invoices/${invoice.id}/receipt`;

  const handlePrint = (url: string, setPrinting: (v: boolean) => void) => {
    setPrinting(true);
    // Create hidden iframe
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
        // Remove iframe after print dialog opens
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

      {invoice.type !== "PURCHASE" && (
        <>
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

      {!isCancelled && (
        <Button
          variant="outline"
          size="sm"
          disabled={cancelling}
          onClick={handleCancel}
          className="h-8 px-2.5 text-xs flex items-center gap-1.5 bg-card hover:bg-destructive/10 hover:text-destructive border-border"
        >
          {cancelling ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span>Excluir</span>
        </Button>
      )}
    </div>
  );
}
