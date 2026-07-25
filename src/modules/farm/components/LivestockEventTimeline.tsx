"use client";

import { Scale, Syringe, MapPinned, Trash2 } from "lucide-react";
import { deleteLivestockEvent } from "@/modules/farm/actions/livestockEvent";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LivestockEvent } from "@prisma/client";
import { useLanguage } from "@/components/language-provider";

type EventWithEmployee = LivestockEvent & { employee: { id: string; name: string } | null };

const STRINGS = {
  pt: {
    weighing: "Pesagem",
    health: "Sanidade",
    movement: "Movimentação",
    location: "Piquete",
    by: "Por",
    empty: "Nenhum evento registrado ainda.",
    deleteConfirm: "Excluir este evento? Esta ação não pode ser desfeita.",
    deleteErr: "Erro ao excluir evento",
    delete: "Excluir",
    dateLocale: "pt-BR",
  },
  es: {
    weighing: "Pesaje",
    health: "Sanidad",
    movement: "Movimiento",
    location: "Potrero",
    by: "Por",
    empty: "Aún no hay eventos registrados.",
    deleteConfirm: "¿Eliminar este evento? Esta acción no se puede deshacer.",
    deleteErr: "Error al eliminar evento",
    delete: "Eliminar",
    dateLocale: "es-PY",
  },
} as const;

function formatDate(date: Date | string, locale: string) {
  return new Date(date).toLocaleDateString(locale, { timeZone: "UTC" });
}

const iconMap = { WEIGHING: Scale, HEALTH: Syringe, MOVEMENT: MapPinned };
const colorMap = {
  WEIGHING: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  HEALTH: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  MOVEMENT: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

export function LivestockEventTimeline({ events }: { events: EventWithEmployee[] }) {
  const router = useRouter();
  const { language } = useLanguage();
  const s = STRINGS[language];
  const labelMap = { WEIGHING: s.weighing, HEALTH: s.health, MOVEMENT: s.movement };
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    const confirmed = window.confirm(s.deleteConfirm);
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await deleteLivestockEvent(id);
      router.refresh();
    } catch (err: any) {
      alert(err.message || s.deleteErr);
    } finally {
      setDeletingId(null);
    }
  }

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-sm">
        {s.empty}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const Icon = iconMap[event.type];
        return (
          <div key={event.id} className="rounded-lg border border-border bg-card p-4 hover-lift flex items-start gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colorMap[event.type]}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground text-sm">{labelMap[event.type]}</span>
                <span className="text-xs text-muted-foreground shrink-0">{formatDate(event.date, s.dateLocale)}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                {event.weight != null && <span>{Number(event.weight).toLocaleString()} kg</span>}
                {event.location && <span>{s.location}: {event.location}</span>}
                {event.description && <span>{event.description}</span>}
                {event.employee && <span>{s.by}: {event.employee.name}</span>}
              </div>
              {event.notes && <div className="text-xs text-muted-foreground mt-1 italic">{event.notes}</div>}
            </div>
            <button
              type="button"
              onClick={() => handleDelete(event.id)}
              disabled={deletingId === event.id}
              className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              title={s.delete}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
