import { getHarvestById } from "@/modules/farm/actions/safra";
import { getHarvestProfitability } from "@/modules/farm/actions/harvestProfitability";
import { getContracts } from "@/modules/farm/actions/contrato";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, TrendingUp, TrendingDown } from "lucide-react";
import { getLocale } from "@/lib/get-locale";

const HEADER = {
  pt: {
    back: "Safras",
    active: "Ativa",
    planned: "Planejada",
    completed: "Concluída",
    margin: "Margem",
    revenue: "Receita",
    cost: "Custo",
    noRevenueContract: "Sem contrato de venda nesta moeda ainda",
    noCostOrContract: "Nenhum custo de insumo ou contrato registrado para esta safra ainda.",
    plotCostTitle: "Custo de Insumo por Talhão",
    contractsTitle: "Contratos de Venda",
    plot: "Talhão",
    area: "Área",
    totalCost: "Custo Total",
    noPlot: "Nenhum talhão vinculado a esta safra.",
    contractNumber: "Nº Contrato",
    grain: "Grão",
    quantity: "Quantidade",
    status: "Status",
    value: "Valor",
    noContract: "Nenhum contrato vinculado a esta safra.",
  },
  es: {
    back: "Cosechas",
    active: "Activa",
    planned: "Planificada",
    completed: "Concluida",
    margin: "Margen",
    revenue: "Ingreso",
    cost: "Costo",
    noRevenueContract: "Aún sin contrato de venta en esta moneda",
    noCostOrContract: "Aún no hay costo de insumo ni contrato registrado para esta cosecha.",
    plotCostTitle: "Costo de Insumo por Parcela",
    contractsTitle: "Contratos de Venta",
    plot: "Parcela",
    area: "Área",
    totalCost: "Costo Total",
    noPlot: "Ninguna parcela vinculada a esta cosecha.",
    contractNumber: "Nº Contrato",
    grain: "Grano",
    quantity: "Cantidad",
    status: "Estado",
    value: "Valor",
    noContract: "Ningún contrato vinculado a esta cosecha.",
  },
} as const;

function getStatusBadge(status: string, t: (typeof HEADER)["pt" | "es"]) {
  switch (status) {
    case "ACTIVE":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600/90 text-white border-none">{t.active}</Badge>;
    case "PLANNED":
      return <Badge className="bg-sky-600 hover:bg-sky-600/90 text-white border-none">{t.planned}</Badge>;
    case "COMPLETED":
      return <Badge variant="secondary">{t.completed}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default async function HarvestProfilePage({
  params,
}: {
  params: Promise<{ tenantId: string; id: string }>;
}) {
  const { tenantId, id } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const locale = await getLocale();
  const t = HEADER[locale];

  const harvest = await getHarvestById(id);
  if (!harvest) notFound();

  const [profitability, allContracts] = await Promise.all([
    getHarvestProfitability(id),
    getContracts(),
  ]);

  const contracts = allContracts.filter((c) => c.harvestId === id);

  // Margem por moeda: só onde há receita E custo na mesma moeda
  const margins = profitability.revenueByCurrency.map((rev) => {
    const cost = profitability.costByCurrency.find((c) => c.currency === rev.currency)?.total ?? 0;
    return { currency: rev.currency, revenue: rev.total, cost, margin: rev.total - cost };
  });
  const costCurrenciesWithoutRevenue = profitability.costByCurrency.filter(
    (c) => !profitability.revenueByCurrency.some((r) => r.currency === c.currency)
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <Link
          href={`/${tenantId}/safra`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="w-4 h-4" /> {t.back}
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{harvest.name}</h1>
            <p className="text-muted-foreground text-sm capitalize">{harvest.cropType}</p>
          </div>
          <div>{getStatusBadge(harvest.status, t)}</div>
        </div>
      </div>

      {/* Margem */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {margins.map((m) => (
          <div key={m.currency} className="rounded-lg border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
              {m.margin >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> : <TrendingDown className="w-3.5 h-3.5 text-destructive" />}
              {t.margin} ({m.currency})
            </div>
            <div className={`text-lg font-bold mt-1 ${m.margin >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatCurrency(m.margin, m.currency)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {t.revenue}: {formatCurrency(m.revenue, m.currency)} · {t.cost}: {formatCurrency(m.cost, m.currency)}
            </div>
          </div>
        ))}
        {costCurrenciesWithoutRevenue.map((c) => (
          <div key={c.currency} className="rounded-lg border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">{t.cost} ({c.currency})</div>
            <div className="text-lg font-bold text-foreground mt-1">{formatCurrency(c.total, c.currency)}</div>
            <div className="text-xs text-muted-foreground mt-1">{t.noRevenueContract}</div>
          </div>
        ))}
        {margins.length === 0 && costCurrenciesWithoutRevenue.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            {t.noCostOrContract}
          </div>
        )}
      </div>

      {/* Custo por talhão */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">{t.plotCostTitle}</h2>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.plot}</TableHead>
                <TableHead>{t.area}</TableHead>
                <TableHead className="text-right">{t.totalCost}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profitability.plotCosts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    {t.noPlot}
                  </TableCell>
                </TableRow>
              ) : (
                profitability.plotCosts.map((p) => (
                  <TableRow key={p.plotId}>
                    <TableCell className="font-medium">
                      <Link href={`/${tenantId}/talhoes/${p.plotId}`} className="hover:underline hover:text-primary">
                        {p.plotName}
                      </Link>
                    </TableCell>
                    <TableCell>{p.area.toFixed(2)} {p.unit === "HECTARE" ? "ha" : "alq"}</TableCell>
                    <TableCell className="text-right">{p.totalCost.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Contratos de venda */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">{t.contractsTitle}</h2>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.contractNumber}</TableHead>
                <TableHead>{t.grain}</TableHead>
                <TableHead>{t.quantity}</TableHead>
                <TableHead>{t.status}</TableHead>
                <TableHead className="text-right">{t.value}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {t.noContract}
                  </TableCell>
                </TableRow>
              ) : (
                contracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.contractNumber}</TableCell>
                    <TableCell>{c.grainType}</TableCell>
                    <TableCell>{Number(c.quantity).toLocaleString()} {c.unit}</TableCell>
                    <TableCell>{c.status}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(c.quantity) * Number(c.pricePerUnit), c.currency)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
