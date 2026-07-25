import { getVehicles } from "@/modules/farm/actions/frota";
import { VehicleSheet } from "@/modules/farm/components/VehicleSheet";
import { VehicleList } from "@/modules/farm/components/VehicleList";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/get-locale";

const HEADER = {
  pt: {
    title: "Frota Agrícola",
    subtitle: "Gerencie tratores, colheitadeiras, veículos e implementos",
  },
  es: {
    title: "Flota Agrícola",
    subtitle: "Gestione tractores, cosechadoras, vehículos e implementos",
  },
} as const;

export default async function FrotaPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;
  const locale = await getLocale();
  const t = HEADER[locale];

  const vehicles = await getVehicles();

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
          <p className="text-muted-foreground text-sm">{t.subtitle}</p>
        </div>
        <div className="self-start sm:self-auto">
          <VehicleSheet tenantId={tenantId} />
        </div>
      </div>

      <VehicleList vehicles={vehicles} tenantId={tenantId} />
    </div>
  );
}
