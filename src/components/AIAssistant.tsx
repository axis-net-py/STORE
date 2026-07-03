"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  X,
  Mic,
  MicOff,
  Image as ImageIcon,
  Send,
  Loader2,
  Sparkles,
  Bot,
  User,
  AlertCircle,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Message {
  sender: "user" | "bot";
  text: string;
  isDiagnostic?: boolean;
  options?: { label: string; value: string }[];
  filePending?: { base64: string; mimeType: string; fileName: string; attachmentUrl?: string };
}

export function AIAssistant({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Olá! Sou o Assistente COOPER IA. Posso executar ações em todos os módulos por texto ou voz:\n• 'cadastrar produto Teclado com preço 150000 e custo 100000'\n• 'cadastrar cliente Roberto Silva' / 'fornecedor Distribuidora Asunción'\n• 'venda de 10 sacas de soja para o cliente Cooperativa a 300000 cada'\n• 'pedido de compra de 50 kg de adubo do fornecedor AgroSur'\n• 'recebi 500000 do cliente Roberto' (baixa no financeiro)\n• 'ajustar estoque do produto Soja, entrada de 100 sacas'\n• 'transferir 20 sacas de soja do depósito Principal para a Filial'\n\nOu envie foto/PDF de fatura de compra que eu cadastro tudo automaticamente — fornecedor, produtos, estoque e contabilidade, sem duplicar registros.",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Speech Recognition Setup
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "pt-BR";

        rec.onstart = () => {
          setIsRecording(true);
        };

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText(transcript);
        };

        rec.onerror = (event: any) => {
          console.error("Erro no reconhecimento de voz:", event.error);
          setIsRecording(false);
        };

        rec.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Reconhecimento de voz não suportado neste navegador.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const userText = inputText;
    setInputText("");
    setMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userText }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro de resposta da IA");

      setMessages((prev) => [...prev, { sender: "bot", text: data.message }]);
      
      // If it created a database record, refresh the page content
      if (data.action && data.action !== "chat") {
        router.refresh();
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: err.message || "Desculpe, tive um problema ao processar seu comando." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileLabel = file.type === "application/pdf" ? "PDF" : "Imagem";
    const fileName = file.name;

    setLoading(true);

    try {
      // 1. Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileNameUnique = `${Date.now()}_original_invoice.${fileExt}`;
      const filePath = `purchases/${fileNameUnique}`;

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
        const filePending = { base64: base64Data, mimeType: file.type, fileName, attachmentUrl };
        
        setMessages((prev) => [
          ...prev,
          { sender: "user", text: `[${fileLabel} Enviado: ${fileName}]` },
          {
            sender: "bot",
            text: `Processando o arquivo "${fileName}" como fatura de compra por IA...`,
          },
        ]);
        
        await handleOptionSelect("invoice", filePending);
      };
    } catch (error: any) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: `Erro ao preparar arquivo: ${error.message || "Desculpe, tive um problema ao salvar seu documento."}` },
      ]);
      setLoading(false);
    }
    
    if (e.target) e.target.value = "";
  };

  const handleOptionSelect = async (
    purpose: string,
    filePending?: { base64: string; mimeType: string; fileName: string; attachmentUrl?: string }
  ) => {
    if (!filePending) return;

    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: filePending.base64,
          mimeType: filePending.mimeType,
          purpose: purpose,
          attachmentUrl: filePending.attachmentUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao importar fatura por IA");

      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: data.message, isDiagnostic: false },
      ]);

      router.refresh();
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: err.message || "Erro ao processar e cadastrar a fatura enviada. Verifique o arquivo e tente novamente.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const triggerImageSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-6 right-6 z-50 no-print">
      {/* Floating expanded chat box */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-[calc(100vw-3rem)] sm:w-[380px] h-[500px] max-h-[calc(100dvh-12rem)] rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden transition-all duration-300 transform scale-100 origin-bottom-right">
          {/* Header */}
          <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              <div>
                <h3 className="text-sm font-bold text-foreground">COOPER IA</h3>
                <span className="text-[9px] font-semibold text-blue-500 uppercase tracking-widest">Online</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground rounded-lg p-1 hover:bg-muted transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-2.5 items-start ${
                  msg.sender === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${
                    msg.sender === "user"
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {msg.sender === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div
                  className={`max-w-[75%] rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed shadow-sm ${
                    msg.sender === "user"
                      ? "bg-primary/10 border border-primary/20 text-foreground font-medium"
                      : msg.isDiagnostic
                      ? "bg-blue-950/20 border border-blue-800/30 text-foreground"
                      : "bg-muted/40 border border-border text-foreground/90"
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>
                  {msg.options && (
                    <div className="mt-2.5 flex flex-col gap-1.5 pt-2.5 border-t border-border/40">
                      {msg.options.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleOptionSelect(opt.value, msg.filePending)}
                          className="w-full text-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all active:scale-[0.98] shadow-sm"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-muted/40 border border-border rounded-xl px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Analisando...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer input form */}
          <form onSubmit={handleSendText} className="p-3 border-t border-border bg-muted/20 flex gap-2 items-center">
            {/* Hidden File Input */}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />

            {/* Upload Image Button */}
            <button
              type="button"
              onClick={triggerImageSelect}
              className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all shrink-0"
              title="Enviar Arquivo (Fatura ou Folha)"
            >
              <ImageIcon className="w-4.5 h-4.5" />
            </button>

            {/* Voice Input Button */}
            <button
              type="button"
              onClick={toggleRecording}
              className={`p-2 rounded-lg transition-all shrink-0 ${
                isRecording
                  ? "bg-rose-600 text-white animate-pulse"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title="Digitar por voz"
            >
              {isRecording ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Digite ou fale um comando..."
              className="flex-1 bg-background border border-border h-9 rounded-lg px-3 text-[12.5px] font-medium focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="p-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg disabled:opacity-50 transition-all shrink-0"
            >
              <Send className="w-4.5 h-4.5" />
            </button>
          </form>
        </div>
      )}

      {/* Floating circular toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 active:scale-95 text-white ${
          isOpen
            ? "bg-slate-800 hover:bg-slate-700 hover:rotate-90"
            : "bg-gradient-to-tr from-blue-600 to-sky-500 hover:shadow-blue-950/20 hover:scale-105"
        }`}
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5.5 h-5.5 animate-pulse" />}
      </button>
    </div>
  );
}
