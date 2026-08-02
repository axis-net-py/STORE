"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Palette } from "lucide-react";
import { getAcento, setAcento } from "@/app/actions/aparencia";
import { ACENTOS, type Acento } from "@/lib/tema";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

/**
 * Cores do design system.
 *
 * Cada opção mostra a paleta real, não um quadrado de cor: quem escolhe está a
 * decidir o aspeto de toda a aplicação, e o que interessa ver é como ficam o
 * fundo, o cartão e a cor de ação juntos.
 */

const TEXTOS = {
  pt: {
    title: "Aparência",
    description:
      "A cor do sistema para toda a equipa. Por omissão é a do seu ramo de atividade; aqui pode trocá-la.",
    origem: "Cor de origem do seu ramo",
    aplicando: "Aplicando...",
    sucesso: "Cor atualizada.",
    erro: "Não foi possível alterar a cor.",
    nota: "O tema claro e escuro continua a alternar no botão da barra lateral. Estas cores valem para os dois.",
    cores: {
      blue: { nome: "Azul", nota: "Comércio" },
      green: { nome: "Verde", nota: "Agronegócio" },
      red: { nome: "Vermelho", nota: "Alimentação" },
      offwhite: { nome: "Offwhite", nota: "Saúde" },
    },
  },
  es: {
    title: "Apariencia",
    description:
      "El color del sistema para todo el equipo. Por defecto es el de su rubro; aquí puede cambiarlo.",
    origem: "Color de origen de su rubro",
    aplicando: "Aplicando...",
    sucesso: "Color actualizado.",
    erro: "No se pudo cambiar el color.",
    nota: "El tema claro y oscuro se sigue alternando en el botón de la barra lateral. Estos colores valen para ambos.",
    cores: {
      blue: { nome: "Azul", nota: "Comercio" },
      green: { nome: "Verde", nota: "Agronegocio" },
      red: { nome: "Rojo", nota: "Alimentación" },
      offwhite: { nome: "Offwhite", nota: "Salud" },
    },
  },
} as const;

export default function AparenciaPage() {
  const { language } = useLanguage();
  const t = TEXTOS[language === "es" ? "es" : "pt"];
  const router = useRouter();

  const [atual, setAtual] = useState<Acento | null>(null);
  const [aPedir, setAPedir] = useState<Acento | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    getAcento()
      .then(setAtual)
      .catch(() => setAtual("blue"));
  }, []);

  async function escolher(cor: Acento) {
    if (cor === atual || aPedir) return;
    setAPedir(cor);
    try {
      await setAcento(cor);
      setAtual(cor);
      toast.success(t.sucesso);
      // O acento vive no layout do painel: sem refresh, a barra lateral e o
      // resto só mudariam na navegação seguinte.
      startTransition(() => router.refresh());
    } catch {
      toast.error(t.erro);
    } finally {
      setAPedir(null);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-serif font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Palette className="h-5 w-5" />
          {t.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ACENTOS.map((cor) => {
          const info = t.cores[cor];
          const ativa = atual === cor;
          const aCarregar = aPedir === cor;

          return (
            <button
              key={cor}
              type="button"
              onClick={() => escolher(cor)}
              disabled={!!aPedir}
              aria-pressed={ativa}
              className={cn(
                "text-left rounded-xl border p-4 transition-all disabled:opacity-60",
                ativa
                  ? "border-ring ring-2 ring-ring/25"
                  : "border-border hover:border-ring/50 cursor-pointer"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm font-bold text-foreground">{info.nome}</span>
                  <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
                    {info.nota}
                  </span>
                </div>
                {aCarregar ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : ativa ? (
                  <Check className="h-4 w-4 text-ring" />
                ) : null}
              </div>

              {/* Amostra da paleta real: o data-accent faz as variáveis desta
                  caixa serem as da cor em questão, mesmo não estando aplicada. */}
              <div
                data-accent={cor}
                className="rounded-lg border border-border bg-background p-3 flex items-center gap-2"
              >
                <span className="h-8 w-8 rounded-md bg-sidebar shrink-0" />
                <span className="h-8 flex-1 rounded-md bg-card border border-border" />
                <span className="h-8 w-14 rounded-md bg-primary shrink-0" />
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-4">{t.nota}</p>
    </div>
  );
}
