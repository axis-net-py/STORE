"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CustomerSheet } from "@/components/CustomerSheet";
import type { Customer } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, ChevronUp, ChevronDown } from "lucide-react";

type CustomerSortField = "name" | "document" | "email" | "category" | "isActive";

export function CustomerList({ customers, tenantId }: { customers: Customer[]; tenantId: string }) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<CustomerSortField | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const SortIcon = ({ field }: { field: CustomerSortField }) =>
    sortField !== field ? null : sortOrder === "asc"
      ? <ChevronUp className="inline w-3 h-3 ml-1 text-primary" />
      : <ChevronDown className="inline w-3 h-3 ml-1 text-primary" />;

  const handleSort = (field: CustomerSortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const term = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      (c.document && c.document.toLowerCase().includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term))
    );
  });

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
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
          placeholder="Buscar por Nome, Documento ou E-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md h-[38px] rounded-lg border-border bg-card"
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {sortedCustomers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            description={search ? `Nenhum resultado para "${search}".` : "Adicione o primeiro cliente para começar."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => handleSort("name")} className="cursor-pointer hover:bg-muted/50 select-none">
                  Nome<SortIcon field="name" />
                </TableHead>
                <TableHead onClick={() => handleSort("document")} className="cursor-pointer hover:bg-muted/50 select-none">
                  Documento<SortIcon field="document" />
                </TableHead>
                <TableHead onClick={() => handleSort("email")} className="cursor-pointer hover:bg-muted/50 select-none">
                  E-mail<SortIcon field="email" />
                </TableHead>
                <TableHead onClick={() => handleSort("category")} className="cursor-pointer hover:bg-muted/50 select-none">
                  Categoria<SortIcon field="category" />
                </TableHead>
                <TableHead onClick={() => handleSort("isActive")} className="cursor-pointer hover:bg-muted/50 select-none">
                  Status<SortIcon field="isActive" />
                </TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.document ?? "-"}</TableCell>
                  <TableCell>{customer.email ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {customer.category === "fisica" ? "Física" : customer.category === "juridica" ? "Jurídica" : customer.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.isActive ? "default" : "secondary"}>
                      {customer.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <CustomerSheet tenantId={tenantId} customer={customer} />
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
