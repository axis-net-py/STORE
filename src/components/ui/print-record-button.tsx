"use client";

import { Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface PrintField {
  label: string;
  value: string;
}

interface PrintRecordButtonProps {
  title: string;
  subtitle?: string;
  fields: PrintField[];
  label?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(title: string, subtitle: string | undefined, fields: PrintField[]): string {
  const rows = fields
    .map(
      (f) =>
        `<tr><td class="label">${escapeHtml(f.label)}</td><td class="value">${escapeHtml(f.value)}</td></tr>`
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 32px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.subtitle { margin: 0 0 24px; color: #666; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; }
  tr { border-bottom: 1px solid #eee; }
  td { padding: 8px 12px; }
  td.label { color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; width: 40%; }
  td.value { font-size: 14px; font-weight: 600; }
  @media print { body { padding: 16px; } }
</style></head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ""}
  <table>${rows}</table>
</body></html>`;
}

/**
 * Botão de impressão genérico para ficha de registro (cliente, fornecedor,
 * produto etc). Gera um HTML simples com os campos passados e imprime via
 * iframe oculto — mesmo mecanismo usado em Faturas.
 */
export function PrintRecordButton({ title, subtitle, fields, label = "Imprimir" }: PrintRecordButtonProps) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    setPrinting(true);
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error("Print failed", e);
      } finally {
        setPrinting(false);
        setTimeout(() => {
          if (iframe.parentNode) document.body.removeChild(iframe);
        }, 5000);
      }
    };

    iframe.srcdoc = buildHtml(title, subtitle, fields);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={printing}
      onClick={handlePrint}
      className="h-8 px-2.5 text-xs flex items-center gap-1.5 bg-card hover:bg-accent border-border"
    >
      {printing ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
      ) : (
        <Printer className="w-3.5 h-3.5 text-muted-foreground" />
      )}
      <span>{label}</span>
    </Button>
  );
}
