"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SupplierSheet } from "@/components/SupplierSheet";
import type { Supplier } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";

export function SupplierList({ suppliers, tenantId }: { suppliers: Supplier[]; tenantId: string }) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"phone" | "businessName" | "document" | "email" | "paymentTerms" | "isActive" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (field: "phone" | "businessName" | "document" | "email" | "paymentTerms" | "isActive") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const term = search.toLowerCase();
    return (
      (s.phone && s.phone.toLowerCase().includes(term)) ||
      (s.businessName && s.businessName.toLowerCase().includes(term)) ||
      (s.document && s.document.toLowerCase().includes(term)) ||
      (s.email && s.email.toLowerCase().includes(term))
    );
  });

  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => {
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

  const renderSortIndicator = (field: typeof sortField) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? " ▴" : " ▾";
  };

  return (
    <div className="space-y-4">
      {/* Barra de filtros padrão */}
      <FilterBar>
        <FilterField label="Buscar" grow>
          <Input
            placeholder="Buscar por razão social, documento, telefone ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 sm:h-9 rounded-lg border-border bg-card text-[13px]"
          />
        </FilterField>
      </FilterBar>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-2.5">
        {sortedSuppliers.length === 0 ? (
          <div className="rounded-lg border border-border bg-card py-10 text-center text-sm text-muted-foreground">
            Nenhum fornecedor cadastrado ou encontrado.
          </div>
        ) : (
          sortedSuppliers.map((supplier) => (
            <div key={supplier.id} className="rounded-lg border border-border bg-card p-3.5 active:scale-[0.99] transition-transform">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{supplier.businessName || supplier.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {supplier.document ? `${supplier.documentType ?? "DOC"}: ${supplier.document}` : "Sem documento"}
                    {supplier.phone ? ` · ${supplier.phone}` : ""}
                  </p>
                </div>
                <Badge variant={supplier.isActive ? "default" : "secondary"} className="shrink-0">
                  {supplier.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-[10px]">{supplier.paymentTerms ?? "Contado"}</Badge>
                <SupplierSheet tenantId={tenantId} supplier={supplier} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden md:block rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSort("businessName")} className="cursor-pointer hover:bg-muted/50 select-none">
                Razão Social{renderSortIndicator("businessName")}
              </TableHead>
              <TableHead onClick={() => handleSort("document")} className="cursor-pointer hover:bg-muted/50 select-none">
                Documento{renderSortIndicator("document")}
              </TableHead>
              <TableHead onClick={() => handleSort("phone")} className="cursor-pointer hover:bg-muted/50 select-none">
                Telefone{renderSortIndicator("phone")}
              </TableHead>
              <TableHead onClick={() => handleSort("email")} className="cursor-pointer hover:bg-muted/50 select-none">
                E-mail{renderSortIndicator("email")}
              </TableHead>
              <TableHead onClick={() => handleSort("paymentTerms")} className="cursor-pointer hover:bg-muted/50 select-none">
                Condição Pagto{renderSortIndicator("paymentTerms")}
              </TableHead>
              <TableHead onClick={() => handleSort("isActive")} className="cursor-pointer hover:bg-muted/50 select-none">
                Status{renderSortIndicator("isActive")}
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSuppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum fornecedor cadastrado ou encontrado.
                </TableCell>
              </TableRow>
            ) : (
              sortedSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.businessName || supplier.name}</TableCell>
                  <TableCell>{supplier.document ? `${supplier.documentType ?? "DOC"}: ${supplier.document}` : "-"}</TableCell>
                  <TableCell>{supplier.phone ?? "-"}</TableCell>
                  <TableCell>{supplier.email ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{supplier.paymentTerms ?? "Contado"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={supplier.isActive ? "default" : "secondary"}>
                      {supplier.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <SupplierSheet
                      tenantId={tenantId}
                      supplier={supplier}
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
