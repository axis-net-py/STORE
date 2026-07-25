"use client";

import { Wrench, Fuel, Gauge } from "lucide-react";
import { VehicleLogSheet } from "@/modules/farm/components/VehicleLogSheet";
import type { VehicleLog, Employee } from "@prisma/client";
import { useLanguage } from "@/components/language-provider";

type LogWithEmployee = VehicleLog & { employee: { id: string; name: string } | null };

const STRINGS = {
  pt: {
    avgConsumption: "Consumo Médio",
    noLogs: "Nenhum registro de manutenção ou abastecimento ainda.",
    fuel: "Abastecimento",
    maintenance: "Manutenção",
    reading: "Leitura",
    cost: "Custo",
    by: "Por",
  },
  es: {
    avgConsumption: "Consumo Promedio",
    noLogs: "Aún no hay registros de mantenimiento o abastecimiento.",
    fuel: "Abastecimiento",
    maintenance: "Mantenimiento",
    reading: "Lectura",
    cost: "Costo",
    by: "Por",
  },
} as const;

function formatDate(date: Date | string, language: "pt" | "es") {
  return new Date(date).toLocaleDateString(language === "es" ? "es-PY" : "pt-BR", { timeZone: "UTC" });
}

export function VehicleTimeline({
  vehicleId,
  logs,
  employees,
  consumption,
}: {
  vehicleId: string;
  logs: LogWithEmployee[];
  employees: Employee[];
  consumption: { average: number | null; unit: "h" | "km" };
}) {
  const { language } = useLanguage();
  const s = STRINGS[language];
  return (
    <div className="space-y-4">
      {consumption.average !== null && (
        <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
          <Gauge className="w-5 h-5 text-primary" />
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">{s.avgConsumption}</div>
            <div className="text-lg font-bold text-foreground">
              {consumption.average.toLocaleString(undefined, { maximumFractionDigits: 2 })} L/{consumption.unit}
            </div>
          </div>
        </div>
      )}

      {logs.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          {s.noLogs}
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <VehicleLogSheet
              key={log.id}
              vehicleId={vehicleId}
              employees={employees}
              log={log}
              trigger={
                <button className="w-full text-left rounded-lg border border-border bg-card p-4 hover-lift flex items-start gap-3">
                  <div
                    className={
                      log.type === "FUEL"
                        ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
                    }
                  >
                    {log.type === "FUEL" ? <Fuel className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground text-sm">
                        {log.type === "FUEL" ? s.fuel : log.description || s.maintenance}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">{formatDate(log.date, language)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                      {log.odometerOrHours != null && <span>{s.reading}: {Number(log.odometerOrHours).toLocaleString()}</span>}
                      {log.type === "FUEL" && log.liters != null && <span>{Number(log.liters).toLocaleString()} L</span>}
                      {log.type === "FUEL" && log.fuelCost != null && <span>{s.cost}: {Number(log.fuelCost).toLocaleString()}</span>}
                      {log.type === "MAINTENANCE" && log.maintenanceCost != null && (
                        <span>{s.cost}: {Number(log.maintenanceCost).toLocaleString()}</span>
                      )}
                      {log.employee && <span>{s.by}: {log.employee.name}</span>}
                    </div>
                    {log.notes && <div className="text-xs text-muted-foreground mt-1 italic">{log.notes}</div>}
                  </div>
                </button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
