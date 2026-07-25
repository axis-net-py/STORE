import { getLivestockBatchById } from "@/modules/farm/actions/livestock";
import { getLivestockEvents } from "@/modules/farm/actions/livestockEvent";
import { getEmployees } from "@/modules/farm/actions/funcionario";
import { LivestockEventSheet } from "@/modules/farm/components/LivestockEventSheet";
import { LivestockEventTimeline } from "@/modules/farm/components/LivestockEventTimeline";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getLocale } from "@/lib/get-locale";

const HEADER = {
  pt: {
    back: "Rebanho",
    head: "cabeças",
    status: "Status",
    active: "Ativo",
    sold: "Vendido",
    averageWeight: "Peso Médio",
    currentLocation: "Piquete Atual",
    notInformed: "Não informado",
    categories: { bezerro: "Bezerro", novilho: "Novilho", vaca: "Vaca", touro: "Touro", boi: "Boi" } as Record<string, string>,
  },
  es: {
    back: "Ganado",
    head: "cabezas",
    status: "Estado",
    active: "Activo",
    sold: "Vendido",
    averageWeight: "Peso Promedio",
    currentLocation: "Potrero Actual",
    notInformed: "No informado",
    categories: { bezerro: "Ternero", novilho: "Novillo", vaca: "Vaca", touro: "Toro", boi: "Buey" } as Record<string, string>,
  },
} as const;

function getStatusBadge(status: string, t: (typeof HEADER)["pt" | "es"]) {
  switch (status) {
    case "ACTIVE":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600/90 text-white border-none">{t.active}</Badge>;
    case "SOLD":
      return <Badge variant="secondary">{t.sold}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default async function LivestockBatchProfilePage({
  params,
}: {
  params: Promise<{ tenantId: string; id: string }>;
}) {
  const { tenantId, id } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const locale = await getLocale();
  const t = HEADER[locale];

  const batch = await getLivestockBatchById(id);
  if (!batch) notFound();

  const [events, employees] = await Promise.all([
    getLivestockEvents(id),
    getEmployees(),
  ]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <Link
          href={`/${tenantId}/rebanho`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="w-4 h-4" /> {t.back}
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{batch.name}</h1>
            <p className="text-muted-foreground text-sm capitalize">{t.categories[batch.category] ?? batch.category} · {batch.quantity} {t.head}</p>
          </div>
          <LivestockEventSheet batchId={id} employees={employees} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 flex flex-wrap items-center gap-6">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">{t.status}</div>
          <div className="mt-1">{getStatusBadge(batch.status, t)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">{t.averageWeight}</div>
          <div className="text-sm font-medium text-foreground mt-1">
            {batch.averageWeight ? `${Number(batch.averageWeight).toLocaleString()} kg` : "-"}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">{t.currentLocation}</div>
          <div className="text-sm font-medium text-foreground mt-1">
            {batch.location || <span className="text-muted-foreground italic">{t.notInformed}</span>}
          </div>
        </div>
      </div>

      <LivestockEventTimeline events={events} />
    </div>
  );
}
