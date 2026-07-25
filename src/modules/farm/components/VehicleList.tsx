"use client";

import { useState } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { VehicleSheet } from "@/modules/farm/components/VehicleSheet";
import type { Vehicle } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    searchPlaceholder: "Buscar por Nome, Tipo ou Placa...",
    name: "Modelo/Nome",
    type: "Tipo",
    plate: "Placa/ID",
    status: "Status",
    reading: "Leitura Atual",
    actions: "Ações",
    empty: "Nenhum veículo ou maquinário cadastrado ou encontrado.",
    statusOperational: "Operacional",
    statusMaintenance: "Manutenção",
    statusOutOfService: "Fora de Serviço",
  },
  es: {
    searchPlaceholder: "Buscar por Nombre, Tipo o Placa...",
    name: "Modelo/Nombre",
    type: "Tipo",
    plate: "Placa/ID",
    status: "Estado",
    reading: "Lectura Actual",
    actions: "Acciones",
    empty: "Ningún vehículo o maquinaria registrado o encontrado.",
    statusOperational: "Operativo",
    statusMaintenance: "Mantenimiento",
    statusOutOfService: "Fuera de Servicio",
  },
} as const;

export function VehicleList({ vehicles, tenantId }: { vehicles: Vehicle[]; tenantId: string }) {
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "type" | "plate" | "status" | "currentReading" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (field: "name" | "type" | "plate" | "status" | "currentReading") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const filtered = vehicles.filter((v) => {
    const term = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(term) ||
      v.type.toLowerCase().includes(term) ||
      (v.plate && v.plate.toLowerCase().includes(term))
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortField) return 0;
    const aVal = a[sortField];
    const bVal = b[sortField];

    let compA: any = aVal;
    let compB: any = bVal;

    if (sortField === "currentReading") {
      compA = aVal ? Number(aVal) : 0;
      compB = bVal ? Number(bVal) : 0;
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
      case "OPERATIONAL":
        return <Badge className="bg-emerald-600 hover:bg-emerald-600/90 text-white border-none">{s.statusOperational}</Badge>;
      case "MAINTENANCE":
        return <Badge className="bg-amber-600 hover:bg-amber-600/90 text-white border-none">{s.statusMaintenance}</Badge>;
      case "OUT_OF_SERVICE":
        return <Badge variant="destructive">{s.statusOutOfService}</Badge>;
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
              <TableHead onClick={() => handleSort("type")} className="cursor-pointer hover:bg-muted/50 select-none">
                {s.type}{renderSortIndicator("type")}
              </TableHead>
              <TableHead onClick={() => handleSort("plate")} className="cursor-pointer hover:bg-muted/50 select-none">
                {s.plate}{renderSortIndicator("plate")}
              </TableHead>
              <TableHead onClick={() => handleSort("status")} className="cursor-pointer hover:bg-muted/50 select-none">
                {s.status}{renderSortIndicator("status")}
              </TableHead>
              <TableHead onClick={() => handleSort("currentReading")} className="cursor-pointer hover:bg-muted/50 select-none">
                {s.reading}{renderSortIndicator("currentReading")}
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
              sorted.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell className="font-medium">
                    <Link href={`/${tenantId}/frota/${vehicle.id}`} className="hover:underline hover:text-primary">
                      {vehicle.name}
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize">{vehicle.type}</TableCell>
                  <TableCell>{vehicle.plate ?? "-"}</TableCell>
                  <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                  <TableCell>{vehicle.currentReading ? Number(vehicle.currentReading).toLocaleString() : "-"}</TableCell>
                  <TableCell className="text-right">
                    <VehicleSheet
                      tenantId={tenantId}
                      vehicle={vehicle}
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
