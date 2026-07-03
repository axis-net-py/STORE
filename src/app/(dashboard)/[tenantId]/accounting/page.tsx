import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LedgerTable from "@/components/accounting/LedgerTable";
import PeriodsManager from "@/components/accounting/PeriodsManager";
import { PageHeader } from "@/components/ui/page-header";

export default async function AccountingPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;

  const { tenantId: paramTenantId } = await params;
  const resolvedTenantId = paramTenantId || tenantId;

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Contabilidade" subtitle="Livro razão e partidas dobradas" />

      <LedgerTable tenantId={resolvedTenantId} />

      <PeriodsManager />
    </div>
  );
}
