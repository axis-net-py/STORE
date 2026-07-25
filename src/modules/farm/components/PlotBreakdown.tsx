'use client';

import { Geist_Mono } from 'next/font/google';
import { useQuery } from '@tanstack/react-query';
import { getPlotsBreakdown } from '@/modules/farm/lib-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Map, Sprout, Hammer, Compass } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

const geistMono = Geist_Mono({ subsets: ['latin'] });

const STRINGS = {
  pt: {
    title: 'Distribuição de Cultivos & Status de Áreas',
    error: 'Erro ao carregar análise de talhões.',
    empty: 'Nenhum talhão cadastrado para análise.',
    cropDistribution: 'Distribuição de Cultivos',
    total: 'Total',
    statusPlanted: 'Cultivado',
    statusPreparing: 'Preparação',
    statusFallow: 'Pousio',
    plotStatus: 'Status dos Talhões',
  },
  es: {
    title: 'Distribución de Cultivos y Estado de Áreas',
    error: 'Error al cargar el análisis de parcelas.',
    empty: 'No hay parcelas registradas para análisis.',
    cropDistribution: 'Distribución de Cultivos',
    total: 'Total',
    statusPlanted: 'Cultivado',
    statusPreparing: 'Preparación',
    statusFallow: 'Barbecho',
    plotStatus: 'Estado de las Parcelas',
  },
} as const;

const cropColors: Record<string, { bg: string; fill: string; text: string }> = {
  soja: { bg: 'bg-amber-500/10', fill: 'bg-amber-500', text: 'text-amber-500' },
  milho: { bg: 'bg-yellow-500/10', fill: 'bg-yellow-500', text: 'text-yellow-600' },
  trigo: { bg: 'bg-orange-400/10', fill: 'bg-orange-400', text: 'text-orange-400' },
  pousio: { bg: 'bg-slate-500/10', fill: 'bg-slate-400', text: 'text-slate-400' },
  preparação: { bg: 'bg-teal-500/10', fill: 'bg-teal-400', text: 'text-teal-400' },
};

const defaultCropColor = { bg: 'bg-emerald-500/10', fill: 'bg-emerald-500', text: 'text-emerald-500' };

export function PlotBreakdown() {
  const { language } = useLanguage();
  const s = STRINGS[language];
  const { data, isLoading, error } = useQuery({
    queryKey: ['plotsBreakdown'],
    queryFn: getPlotsBreakdown,
  });

  if (isLoading) {
    return (
      <Card className="border border-border bg-card/45 backdrop-blur-md shadow-sm border-l-4 border-l-amber-500/80">
        <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border border-border bg-card/45 backdrop-blur-md shadow-sm border-l-4 border-l-rose-500/80 p-6 text-destructive text-sm">
        {s.error}
      </Card>
    );
  }

  const { byStatus = [], byCrop = [] } = data || {};
  const totalHectares = byCrop.reduce((sum, item) => sum + item.area, 0);

  const getCropStyle = (cropName: string) => {
    return cropColors[cropName.toLowerCase()] || defaultCropColor;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'PLANTED') return <Sprout className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (status === 'PREPARING') return <Hammer className="w-4 h-4 text-teal-400 shrink-0" />;
    return <Compass className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'PLANTED') return s.statusPlanted;
    if (status === 'PREPARING') return s.statusPreparing;
    return s.statusFallow;
  };

  const getStatusColor = (status: string) => {
    if (status === 'PLANTED') return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (status === 'PREPARING') return 'text-teal-400 bg-teal-500/10 border-teal-500/20';
    return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
  };

  return (
    <Card className="border border-border bg-card/45 backdrop-blur-md shadow-sm transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-md cursor-default border-l-4 border-l-amber-500/80 group">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
          {s.title}
        </CardTitle>
        <Map className="h-4 w-4 text-amber-500 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
      </CardHeader>
      <CardContent>
        {byCrop.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground font-medium">
            {s.empty}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Crops Distribution Progress Bars */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{s.cropDistribution}</h4>
                <span className={`text-[10px] font-bold text-muted-foreground ${geistMono.className}`}>
                  {s.total}: {totalHectares.toFixed(1)} ha
                </span>
              </div>
              {byCrop.map((c) => {
                const pct = totalHectares > 0 ? (c.area / totalHectares) * 100 : 0;
                const style = getCropStyle(c.crop);
                return (
                  <div key={c.crop} className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-medium">
                      <span className="capitalize font-semibold text-foreground/80 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${style.fill}`} />
                        {c.crop}
                      </span>
                      <span className={`${geistMono.className} text-muted-foreground text-[11px]`}>
                        {c.area.toFixed(1)} ha ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${style.fill} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Status Grid Cards */}
            <div className="pt-2">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{s.plotStatus}</h4>
              <div className="grid grid-cols-3 gap-2">
                {byStatus.map((s) => (
                  <div
                    key={s.status}
                    className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center transition-all hover:bg-muted/10 ${getStatusColor(s.status)}`}
                  >
                    {getStatusIcon(s.status)}
                    <span className="text-[10px] font-bold uppercase tracking-wider mt-1.5 truncate max-w-full">
                      {getStatusLabel(s.status)}
                    </span>
                    <span className={`text-xs font-extrabold ${geistMono.className} mt-0.5`}>
                      {s.area.toFixed(1)} ha
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}
