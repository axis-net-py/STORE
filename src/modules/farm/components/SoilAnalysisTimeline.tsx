"use client";

import { FlaskConical, Trash2 } from "lucide-react";
import { deleteSoilAnalysis } from "@/modules/farm/actions/soilAnalysis";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SoilAnalysis } from "@prisma/client";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    title: "Análise de Solo",
    deleteConfirm: "Excluir esta análise de solo? Esta ação não pode ser desfeita.",
    deleteErr: "Erro ao excluir análise",
    empty: "Nenhuma análise de solo registrada ainda.",
    recommendation: "Recomendação",
    delete: "Excluir",
  },
  es: {
    title: "Análisis de Suelo",
    deleteConfirm: "¿Eliminar este análisis de suelo? Esta acción no se puede deshacer.",
    deleteErr: "Error al eliminar el análisis",
    empty: "Aún no hay análisis de suelo registrados.",
    recommendation: "Recomendación",
    delete: "Eliminar",
  },
} as const;

function formatDate(date: Date | string, language: "pt" | "es") {
  return new Date(date).toLocaleDateString(language === "es" ? "es-PY" : "pt-BR", { timeZone: "UTC" });
}

export function SoilAnalysisTimeline({ analyses }: { analyses: SoilAnalysis[] }) {
  const router = useRouter();
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    const confirmed = window.confirm(s.deleteConfirm);
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await deleteSoilAnalysis(id);
      router.refresh();
    } catch (err: any) {
      alert(err.message || s.deleteErr);
    } finally {
      setDeletingId(null);
    }
  }

  if (analyses.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-sm">
        {s.empty}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {analyses.map((a) => (
        <div key={a.id} className="rounded-lg border border-border bg-card p-4 hover-lift flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400">
            <FlaskConical className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-foreground text-sm">{s.title}</span>
              <span className="text-xs text-muted-foreground shrink-0">{formatDate(a.date, language)}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
              {a.ph != null && <span>pH: {Number(a.ph).toFixed(2)}</span>}
              {a.phosphorus != null && <span>P: {Number(a.phosphorus).toLocaleString()} mg/dm³</span>}
              {a.potassium != null && <span>K: {Number(a.potassium).toLocaleString()} cmolc/dm³</span>}
              {a.organicMatter != null && <span>M.O.: {Number(a.organicMatter).toLocaleString()}%</span>}
            </div>
            {a.recommendation && (
              <div className="text-xs text-foreground mt-1.5 bg-muted/50 rounded px-2 py-1.5">
                <span className="font-semibold">{s.recommendation}: </span>
                {a.recommendation}
              </div>
            )}
            {a.notes && <div className="text-xs text-muted-foreground mt-1 italic">{a.notes}</div>}
          </div>
          <button
            type="button"
            onClick={() => handleDelete(a.id)}
            disabled={deletingId === a.id}
            className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            title={s.delete}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
