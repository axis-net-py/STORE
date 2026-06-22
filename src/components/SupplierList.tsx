"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SupplierSheet } from "@/components/SupplierSheet";
import type { Supplier } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Truck, ChevronUp, ChevronDown } from "lucide-react";

type SupplierSortField = "phone" | "businessName" | "document" | "email" | "paymentTerms" | "isActive";

export function SupplierList({ suppliers, tenantId }: { suppliers: Supplier[]; tenantId: string }) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SupplierSortField | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const SortIcon = ({ field }: { field: SupplierSortField }) =>
    sortField !== field ? null : sortOrder === "asc"
      ? <ChevronUp className="inline w-3 h-3 ml-1 text-primary" />
      : <ChevronDown className="inline w-3 h-3 ml-1 text-primary" />;

  const handleSort = (field: SupplierSortField) => {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <Input
          placeholder="Buscar por Telefone, Razão Social, Documento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md h-[38px] rounded-lg border-border bg-card"
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {sortedSuppliers.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={search ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}
            description={search ? `Nenhum resultado para "${search}".` : "Adicione o primeiro fornecedor para começar."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => handleSort("phone")} className="cursor-pointer hover:bg-muted/50 select-none">
                  Telefone<SortIcon field="phone" />
                </TableHead>
                <TableHead onClick={() => handleSort("businessName")} className="cursor-pointer hover:bg-muted/50 select-none">
                  Razão Social<SortIcon field="businessName" />
                </TableHead>
                <TableHead onClick={() => handleSort("document")} className="cursor-pointer hover:bg-muted/50 select-none">
                  Documento<SortIcon field="document" />
                </TableHead>
                <TableHead onClick={() => handleSort("email")} className="cursor-pointer hover:bg-muted/50 select-none">
                  E-mail<SortIcon field="email" />
                </TableHead>
                <TableHead onClick={() => handleSort("paymentTerms")} className="cursor-pointer hover:bg-muted/50 select-none">
                  Condição Pagto<SortIcon field="paymentTerms" />
                </TableHead>
                <TableHead onClick={() => handleSort("isActive")} className="cursor-pointer hover:bg-muted/50 select-none">
                  Status<SortIcon field="isActive" />
                </TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.phone ?? "-"}</TableCell>
                  <TableCell>{supplier.businessName ?? "-"}</TableCell>
                  <TableCell>{supplier.document ? `${supplier.documentType ?? "DOC"}: ${supplier.document}` : "-"}</TableCell>
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
                    <SupplierSheet tenantId={tenantId} supplier={supplier} />
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
