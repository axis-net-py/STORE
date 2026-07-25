"use client";

import { useState } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HarvestSheet } from "@/modules/farm/components/HarvestSheet";
import type { Harvest } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    searchPlaceholder: "Buscar por Nome ou Cultura...",
    name: "Nome da Safra",
    cropType: "Cultura",
    startDate: "Data de Início",
    endDate: "Data de Término",
    status: "Status",
    actions: "Ações",
    empty: "Nenhuma safra cadastrada ou encontrada.",
    statusActive: "Ativa",
    statusPlanned: "Planejada",
    statusCompleted: "Concluída",
    dateLocale: "pt-BR",
  },
  es: {
    searchPlaceholder: "Buscar por Nombre o Cultivo...",
    name: "Nombre de la Cosecha",
    cropType: "Cultivo",
    startDate: "Fecha de Inicio",
    endDate: "Fecha de Término",
    status: "Estado",
    actions: "Acciones",
    empty: "Ninguna cosecha registrada o encontrada.",
    statusActive: "Activa",
    statusPlanned: "Planificada",
    statusCompleted: "Concluida",
    dateLocale: "es-PY",
  },
} as const;

export function HarvestList({ harvests, tenantId }: { harvests: Harvest[]; tenantId: string }) {
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "cropType" | "startDate" | "endDate" | "status" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (field: "name" | "cropType" | "startDate" | "endDate" | "status") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const filtered = harvests.filter((h) => {
    const term = search.toLowerCase();
    return (
      h.name.toLowerCase().includes(term) ||
      h.cropType.toLowerCase().includes(term)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortField) return 0;
    const aVal = a[sortField];
    const bVal = b[sortField];

    let compA: any = aVal;
    let compB: any = bVal;

    if (aVal instanceof Date || (typeof aVal === "string" && Date.parse(aVal))) {
      compA = new Date(aVal).getTime();
      compB = new Date(bVal as any).getTime();
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

  const formatDate = (dateInput: any) => {
    if (!dateInput) return "-";
    const date = new Date(dateInput);
    return date.toLocaleDateString(s.dateLocale, { timeZone: "UTC" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-emerald-600 hover:bg-emerald-600/90 text-white border-none">{s.statusActive}</Badge>;
      case "PLANNED":
        return <Badge className="bg-amber-600 hover:bg-amber-600/90 text-white border-none">{s.statusPlanned}</Badge>;
      case "COMPLETED":
        return <Badge variant="secondary">{s.statusCompleted}</Badge>;
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
              <TableHead onClick={() => handleSort("cropType")} className="cursor-pointer hover:bg-muted/50 select-none">
                {s.cropType}{renderSortIndicator("cropType")}
              </TableHead>
              <TableHead onClick={() => handleSort("startDate")} className="cursor-pointer hover:bg-muted/50 select-none">
                {s.startDate}{renderSortIndicator("startDate")}
              </TableHead>
              <TableHead onClick={() => handleSort("endDate")} className="cursor-pointer hover:bg-muted/50 select-none">
                {s.endDate}{renderSortIndicator("endDate")}
              </TableHead>
              <TableHead onClick={() => handleSort("status")} className="cursor-pointer hover:bg-muted/50 select-none">
                {s.status}{renderSortIndicator("status")}
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
              sorted.map((harvest) => (
                <TableRow key={harvest.id}>
                  <TableCell className="font-medium">
                    <Link href={`/${tenantId}/safra/${harvest.id}`} className="hover:underline hover:text-primary">
                      {harvest.name}
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize">{harvest.cropType}</TableCell>
                  <TableCell>{formatDate(harvest.startDate)}</TableCell>
                  <TableCell>{formatDate(harvest.endDate)}</TableCell>
                  <TableCell>{getStatusBadge(harvest.status)}</TableCell>
                  <TableCell className="text-right">
                    <HarvestSheet
                      tenantId={tenantId}
                      harvest={harvest}
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
