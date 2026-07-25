"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmployeeSheet } from "@/modules/farm/components/EmployeeSheet";
import type { Employee } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    searchPlaceholder: "Buscar por Nome, Cargo ou Telefone...",
    name: "Nome completo",
    role: "Cargo",
    phone: "Telefone",
    status: "Status",
    actions: "Ações",
    empty: "Nenhum funcionário cadastrado ou encontrado.",
    statusActive: "Ativo",
    statusLeave: "Licença",
    statusInactive: "Inativo",
  },
  es: {
    searchPlaceholder: "Buscar por Nombre, Cargo o Teléfono...",
    name: "Nombre completo",
    role: "Cargo",
    phone: "Teléfono",
    status: "Estado",
    actions: "Acciones",
    empty: "Ningún empleado registrado o encontrado.",
    statusActive: "Activo",
    statusLeave: "Licencia",
    statusInactive: "Inactivo",
  },
} as const;

export function EmployeeList({ employees, tenantId }: { employees: Employee[]; tenantId: string }) {
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "role" | "phone" | "status" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (field: "name" | "role" | "phone" | "status") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const filtered = employees.filter((e) => {
    const term = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(term) ||
      e.role.toLowerCase().includes(term) ||
      (e.phone && e.phone.toLowerCase().includes(term))
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortField) return 0;
    const aVal = a[sortField];
    const bVal = b[sortField];

    const compA = String(aVal || "").toLowerCase();
    const compB = String(bVal || "").toLowerCase();

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
      case "ACTIVE":
        return <Badge className="bg-emerald-600 hover:bg-emerald-600/90 text-white border-none">{s.statusActive}</Badge>;
      case "LEAVE":
        return <Badge className="bg-amber-600 hover:bg-amber-600/90 text-white border-none">{s.statusLeave}</Badge>;
      case "INACTIVE":
        return <Badge variant="secondary">{s.statusInactive}</Badge>;
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
              <TableHead onClick={() => handleSort("role")} className="cursor-pointer hover:bg-muted/50 select-none">
                {s.role}{renderSortIndicator("role")}
              </TableHead>
              <TableHead onClick={() => handleSort("phone")} className="cursor-pointer hover:bg-muted/50 select-none">
                {s.phone}{renderSortIndicator("phone")}
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
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {s.empty}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell className="capitalize">{employee.role}</TableCell>
                  <TableCell>{employee.phone ?? "-"}</TableCell>
                  <TableCell>{getStatusBadge(employee.status)}</TableCell>
                  <TableCell className="text-right">
                    <EmployeeSheet
                      tenantId={tenantId}
                      employee={employee}
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
