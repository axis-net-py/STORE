import { getSilos } from "@/modules/farm/actions/silo";
import { SiloSheet } from "@/modules/farm/components/SiloSheet";
import { SiloList } from "@/modules/farm/components/SiloList";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/get-locale";

const HEADER = {
  pt: {
    title: "Silos",
    subtitle: "Estoque de grão armazenado na fazenda",
  },
  es: {
    title: "Silos",
    subtitle: "Stock de granos almacenado en la finca",
  },
} as const;

export default async function SilosPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;
  const locale = await getLocale();
  const t = HEADER[locale];

  const silos = await getSilos();

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
          <p className="text-muted-foreground text-sm">{t.subtitle}</p>
        </div>
        <div className="self-start sm:self-auto">
          <SiloSheet />
        </div>
      </div>

      <SiloList silos={silos} tenantId={tenantId} />
    </div>
  );
}
