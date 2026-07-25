import { getPlots } from "@/modules/farm/actions/talhao";
import { getHarvests } from "@/modules/farm/actions/safra";
import { PlotSheet } from "@/modules/farm/components/PlotSheet";
import { PlotList } from "@/modules/farm/components/PlotList";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/get-locale";

const HEADER = {
  pt: {
    title: "Talhões",
    subtitle: "Gerencie as áreas cultiváveis, hectares/alqueires e culturas",
  },
  es: {
    title: "Parcelas",
    subtitle: "Gestione las áreas cultivables, hectáreas/alqueires y cultivos",
  },
} as const;

export default async function TalhoesPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;
  const locale = await getLocale();
  const t = HEADER[locale];

  const plots = await getPlots();
  const harvests = await getHarvests();

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
          <p className="text-muted-foreground text-sm">{t.subtitle}</p>
        </div>
        <div className="self-start sm:self-auto">
          <PlotSheet tenantId={tenantId} harvests={harvests} />
        </div>
      </div>

      <PlotList plots={plots} harvests={harvests} tenantId={tenantId} />
    </div>
  );
}
