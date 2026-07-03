"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CustomerSheet } from "@/components/CustomerSheet";
import type { Customer } from "@prisma/client";
import { Input } from "@/components/ui/input";

export function CustomerList({ customers, tenantId }: { customers: Customer[]; tenantId: string }) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "document" | "email" | "category" | "isActive" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (field: "name" | "document" | "email" | "category" | "isActive") => {
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

  const renderSortIndicator = (field: typeof sortField) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? " ▴" : " ▾";
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <Input
          placeholder="Buscar por Nome, Documento ou E-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-md h-10 sm:h-[38px] rounded-lg border-border bg-card"
        />
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-2.5">
        {sortedCustomers.length === 0 ? (
          <div className="rounded-lg border border-border bg-card py-10 text-center text-sm text-muted-foreground">
            Nenhum cliente cadastrado ou encontrado.
          </div>
        ) : (
          sortedCustomers.map((customer) => (
            <div key={customer.id} className="rounded-lg border border-border bg-card p-3.5 active:scale-[0.99] transition-transform">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{customer.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {customer.document || "Sem documento"}
                    {customer.email ? ` · ${customer.email}` : ""}
                  </p>
                </div>
                <Badge variant={customer.isActive ? "default" : "secondary"} className="shrink-0">
                  {customer.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <Badge variant="outline" className="capitalize text-[10px]">
                  {customer.category === "fisica" ? "Física" : customer.category === "juridica" ? "Jurídica" : customer.category}
                </Badge>
                <CustomerSheet tenantId={tenantId} customer={customer} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden md:block rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSort("name")} className="cursor-pointer hover:bg-muted/50 select-none">
                Nome{renderSortIndicator("name")}
              </TableHead>
              <TableHead onClick={() => handleSort("document")} className="cursor-pointer hover:bg-muted/50 select-none">
                Documento{renderSortIndicator("document")}
              </TableHead>
              <TableHead onClick={() => handleSort("email")} className="cursor-pointer hover:bg-muted/50 select-none">
                E-mail{renderSortIndicator("email")}
              </TableHead>
              <TableHead onClick={() => handleSort("category")} className="cursor-pointer hover:bg-muted/50 select-none">
                Categoria{renderSortIndicator("category")}
              </TableHead>
              <TableHead onClick={() => handleSort("isActive")} className="cursor-pointer hover:bg-muted/50 select-none">
                Status{renderSortIndicator("isActive")}
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum cliente cadastrado ou encontrado.
                </TableCell>
              </TableRow>
            ) : (
              sortedCustomers.map((customer) => (
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
                    <CustomerSheet
                      tenantId={tenantId}
                      customer={customer}
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
