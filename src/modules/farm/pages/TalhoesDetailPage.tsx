import { getPlotById } from "@/modules/farm/actions/talhao";
import { getPlotApplications } from "@/modules/farm/actions/plotApplication";
import { getSoilAnalyses } from "@/modules/farm/actions/soilAnalysis";
import { getIrrigationEvents } from "@/modules/farm/actions/irrigationEvent";
import { getEmployees } from "@/modules/farm/actions/funcionario";
import { getProducts } from "@/app/actions/product";
import { PlotApplicationSheet } from "@/modules/farm/components/PlotApplicationSheet";
import { PlotApplicationTimeline } from "@/modules/farm/components/PlotApplicationTimeline";
import { SoilAnalysisSheet } from "@/modules/farm/components/SoilAnalysisSheet";
import { SoilAnalysisTimeline } from "@/modules/farm/components/SoilAnalysisTimeline";
import { IrrigationEventSheet } from "@/modules/farm/components/IrrigationEventSheet";
import { IrrigationEventTimeline } from "@/modules/farm/components/IrrigationEventTimeline";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getLocale } from "@/lib/get-locale";

const HEADER = {
  pt: {
    back: "Talhões",
    status: "Status",
    harvest: "Safra Associada",
    noHarvest: "Sem safra",
    applications: "Aplicações de Insumo",
    soilAnalyses: "Análises de Solo",
    irrigation: "Irrigação",
    planted: "Plantado",
    preparing: "Preparando Solo",
    fallow: "Pousio",
  },
  es: {
    back: "Parcelas",
    status: "Estado",
    harvest: "Cosecha Asociada",
    noHarvest: "Sin cosecha",
    applications: "Aplicaciones de Insumo",
    soilAnalyses: "Análisis de Suelo",
    irrigation: "Riego",
    planted: "Plantado",
    preparing: "Preparando Suelo",
    fallow: "Barbecho",
  },
} as const;

function getStatusBadge(status: string, t: (typeof HEADER)["pt" | "es"]) {
  switch (status) {
    case "PLANTED":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600/90 text-white border-none">{t.planted}</Badge>;
    case "PREPARING":
      return <Badge className="bg-sky-600 hover:bg-sky-600/90 text-white border-none">{t.preparing}</Badge>;
    case "FALLOW":
      return <Badge variant="secondary">{t.fallow}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default async function PlotProfilePage({
  params,
}: {
  params: Promise<{ tenantId: string; id: string }>;
}) {
  const { tenantId, id } = await params;
  const locale = await getLocale();
  const t = HEADER[locale];
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const plot = await getPlotById(id);
  if (!plot) notFound();

  const [applications, soilAnalyses, irrigationEvents, employees, products] = await Promise.all([
    getPlotApplications(id),
    getSoilAnalyses(id),
    getIrrigationEvents(id),
    getEmployees(),
    getProducts(),
  ]);

  const activeProducts = products.filter((p: any) => p.isActive && !p.isService);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <Link
          href={`/${tenantId}/talhoes`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="w-4 h-4" /> {t.back}
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{plot.name}</h1>
            <p className="text-muted-foreground text-sm">
              {Number(plot.area).toFixed(2)} {plot.unit === "HECTARE" ? "ha" : "alq"}
              {plot.currentCrop ? ` · ${plot.currentCrop}` : ""}
            </p>
          </div>
          <PlotApplicationSheet plotId={id} products={activeProducts} employees={employees} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 flex flex-wrap items-center gap-6">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">{t.status}</div>
          <div className="mt-1">{getStatusBadge(plot.status, t)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">{t.harvest}</div>
          <div className="text-sm font-medium text-foreground mt-1">
            {plot.harvest?.name || <span className="text-muted-foreground italic">{t.noHarvest}</span>}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">{t.applications}</h2>
        <PlotApplicationTimeline applications={applications} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">{t.soilAnalyses}</h2>
          <SoilAnalysisSheet plotId={id} />
        </div>
        <SoilAnalysisTimeline analyses={soilAnalyses} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">{t.irrigation}</h2>
          <IrrigationEventSheet plotId={id} employees={employees} />
        </div>
        <IrrigationEventTimeline events={irrigationEvents} />
      </div>
    </div>
  );
}
