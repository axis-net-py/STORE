import { getSiloById } from "@/modules/farm/actions/silo";
import { getSiloMovements } from "@/modules/farm/actions/siloMovement";
import { getHarvests } from "@/modules/farm/actions/safra";
import { getContracts } from "@/modules/farm/actions/contrato";
import { SiloMovementSheet } from "@/modules/farm/components/SiloMovementSheet";
import { SiloMovementTimeline } from "@/modules/farm/components/SiloMovementTimeline";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getLocale } from "@/lib/get-locale";

const HEADER = {
  pt: {
    back: "Silos",
    capacity: "Capacidade",
    currentStock: "Estoque Atual",
    occupancy: "Ocupação",
  },
  es: {
    back: "Silos",
    capacity: "Capacidad",
    currentStock: "Stock Actual",
    occupancy: "Ocupación",
  },
} as const;

export default async function SiloProfilePage({
  params,
}: {
  params: Promise<{ tenantId: string; id: string }>;
}) {
  const { tenantId, id } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const locale = await getLocale();
  const t = HEADER[locale];

  const silo = await getSiloById(id);
  if (!silo) notFound();

  const [movements, harvests, contracts] = await Promise.all([
    getSiloMovements(id),
    getHarvests(),
    getContracts(),
  ]);

  const capacity = Number(silo.capacity);
  const stock = Number(silo.currentStock);
  const pct = capacity > 0 ? Math.min(100, Math.round((stock / capacity) * 100)) : 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <Link
          href={`/${tenantId}/silos`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="w-4 h-4" /> {t.back}
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{silo.name}</h1>
            <p className="text-muted-foreground text-sm">{t.capacity}: {capacity.toLocaleString()} {silo.unit}</p>
          </div>
          <SiloMovementSheet siloId={id} harvests={harvests} contracts={contracts} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 flex flex-wrap items-center gap-6">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">{t.currentStock}</div>
          <div className="text-lg font-bold text-foreground mt-1">{stock.toLocaleString()} {silo.unit}</div>
        </div>
        <div className="flex-1 min-w-[160px]">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5">{t.occupancy}</div>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full ${pct >= 90 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{pct}%</span>
          </div>
        </div>
      </div>

      <SiloMovementTimeline movements={movements} unit={silo.unit} />
    </div>
  );
}
