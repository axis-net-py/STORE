'use client';

import { Geist_Mono } from 'next/font/google';
import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '@/lib/dashboard';
import { useLanguage } from '@/components/language-provider';
import { formatCurrency } from '@/lib/format';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  Wallet,
  AlertTriangle,
  Clock,
  FileText,
  type LucideIcon,
} from 'lucide-react';

const geistMono = Geist_Mono({ subsets: ['latin'] });

interface StatsCardsProps {
  dateRange: { from: Date; to: Date };
  currency: 'PYG' | 'USD' | 'BRL';
}

const tMap: Record<'pt' | 'es', Record<string, string>> = {
  pt: {
    salesTitle: "Total de Vendas",
    salesSub: "Faturamento consolidado",
    purchasesTitle: "Total de Compras",
    purchasesSub: "Gastos aprovados",
    productsTitle: "Produtos Cadastrados",
    productsSub: "Produtos ativos no catálogo",
    customersTitle: "Clientes Ativos",
    customersSub: "Clientes registrados",
    receivablesTitle: "Contas a Receber",
    receivablesSub: "Total a receber (Gs)",
    lowStockTitle: "Estoque Baixo",
    lowStockSub: "Produtos no mínimo",
    sifenPendingTitle: "SIFEN Pendente",
    sifenPendingSub: "Faturas a enviar à SET",
    pendingInvoicesTitle: "Faturas Pendentes",
    pendingInvoicesSub: "Aguardando aprovação",
    error: "Erro ao carregar estatísticas",
  },
  es: {
    salesTitle: "Total de Ventas",
    salesSub: "Facturación consolidada",
    purchasesTitle: "Total de Compras",
    purchasesSub: "Gastos aprobados",
    productsTitle: "Productos Registrados",
    productsSub: "Productos activos en catálogo",
    customersTitle: "Clientes Activos",
    customersSub: "Clientes registrados",
    receivablesTitle: "Cuentas por Cobrar",
    receivablesSub: "Total por cobrar (Gs)",
    lowStockTitle: "Stock Bajo",
    lowStockSub: "Productos en el mínimo",
    sifenPendingTitle: "SIFEN Pendiente",
    sifenPendingSub: "Facturas a enviar a la SET",
    pendingInvoicesTitle: "Facturas Pendientes",
    pendingInvoicesSub: "Esperando aprobación",
    error: "Error al cargar estadísticas",
  }
};

const accentMap = {
  emerald: { border: "border-l-emerald-500/80", icon: "text-emerald-500", hover: "group-hover:text-emerald-500 dark:group-hover:text-emerald-400" },
  gold:    { border: "border-l-[#c9a84c]",      icon: "text-[#c9a84c]",   hover: "group-hover:text-[#c9a84c]" },
  amber:   { border: "border-l-amber-500/80",   icon: "text-amber-500",   hover: "group-hover:text-amber-500 dark:group-hover:text-amber-400" },
  neutral: { border: "border-l-zinc-400",       icon: "text-zinc-500",    hover: "group-hover:text-zinc-500 dark:group-hover:text-zinc-300" },
} as const;

type AccentKey = keyof typeof accentMap;

function KpiCard({
  title, sub, value, icon: Icon, accent, big, attention,
}: {
  title: string;
  sub: string;
  value: string | number;
  icon: LucideIcon;
  accent: AccentKey;
  big?: boolean;
  attention?: boolean;
}) {
  const a = accentMap[accent];
  return (
    <Card className={`border border-border bg-card/45 backdrop-blur-md shadow-sm transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-md cursor-default border-l-4 ${a.border} group`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className={`text-xs font-semibold uppercase tracking-widest text-muted-foreground ${a.hover} transition-colors`}>
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${a.icon} opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300`} />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1">
          <h3 className={`${geistMono.className} ${big ? 'text-3xl' : 'text-xl'} font-extrabold tracking-tight ${attention ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'} truncate`}>
            {value}
          </h3>
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
            {sub}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsCards({ dateRange, currency }: StatsCardsProps) {
  const { language } = useLanguage();
  const currentLang = (language === 'es' || language === 'pt') ? language : 'pt';
  const labels = tMap[currentLang];

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboardStats', dateRange, currency],
    queryFn: () => getDashboardStats({ start: dateRange.from, end: dateRange.to }),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[0, 1].map((row) => (
          <div key={row} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-destructive text-sm font-medium py-4 px-2">{labels.error}</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Linha 1 — visão financeira e catálogo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard accent="emerald" icon={TrendingUp}  title={labels.salesTitle}     sub={labels.salesSub}     value={formatCurrency(data.totalSales, currency)} />
        <KpiCard accent="amber"   icon={TrendingDown} title={labels.purchasesTitle} sub={labels.purchasesSub} value={formatCurrency(data.totalPurchases, currency)} />
        <KpiCard accent="neutral" icon={Package}      title={labels.productsTitle}  sub={labels.productsSub}  value={data.totalProducts} big />
        <KpiCard accent="gold"    icon={Users}        title={labels.customersTitle} sub={labels.customersSub} value={data.totalCustomers} big />
      </div>

      {/* Linha 2 — indicadores operacionais (acionáveis) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard accent="emerald" icon={Wallet} title={labels.receivablesTitle} sub={labels.receivablesSub} value={formatCurrency(data.receivables, 'PYG')} />
        <KpiCard
          accent={data.lowStockCount > 0 ? 'amber' : 'emerald'}
          icon={AlertTriangle}
          title={labels.lowStockTitle}
          sub={labels.lowStockSub}
          value={data.lowStockCount}
          big
          attention={data.lowStockCount > 0}
        />
        <KpiCard
          accent={data.pendingSifenCount > 0 ? 'amber' : 'emerald'}
          icon={Clock}
          title={labels.sifenPendingTitle}
          sub={labels.sifenPendingSub}
          value={data.pendingSifenCount}
          big
          attention={data.pendingSifenCount > 0}
        />
        <KpiCard
          accent={data.pendingInvoicesCount > 0 ? 'amber' : 'emerald'}
          icon={FileText}
          title={labels.pendingInvoicesTitle}
          sub={labels.pendingInvoicesSub}
          value={data.pendingInvoicesCount}
          big
          attention={data.pendingInvoicesCount > 0}
        />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return <Skeleton className="h-32 w-full rounded-xl" />;
}
