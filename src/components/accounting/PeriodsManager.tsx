"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getPeriods, closePeriod, reopenPeriod, type PeriodInfo } from "@/app/actions/periods";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/language-provider";
import { toast } from "sonner";
import { Lock, LockOpen, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const monthNames = {
  pt: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
  es: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
};

const texts = {
  pt: {
    title: "Fechamento de Períodos",
    subtitle: "Meses fechados não aceitam novos lançamentos, edições ou estornos.",
    open: "Aberto",
    closed: "Fechado",
    close: "Fechar",
    reopen: "Reabrir",
    current: "Mês atual",
    closedOk: "Período fechado",
    reopenedOk: "Período reaberto",
    confirmClose: "Fechar este período? Nenhum lançamento poderá ser feito nesse mês até que seja reaberto.",
  },
  es: {
    title: "Cierre de Períodos",
    subtitle: "Meses cerrados no aceptan nuevos asientos, ediciones ni reversiones.",
    open: "Abierto",
    closed: "Cerrado",
    close: "Cerrar",
    reopen: "Reabrir",
    current: "Mes actual",
    closedOk: "Período cerrado",
    reopenedOk: "Período reabierto",
    confirmClose: "¿Cerrar este período? Ningún asiento podrá registrarse en ese mes hasta que sea reabierto.",
  },
};

export default function PeriodsManager() {
  const { language } = useLanguage();
  const t = texts[language as "pt" | "es"] || texts.pt;
  const months = monthNames[language as "pt" | "es"] || monthNames.pt;

  const [periods, setPeriods] = useState<PeriodInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPeriods(await getPeriods());
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar períodos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const now = new Date();
  const isCurrent = (p: PeriodInfo) => p.year === now.getFullYear() && p.month === now.getMonth() + 1;

  const handleToggle = async (p: PeriodInfo) => {
    const key = `${p.year}-${p.month}`;
    if (!p.closed && !window.confirm(t.confirmClose)) return;
    setBusy(key);
    try {
      if (p.closed) {
        await reopenPeriod(p.year, p.month);
        toast.success(t.reopenedOk);
      } else {
        await closePeriod(p.year, p.month);
        toast.success(t.closedOk);
      }
      load();
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="rounded-xl border border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-[14px] font-bold text-foreground/80 flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-primary" />
          {t.title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t.subtitle}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[76px] rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {periods.map((p) => {
              const key = `${p.year}-${p.month}`;
              const current = isCurrent(p);
              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-lg border p-3 flex flex-col gap-2",
                    p.closed ? "border-rose-500/30 bg-rose-500/5" : "border-border bg-muted/20"
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-semibold">
                      {months[p.month - 1]}/{p.year}
                    </span>
                    <Badge
                      variant={p.closed ? "destructive" : "secondary"}
                      className="text-[10px] shrink-0"
                    >
                      {p.closed ? t.closed : current ? t.current : t.open}
                    </Badge>
                  </div>
                  {!current && (
                    <Button
                      size="sm"
                      variant={p.closed ? "outline" : "default"}
                      className="h-9 w-full"
                      disabled={busy === key}
                      onClick={() => handleToggle(p)}
                    >
                      {p.closed ? (
                        <>
                          <LockOpen className="h-3.5 w-3.5 mr-1" />
                          {t.reopen}
                        </>
                      ) : (
                        <>
                          <Lock className="h-3.5 w-3.5 mr-1" />
                          {t.close}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
