import { getContracts } from "@/modules/farm/actions/contrato";
import { getHarvests } from "@/modules/farm/actions/safra";
import { ContractSheet } from "@/modules/farm/components/ContractSheet";
import { ContractList } from "@/modules/farm/components/ContractList";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/get-locale";

const HEADER = {
  pt: {
    title: "Contratos de Venda",
    subtitle: "Gerencie as vendas programadas de safras e entregas a silos compradores",
  },
  es: {
    title: "Contratos de Venta",
    subtitle: "Gestione las ventas programadas de cosechas y entregas a silos compradores",
  },
} as const;

export default async function ContratosPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;
  const locale = await getLocale();
  const t = HEADER[locale];

  const contracts = await getContracts();
  const harvests = await getHarvests();

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
          <p className="text-muted-foreground text-sm">{t.subtitle}</p>
        </div>
        <div className="self-start sm:self-auto">
          <ContractSheet tenantId={tenantId} harvests={harvests} />
        </div>
      </div>

      <ContractList contracts={contracts} harvests={harvests} tenantId={tenantId} />
    </div>
  );
}
