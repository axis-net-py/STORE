"use client";

import { useState } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlotSheet } from "@/modules/farm/components/PlotSheet";
import type { Plot, Harvest } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    searchPlaceholder: "Buscar por Nome, Cultura ou Safra...",
    name: "Nome/Talhão",
    area: "Área",
    currentCrop: "Cultura Atual",
    status: "Status",
    harvest: "Safra Associada",
    actions: "Ações",
    empty: "Nenhum talhão cadastrado ou encontrado.",
    noHarvest: "Sem safra",
    statusPlanted: "Plantado",
    statusPreparing: "Preparando Solo",
    statusFallow: "Pousio",
    unitHectare: "ha",
    unitAlqueire: "alq",
  },
  es: {
    searchPlaceholder: "Buscar por Nombre, Cultivo o Cosecha...",
    name: "Nombre/Parcela",
    area: "Área",
    currentCrop: "Cultivo Actual",
    status: "Estado",
    harvest: "Cosecha Asociada",
    actions: "Acciones",
    empty: "Ninguna parcela registrada o encontrada.",
    noHarvest: "Sin cosecha",
    statusPlanted: "Sembrado",
    statusPreparing: "Preparando Suelo",
    statusFallow: "Barbecho",
    unitHectare: "ha",
    unitAlqueire: "alq",
  },
} as const;

export function PlotList({
  plots,
  harvests,
  tenantId,
}: {
  plots: (Plot & { harvest?: { name: string } | null })[];
  harvests: Harvest[];
  tenantId: string;
}) {
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "area" | "currentCrop" | "status" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (field: "name" | "area" | "currentCrop" | "status") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const filtered = plots.filter((p) => {
    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.currentCrop && p.currentCrop.toLowerCase().includes(term)) ||
      (p.harvest?.name && p.harvest.name.toLowerCase().includes(term))
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortField) return 0;
    const aVal = a[sortField];
    const bVal = b[sortField];

    let compA: any = aVal;
    let compB: any = bVal;

    if (sortField === "area") {
      compA = Number(aVal || 0);
      compB = Number(bVal || 0);
    } else {
      compA = String(aVal || "").toLowerCase();
      compB = String(bVal || "").toLowerCase();
    }

    if (compA < compB) return sortOrder === "asc" ? -1 : 1;
    if (compA > compB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const renderSortIndicator = (field: typeof sortField) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? " ▴" : " ▾";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PLANTED":
        return <Badge className="bg-emerald-600 hover:bg-emerald-600/90 text-white border-none">{s.statusPlanted}</Badge>;
      case "PREPARING":
        return <Badge className="bg-sky-600 hover:bg-sky-600/90 text-white border-none">{s.statusPreparing}</Badge>;
      case "FALLOW":
        return <Badge variant="secondary">{s.statusFallow}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <Input
          placeholder={s.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md h-[38px] rounded-lg border-border bg-card"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSort("name")} className="cursor-pointer hover:bg-muted/50 select-none">
                {s.name}{renderSortIndicator("name")}
              </TableHead>
              <TableHead onClick={() => handleSort("area")} className="cursor-pointer hover:bg-muted/50 select-none">
                {s.area}{renderSortIndicator("area")}
              </TableHead>
              <TableHead onClick={() => handleSort("currentCrop")} className="cursor-pointer hover:bg-muted/50 select-none">
                {s.currentCrop}{renderSortIndicator("currentCrop")}
              </TableHead>
              <TableHead onClick={() => handleSort("status")} className="cursor-pointer hover:bg-muted/50 select-none">
                {s.status}{renderSortIndicator("status")}
              </TableHead>
              <TableHead className="select-none">
                {s.harvest}
              </TableHead>
              <TableHead className="text-right">{s.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {s.empty}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((plot) => (
                <TableRow key={plot.id}>
                  <TableCell className="font-medium">
                    <Link href={`/${tenantId}/talhoes/${plot.id}`} className="hover:underline hover:text-primary">
                      {plot.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {Number(plot.area).toFixed(2)} {plot.unit === "HECTARE" ? s.unitHectare : s.unitAlqueire}
                  </TableCell>
                  <TableCell>{plot.currentCrop || "-"}</TableCell>
                  <TableCell>{getStatusBadge(plot.status)}</TableCell>
                  <TableCell>{plot.harvest?.name || <span className="text-muted-foreground italic text-xs">{s.noHarvest}</span>}</TableCell>
                  <TableCell className="text-right">
                    <PlotSheet
                      tenantId={tenantId}
                      plot={plot}
                      harvests={harvests}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
