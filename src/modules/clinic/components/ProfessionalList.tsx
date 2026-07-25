"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProfessionalSheet } from "@/modules/clinic/components/ProfessionalSheet";
import { ProfessionalDeleteButton } from "@/modules/clinic/components/ProfessionalDeleteButton";
import type { Professional } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Stethoscope, ChevronUp, ChevronDown } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { COMMON } from "@/lib/ui-strings";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Switch } from "@/components/ui/switch";

type ProfessionalSortField = "name" | "specialty" | "active";

const STRINGS = {
  pt: {
    search: "Buscar por nome ou especialidade...",
    searchLabel: "Buscar",
    specialty: "Especialidade",
    color: "Cor",
    noResults: "Nenhum profissional encontrado",
    noneYet: "Nenhum profissional cadastrado",
    noResultsFor: (q: string) => `Nenhum resultado para "${q}".`,
    addFirst: "Adicione o primeiro profissional para montar a agenda.",
  },
  es: {
    search: "Buscar por nombre o especialidad...",
    searchLabel: "Buscar",
    specialty: "Especialidad",
    color: "Color",
    noResults: "Ningún profesional encontrado",
    noneYet: "Ningún profesional registrado",
    noResultsFor: (q: string) => `Ningún resultado para "${q}".`,
    addFirst: "Agregue el primer profesional para armar la agenda.",
  },
} as const;

export function ProfessionalList({ professionals, tenantId }: { professionals: Professional[]; tenantId: string }) {
  const { language } = useLanguage();
  const s = STRINGS[language];
  const c = COMMON[language];
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [sortField, setSortField] = useState<ProfessionalSortField | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const SortIcon = ({ field }: { field: ProfessionalSortField }) =>
    sortField !== field ? null : sortOrder === "asc"
      ? <ChevronUp className="inline w-3 h-3 ml-1 text-primary" />
      : <ChevronDown className="inline w-3 h-3 ml-1 text-primary" />;

  const handleSort = (field: ProfessionalSortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const filtered = professionals.filter((p) => {
    const term = search.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(term) ||
      (p.specialty && p.specialty.toLowerCase().includes(term));
    return matchesSearch && (showInactive || p.active);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortField) return 0;
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (typeof aVal === "boolean") {
      aVal = aVal ? 1 : 0;
      bVal = bVal ? 1 : 0;
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
        <FilterField label={c.showInactive}>
          <div className="h-10 sm:h-9 flex items-center gap-2">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
          </div>
        </FilterField>
      </FilterBar>

      <div className="rounded-lg border border-border bg-card">
        {sorted.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
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
                <TableHead onClick={() => handleSort("specialty")} className="cursor-pointer hover:bg-muted/50 select-none">
                  {s.specialty}<SortIcon field="specialty" />
                </TableHead>
                <TableHead>{s.color}</TableHead>
                <TableHead onClick={() => handleSort("active")} className="cursor-pointer hover:bg-muted/50 select-none">
                  {c.status}<SortIcon field="active" />
                </TableHead>
                <TableHead className="text-right">{c.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((professional) => (
                <TableRow key={professional.id}>
                  <TableCell className="font-medium">{professional.name}</TableCell>
                  <TableCell>{professional.specialty ?? "-"}</TableCell>
                  <TableCell>
                    <span
                      className="inline-block h-4 w-4 rounded-full border border-border align-middle"
                      style={{ backgroundColor: professional.color }}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={professional.active ? "default" : "secondary"}>
                      {professional.active ? c.active : c.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ProfessionalSheet tenantId={tenantId} professional={professional} />
                      <ProfessionalDeleteButton professional={professional} />
                    </div>
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
