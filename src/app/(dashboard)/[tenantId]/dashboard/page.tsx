import { Suspense } from 'react';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { TopProducts } from '@/components/dashboard/TopProducts';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

// Default date range - last 30 days
const defaultDateRange = {
  from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  to: new Date(),
};

// Default currency - should come from tenant settings
const defaultCurrency = 'PYG' as const;

export default function DashboardPage() {
  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Dashboard" subtitle="Visão geral do seu negócio" />

      {/* Stats Cards */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        }
      >
        <StatsCards dateRange={defaultDateRange} currency={defaultCurrency} />
      </Suspense>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense
          fallback={
            <div className="h-[350px] w-full bg-card border rounded-lg animate-pulse" />
          }
        >
          <SalesChart dateRange={defaultDateRange} currency={defaultCurrency} />
        </Suspense>

        <Suspense
          fallback={
            <div className="h-[350px] w-full bg-card border rounded-lg animate-pulse" />
          }
        >
          <TopProducts dateRange={defaultDateRange} currency={defaultCurrency} limit={5} />
        </Suspense>
      </div>
    </div>
  );
}

