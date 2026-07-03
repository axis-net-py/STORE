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
import { TrendingUp, TrendingDown, Package, Users } from 'lucide-react';

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
    error: "Error al cargar estadísticas",
  }
};

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
      {/* Total de Vendas */}
      <Card className="border border-border bg-card/45 backdrop-blur-md shadow-sm transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-md cursor-default border-l-4 border-l-emerald-500/80 group">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
            {labels.salesTitle}
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-500 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            <h3 className={`${geistMono.className} text-xl font-extrabold tracking-tight text-foreground truncate`}>
              {formatCurrency(data.totalSales, currency)}
            </h3>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              {labels.salesSub}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Total de Compras */}
      <Card className="border border-border bg-card/45 backdrop-blur-md shadow-sm transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-md cursor-default border-l-4 border-l-amber-500/80 group">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
            {labels.purchasesTitle}
          </CardTitle>
          <TrendingDown className="h-4 w-4 text-amber-500 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            <h3 className={`${geistMono.className} text-xl font-extrabold tracking-tight text-foreground truncate`}>
              {formatCurrency(data.totalPurchases, currency)}
            </h3>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              {labels.purchasesSub}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Produtos Cadastrados */}
      <Card className="border border-border bg-card/45 backdrop-blur-md shadow-sm transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-md cursor-default border-l-4 border-l-sky-500/80 group">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-sky-500 dark:group-hover:text-sky-400 transition-colors">
            {labels.productsTitle}
          </CardTitle>
          <Package className="h-4 w-4 text-sky-500 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            <h3 className={`${geistMono.className} text-3xl font-extrabold tracking-tight text-foreground`}>
              {data.totalProducts}
            </h3>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              {labels.productsSub}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Clientes Ativos */}
      <Card className="border border-border bg-card/45 backdrop-blur-md shadow-sm transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-md cursor-default border-l-4 border-l-indigo-500/80 group">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
            {labels.customersTitle}
          </CardTitle>
          <Users className="h-4 w-4 text-indigo-500 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            <h3 className={`${geistMono.className} text-3xl font-extrabold tracking-tight text-foreground`}>
              {data.totalCustomers}
            </h3>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              {labels.customersSub}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function StatCardSkeleton() {
  return <Skeleton className="h-32 w-full rounded-xl" />;
}
