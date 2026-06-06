import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LedgerTable from "@/components/accounting/LedgerTable";

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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Contabilidade
        </h1>
        <p className="text-muted-foreground text-sm">
          Livro Razão e Partidas Dobradas
        </p>
      </div>

      <LedgerTable tenantId={resolvedTenantId} />
    </div>
  );
}
