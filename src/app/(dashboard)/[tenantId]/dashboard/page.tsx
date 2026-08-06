import { Suspense } from 'react';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { TopProducts } from '@/components/dashboard/TopProducts';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { getTranslations } from 'next-intl/server';
import { BriefingDiario } from '@/components/dashboard/BriefingDiario';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Default date range - last 30 days
const defaultDateRange = {
  from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  to: new Date(),
};

// Default currency - should come from tenant settings
const defaultCurrency = 'PYG' as const;

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const t = await getTranslations("pages.dashboard");
  const { tenantId } = await params;

  // A barra lateral já trata uma clínica como uma clínica — "Clientes" aparece
  // lá como "Pacientes". O painel não sabia disso, e o primeiro ecrã que um
  // médico via contradizia o menu ao lado. Tolerante a base por migrar: sem a
  // coluna, fica o vocabulário genérico.
  let clinica = false;
  try {
    const empresa = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { modules: true },
    });
    clinica = !!empresa?.modules?.includes('clinic');
  } catch {
    clinica = false;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* Em Suspense próprio: o briefing consulta várias tabelas e não deve
          atrasar o resto do painel. */}
      <Suspense fallback={<Skeleton className="h-28 w-full" />}>
        <BriefingDiario tenantId={tenantId} />
      </Suspense>

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
        <StatsCards
          dateRange={defaultDateRange}
          currency={defaultCurrency}
          clinica={clinica}
        />
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

