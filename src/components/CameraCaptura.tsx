"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, X, Check, Loader2 } from "lucide-react";

/**
 * Captura de fotografia para leitura de faturas.
 *
 * Existe porque o caso real é este: quem recebe a fatura tem-na em papel, na
 * mão, e o telemóvel no bolso. Obrigar a fotografar fora da aplicação, guardar
 * na galeria e depois procurá-la no seletor de ficheiros é três passos onde
 * devia ser um.
 *
 * Decisões que não são de estilo:
 *
 * - **Câmera traseira** (`facingMode: environment`): a da frente está focada
 *   para um rosto a 40 cm e não lê texto pequeno num papel.
 * - **Resolução alta pedida**: o modelo tem de ler números de fatura e valores.
 *   A resolução por omissão de muitos portáteis é 640×480, onde um "8.890" e
 *   um "8.890" borrado são indistinguíveis — e confundir isso num guarani
 *   desvaloriza o produto mil vezes.
 * - **Rever antes de enviar**: uma fotografia tremida custa uma chamada ao
 *   modelo e uma extração errada. Mais vale repetir aqui.
 * - **Parar as pistas ao fechar**: sem isso o indicador da câmera fica aceso
 *   depois de o utilizador fechar a janela, o que — com razão — assusta.
 *
 * Quando `getUserMedia` não existe (contexto não seguro, navegador antigo),
 * o chamador recorre a um `<input capture>`, que no telemóvel abre a câmera
 * nativa. Aqui recusamo-nos a fingir que funciona.
 */

type Props = {
  aberto: boolean;
  onFechar: () => void;
  /** Recebe a fotografia já como ficheiro, pronta para o mesmo caminho do anexo. */
  onCapturar: (ficheiro: File) => void;
  textos: {
    titulo: string;
    instrucao: string;
    tirar: string;
    repetir: string;
    usar: string;
    fechar: string;
    semPermissao: string;
    semCamera: string;
  };
};

export function CameraCaptura({ aberto, onFechar, onCapturar, textos }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aLigar, setALigar] = useState(false);
  const [previa, setPrevia] = useState<string | null>(null);

  const pararCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!aberto) {
      pararCamera();
      setPrevia(null);
      setErro(null);
      return;
    }

    let cancelado = false;

    (async () => {
      setALigar(true);
      setErro(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("indisponivel");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        if (cancelado) return;
        // Distinguir os dois casos importa: "negou a permissão" resolve-se nas
        // definições do navegador; "não há câmera" não se resolve de todo.
        const semPermissao =
          e?.name === "NotAllowedError" || e?.name === "SecurityError";
        setErro(semPermissao ? textos.semPermissao : textos.semCamera);
      } finally {
        if (!cancelado) setALigar(false);
      }
    })();

    return () => {
      cancelado = true;
      pararCamera();
    };
  }, [aberto, pararCamera, textos.semPermissao, textos.semCamera]);

  function tirar() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    // 0.92: o suficiente para o texto da fatura aguentar a compressão sem
    // fazer do anexo um ficheiro de vários megabytes.
    setPrevia(canvas.toDataURL("image/jpeg", 0.92));
  }

  async function usar() {
    if (!previa) return;
    const blob = await (await fetch(previa)).blob();
    const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    onCapturar(new File([blob], `fatura-${carimbo}.jpg`, { type: "image/jpeg" }));
    onFechar();
  }

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-bold text-foreground flex items-center gap-2">
            <Camera className="w-4 h-4" />
            {textos.titulo}
          </span>
          <button
            type="button"
            onClick={onFechar}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            aria-label={textos.fechar}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative bg-black aspect-[4/3] flex items-center justify-center">
          {erro ? (
            <p className="text-sm text-white/80 text-center px-6">{erro}</p>
          ) : previa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previa} alt="" className="w-full h-full object-contain" />
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-contain"
              />
              {aLigar && (
                <Loader2 className="absolute w-6 h-6 animate-spin text-white/80" />
              )}
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border">
          {!erro && (
            <p className="text-[11px] text-muted-foreground mb-3 text-center">
              {textos.instrucao}
            </p>
          )}
          <div className="flex gap-2 justify-center">
            {previa ? (
              <>
                <button
                  type="button"
                  onClick={() => setPrevia(null)}
                  className="flex items-center gap-2 px-4 h-10 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-muted transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  {textos.repetir}
                </button>
                <button
                  type="button"
                  onClick={usar}
                  className="flex items-center gap-2 px-5 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all"
                >
                  <Check className="w-4 h-4" />
                  {textos.usar}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={tirar}
                disabled={!!erro || aLigar}
                className="flex items-center gap-2 px-5 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                {textos.tirar}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
