"use client";

import { Sprout, Trash2 } from "lucide-react";
import { deletePlotApplication } from "@/modules/farm/actions/plotApplication";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlotApplication } from "@prisma/client";
import { useLanguage } from "@/components/language-provider";

type ApplicationWithRelations = PlotApplication & {
  product: { id: string; name: string; unit: string };
  employee: { id: string; name: string } | null;
};

const STRINGS = {
  pt: {
    deleteConfirm: "Excluir esta aplicação? O estoque do insumo será estornado. Esta ação não pode ser desfeita.",
    deleteErr: "Erro ao excluir aplicação",
    empty: "Nenhuma aplicação registrada ainda.",
    cost: "Custo",
    by: "Por",
    delete: "Excluir",
  },
  es: {
    deleteConfirm: "¿Eliminar esta aplicación? El stock del insumo será revertido. Esta acción no se puede deshacer.",
    deleteErr: "Error al eliminar la aplicación",
    empty: "Aún no hay aplicaciones registradas.",
    cost: "Costo",
    by: "Por",
    delete: "Eliminar",
  },
} as const;

function formatDate(date: Date | string, language: "pt" | "es") {
  return new Date(date).toLocaleDateString(language === "es" ? "es-PY" : "pt-BR", { timeZone: "UTC" });
}

export function PlotApplicationTimeline({ applications }: { applications: ApplicationWithRelations[] }) {
  const router = useRouter();
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    const confirmed = window.confirm(s.deleteConfirm);
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await deletePlotApplication(id);
      router.refresh();
    } catch (err: any) {
      alert(err.message || s.deleteErr);
    } finally {
      setDeletingId(null);
    }
  }

  if (applications.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-sm">
        {s.empty}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {applications.map((app) => (
        <div key={app.id} className="rounded-lg border border-border bg-card p-4 hover-lift flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Sprout className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-foreground text-sm">{app.product.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{formatDate(app.date, language)}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
              <span>{Number(app.quantity).toLocaleString()} {app.product.unit}</span>
              {app.totalCost != null && <span>{s.cost}: {Number(app.totalCost).toLocaleString()}</span>}
              {app.employee && <span>{s.by}: {app.employee.name}</span>}
            </div>
            {app.notes && <div className="text-xs text-muted-foreground mt-1 italic">{app.notes}</div>}
          </div>
          <button
            type="button"
            onClick={() => handleDelete(app.id)}
            disabled={deletingId === app.id}
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
