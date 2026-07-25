'use client';

import { Geist_Mono } from 'next/font/google';
import { useQuery } from '@tanstack/react-query';
import { getRecentContracts } from '@/modules/farm/lib-dashboard';
import { formatCurrency } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Handshake, Calendar, Landmark } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

const geistMono = Geist_Mono({ subsets: ['latin'] });

interface RecentContractsProps {
  limit?: number;
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  COMPLETED: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  CANCELLED: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
};

const STRINGS = {
  pt: {
    error: 'Erro ao carregar contratos recentes.',
    title: 'Contratos Recentes (Venda de Grãos)',
    empty: 'Nenhum contrato cadastrado recentemente.',
    colNumberHarvest: 'Nro / Safra',
    colSilo: 'Silo (Comprador)',
    colQtyGrain: 'Qtd / Grão',
    colStatus: 'Status',
    noHarvest: 'Sem safra',
    statusLabels: { ACTIVE: 'Ativo', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' } as Record<string, string>,
  },
  es: {
    error: 'Error al cargar contratos recientes.',
    title: 'Contratos Recientes (Venta de Granos)',
    empty: 'No hay contratos registrados recientemente.',
    colNumberHarvest: 'N.º / Cosecha',
    colSilo: 'Silo (Comprador)',
    colQtyGrain: 'Cant. / Grano',
    colStatus: 'Estado',
    noHarvest: 'Sin cosecha',
    statusLabels: { ACTIVE: 'Activo', COMPLETED: 'Completado', CANCELLED: 'Cancelado' } as Record<string, string>,
  },
} as const;

export function RecentContracts({ limit = 5 }: RecentContractsProps) {
  const { language } = useLanguage();
  const s = STRINGS[language];
  const { data, isLoading, error } = useQuery({
    queryKey: ['recentContracts', limit],
    queryFn: () => getRecentContracts(limit),
  });

  if (isLoading) {
    return (
      <Card className="border border-border bg-card/45 backdrop-blur-md shadow-sm border-l-4 border-l-emerald-500/80">
        <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-full animate-pulse" />
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

  const contracts = data || [];

  return (
    <Card className="border border-border bg-card/45 backdrop-blur-md shadow-sm transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-md cursor-default border-l-4 border-l-emerald-500/80 group">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
          {s.title}
        </CardTitle>
        <Handshake className="h-4 w-4 text-emerald-500 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
      </CardHeader>
      <CardContent>
        {contracts.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground font-medium">
            {s.empty}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 pb-2 border-b border-border/80 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              <div className="col-span-3">{s.colNumberHarvest}</div>
              <div className="col-span-3">{s.colSilo}</div>
              <div className="col-span-3 text-right">{s.colQtyGrain}</div>
              <div className="col-span-3 text-right">{s.colStatus}</div>
            </div>

            {contracts.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-12 gap-2 py-3 border-b border-border/40 text-xs items-center hover:bg-muted/10 transition-colors"
              >
                <div className="col-span-3">
                  <div className="font-bold text-foreground">{c.contractNumber}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    {c.harvest?.name || s.noHarvest}
                  </div>
                </div>
                <div className="col-span-3 flex items-center gap-1.5 font-semibold text-foreground/90">
                  <Landmark className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{c.siloName}</span>
                </div>
                <div className="col-span-3 text-right">
                  <div className={`font-bold ${geistMono.className} text-foreground`}>
                    {c.quantity.toLocaleString()} {c.unit}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
                    {c.grainType}
                  </div>
                </div>
                <div className="col-span-3 text-right flex justify-end">
                  <Badge
                    variant="outline"
                    className={`${statusColors[c.status] || 'bg-muted text-muted-foreground'} text-[9px] font-bold tracking-widest px-2.5 py-0.5 rounded-full uppercase`}
                  >
                    {s.statusLabels[c.status] || c.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
