"use client";

import { ArrowDownToLine, ArrowUpFromLine, Trash2 } from "lucide-react";
import { deleteSiloMovement } from "@/modules/farm/actions/siloMovement";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SiloMovement } from "@prisma/client";
import { useLanguage } from "@/components/language-provider";

type MovementWithRelations = SiloMovement & {
  harvest: { id: string; name: string } | null;
  contract: { id: string; contractNumber: string } | null;
};

const STRINGS = {
  pt: {
    empty: "Nenhum movimento registrado ainda.",
    in: "Entrada",
    out: "Saída",
    harvest: "Safra",
    contract: "Contrato",
    moisture: "Umidade",
    deleteConfirm: "Excluir este movimento? O estoque do silo será ajustado de volta. Esta ação não pode ser desfeita.",
    deleteErr: "Erro ao excluir movimento",
    deleteTitle: "Excluir",
  },
  es: {
    empty: "Ningún movimiento registrado todavía.",
    in: "Entrada",
    out: "Salida",
    harvest: "Cosecha",
    contract: "Contrato",
    moisture: "Humedad",
    deleteConfirm: "¿Eliminar este movimiento? El stock del silo será ajustado de vuelta. Esta acción no se puede deshacer.",
    deleteErr: "Error al eliminar movimiento",
    deleteTitle: "Eliminar",
  },
} as const;

function formatDate(date: Date | string, language: "pt" | "es") {
  return new Date(date).toLocaleDateString(language === "pt" ? "pt-BR" : "es-PY", { timeZone: "UTC" });
}

export function SiloMovementTimeline({ movements, unit }: { movements: MovementWithRelations[]; unit: string }) {
  const router = useRouter();
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    const confirmed = window.confirm(s.deleteConfirm);
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await deleteSiloMovement(id);
      router.refresh();
    } catch (err: any) {
      alert(err.message || s.deleteErr);
    } finally {
      setDeletingId(null);
    }
  }

  if (movements.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-sm">
        {s.empty}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {movements.map((m) => (
        <div key={m.id} className="rounded-lg border border-border bg-card p-4 hover-lift flex items-start gap-3">
          <div
            className={
              m.type === "IN"
                ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"
            }
          >
            {m.type === "IN" ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-foreground text-sm">
                {m.type === "IN" ? s.in : s.out} · {Number(m.quantity).toLocaleString()} {unit}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">{formatDate(m.date, language)}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
              {m.harvest && <span>{s.harvest}: {m.harvest.name}</span>}
              {m.contract && <span>{s.contract}: {m.contract.contractNumber}</span>}
              {m.moisture != null && <span>{s.moisture}: {Number(m.moisture).toLocaleString()}%</span>}
              {m.qualityGrade && <span>{m.qualityGrade}</span>}
            </div>
            {m.notes && <div className="text-xs text-muted-foreground mt-1 italic">{m.notes}</div>}
          </div>
          <button
            type="button"
            onClick={() => handleDelete(m.id)}
            disabled={deletingId === m.id}
            className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            title={s.deleteTitle}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
