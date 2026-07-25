import { getHarvests } from "@/modules/farm/actions/safra";
import { HarvestSheet } from "@/modules/farm/components/HarvestSheet";
import { HarvestList } from "@/modules/farm/components/HarvestList";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/get-locale";

const HEADER = {
  pt: {
    title: "Safras",
    subtitle: "Gerencie as safras, plantios e culturas do sistema",
  },
  es: {
    title: "Cosechas",
    subtitle: "Gestione las cosechas, siembras y cultivos del sistema",
  },
} as const;

export default async function SafraPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;
  const locale = await getLocale();
  const t = HEADER[locale];

  const harvests = await getHarvests();

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
          <p className="text-muted-foreground text-sm">{t.subtitle}</p>
        </div>
        <div className="self-start sm:self-auto">
          <HarvestSheet tenantId={tenantId} />
        </div>
      </div>

      <HarvestList harvests={harvests} tenantId={tenantId} />
    </div>
  );
}
