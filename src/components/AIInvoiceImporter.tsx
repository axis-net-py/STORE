"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Sparkles, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function AIInvoiceImporter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOpen(true);
    setLoading(true);
    setStatus("processing");
    setMessage("Preparando arquivo e enviando para o armazenamento...");

    try {
      // 1. Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_original_invoice.${fileExt}`;
      const filePath = `purchases/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(filePath, file);

      if (uploadError) {
        throw new Error("Erro no upload do anexo: " + uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage
        .from("attachments")
        .getPublicUrl(filePath);

      const attachmentUrl = publicUrlData?.publicUrl || undefined;

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(",")[1];
        
        setMessage("A inteligência artificial está analisando a fatura...\nIsso pode levar alguns segundos.");
        
        try {
          const res = await fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file: base64Data,
              mimeType: file.type,
              purpose: "invoice",
              attachmentUrl,
            }),
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Erro ao processar documento.");
          }

          const data = await res.json();
          
          setStatus("success");
          setMessage(data.message || "Fatura importada com sucesso!");
          setLoading(false);
          
          // Refresh page data
          router.refresh();
        } catch (err: any) {
          console.error("Erro na importação da fatura:", err);
          setStatus("error");
          setMessage(err.message || "Desculpe, tivemos um problema ao processar seu documento. Verifique o arquivo e tente novamente.");
          setLoading(false);
        }
      };

      reader.onerror = () => {
        throw new Error("Erro ao ler o arquivo selecionado.");
      };
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Erro na preparação do arquivo.");
      setLoading(false);
    } finally {
      // Clear value so the user can select the same file again if they want
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleClose = () => {
    if (!loading) {
      setOpen(false);
    }
  };

  return (
    <>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="application/pdf,image/*"
        className="hidden"
      />

      {/* Trigger Button */}
      <button
        type="button"
        onClick={triggerFileSelect}
        className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px] md:h-[32px] px-6 md:px-4 text-[14px] md:text-[13px] flex items-center justify-center font-bold shadow-md cursor-pointer rounded-lg gap-2 active:scale-98 transition-all"
      >
        <Sparkles className="w-4 h-4 text-emerald-200 animate-pulse shrink-0" />
        Importar Fatura com IA
      </button>

      {/* Loading & Status Dialog */}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-[420px] p-6 rounded-2xl glass-pop-up border border-border shadow-2xl text-center flex flex-col items-center">
          
          {/* Header */}
          <DialogHeader className="w-full text-center space-y-1">
            <DialogTitle className="text-base font-bold flex items-center justify-center gap-2 text-foreground">
              {status === "processing" && (
                <>
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  Processando Fatura
                </>
              )}
              {status === "success" && (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-bounce" />
                  Importação Concluída
                </>
              )}
              {status === "error" && (
                <>
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  Falha no Processamento
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              {status === "processing" ? "O Aurelius ERP está extraindo os dados comerciais por IA." : "Resultado da operação"}
            </DialogDescription>
          </DialogHeader>

          {/* Body Content */}
          <div className="my-5 p-4 rounded-xl bg-muted/30 border border-border/50 w-full flex flex-col items-center">
            {status === "processing" && (
              <div className="relative w-12 h-12 flex items-center justify-center mb-3">
                <FileText className="w-8 h-8 text-primary animate-pulse" />
                <Sparkles className="w-4 h-4 text-emerald-500 absolute top-0 right-0 animate-bounce" />
              </div>
            )}
            
            <p className="text-xs text-foreground font-medium leading-relaxed whitespace-pre-line text-center">
              {message}
            </p>
          </div>

          {/* Footer Actions */}
          <div className="w-full flex justify-end">
            <button
              type="button"
              disabled={loading}
              onClick={() => setOpen(false)}
              className="w-full py-2 px-4 rounded-xl text-xs font-bold transition-all bg-muted hover:bg-muted/80 text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "processing" ? "Aguardando..." : "Fechar"}
            </button>
          </div>

        </DialogContent>
      </Dialog>
    </>
  );
}
