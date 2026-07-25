"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ServiceSheet } from "@/modules/clinic/components/ServiceSheet";
import type { Service } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList, ChevronUp, ChevronDown } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { COMMON } from "@/lib/ui-strings";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";

type ServiceSortField = "name" | "durationMin" | "price" | "active";

const STRINGS = {
  pt: {
    search: "Buscar serviço...",
    searchLabel: "Buscar",
    duration: "Duração",
    price: "Preço",
    noResults: "Nenhum serviço encontrado",
    noneYet: "Nenhum serviço cadastrado",
    noResultsFor: (q: string) => `Nenhum resultado para "${q}".`,
    addFirst: "Cadastre os serviços agendáveis da clínica.",
    min: "min",
  },
  es: {
    search: "Buscar servicio...",
    searchLabel: "Buscar",
    duration: "Duración",
    price: "Precio",
    noResults: "Ningún servicio encontrado",
    noneYet: "Ningún servicio registrado",
    noResultsFor: (q: string) => `Ningún resultado para "${q}".`,
    addFirst: "Registre los servicios agendables de la clínica.",
    min: "min",
  },
} as const;

export function ServiceList({ services, tenantId }: { services: Service[]; tenantId: string }) {
  const { language } = useLanguage();
  const s = STRINGS[language];
  const c = COMMON[language];
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<ServiceSortField | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const SortIcon = ({ field }: { field: ServiceSortField }) =>
    sortField !== field ? null : sortOrder === "asc"
      ? <ChevronUp className="inline w-3 h-3 ml-1 text-primary" />
      : <ChevronDown className="inline w-3 h-3 ml-1 text-primary" />;

  const handleSort = (field: ServiceSortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const filtered = services.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const sorted = [...filtered].sort((a, b) => {
    if (!sortField) return 0;
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (typeof aVal === "boolean") {
      aVal = aVal ? 1 : 0;
      bVal = bVal ? 1 : 0;
    } else if (sortField === "durationMin" || sortField === "price") {
      aVal = Number(aVal);
      bVal = Number(bVal);
    } else {
      aVal = String(aVal || "").toLowerCase();
      bVal = String(bVal || "").toLowerCase();
    }

    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-4">
      <FilterBar>
        <FilterField label={s.searchLabel} grow>
          <Input
            placeholder={s.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 sm:h-9 rounded-lg border-border bg-card text-[13px]"
          />
        </FilterField>
      </FilterBar>

      <div className="rounded-lg border border-border bg-card">
        {sorted.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={search ? s.noResults : s.noneYet}
            description={search ? s.noResultsFor(search) : s.addFirst}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => handleSort("name")} className="cursor-pointer hover:bg-muted/50 select-none">
                  {c.name}<SortIcon field="name" />
                </TableHead>
                <TableHead onClick={() => handleSort("durationMin")} className="cursor-pointer hover:bg-muted/50 select-none">
                  {s.duration}<SortIcon field="durationMin" />
                </TableHead>
                <TableHead onClick={() => handleSort("price")} className="cursor-pointer hover:bg-muted/50 select-none">
                  {s.price}<SortIcon field="price" />
                </TableHead>
                <TableHead onClick={() => handleSort("active")} className="cursor-pointer hover:bg-muted/50 select-none">
                  {c.status}<SortIcon field="active" />
                </TableHead>
                <TableHead className="text-right">{c.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell>{service.durationMin} {s.min}</TableCell>
                  <TableCell>Gs. {Number(service.price).toLocaleString("es-PY")}</TableCell>
                  <TableCell>
                    <Badge variant={service.active ? "default" : "secondary"}>
                      {service.active ? c.active : c.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ServiceSheet tenantId={tenantId} service={service} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
