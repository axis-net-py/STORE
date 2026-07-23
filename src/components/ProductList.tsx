"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProductSheet } from "@/components/ProductSheet";
import { ProductDeleteButton } from "@/components/ProductDeleteButton";
import type { Product } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Switch } from "@/components/ui/switch";
import { Tag } from "lucide-react";

export function ProductList({ products, tenantId }: { products: Product[]; tenantId: string }) {
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [sortField, setSortField] = useState<"sku" | "name" | "price" | "currentStock" | "isActive" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Collect all unique tags from products
  const allTags = Array.from(
    new Set(
      products
        .flatMap((p) => (p.tags ? p.tags.split(",").map((t) => t.trim().toLowerCase()) : []))
        .filter(Boolean)
    )
  ).sort();

  const handleSort = (field: "sku" | "name" | "price" | "currentStock" | "isActive") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Filter products based on search, selected tag and item type
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase());

    const matchesTag =
      selectedTag === "all" ||
      (p.tags &&
        p.tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .includes(selectedTag));

    const matchesType =
      selectedType === "all" ||
      (selectedType === "service" && p.isService) ||
      (selectedType === "product" && !p.isService);

    const matchesActive = showInactive || p.isActive;

    return matchesSearch && matchesTag && matchesType && matchesActive;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortField) return 0;
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === "price" || sortField === "currentStock") {
      aVal = Number(aVal);
      bVal = Number(bVal);
    } else if (typeof aVal === "boolean") {
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
            placeholder="Buscar por SKU ou nome do produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 sm:h-9 rounded-lg border-border bg-card text-[13px]"
          />
        </FilterField>
        <FilterField label="Tag">
          <Select value={selectedTag} onValueChange={setSelectedTag}>
            <SelectTrigger className="w-full sm:w-[180px] h-10 sm:h-9 rounded-lg bg-card text-[13px] font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="all">Todas as tags</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag} value={tag} className="capitalize">
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Tipo">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full sm:w-[180px] h-10 sm:h-9 rounded-lg bg-card text-[13px] font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="product">Produtos</SelectItem>
              <SelectItem value="service">Serviços</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Inativos">
          <div className="h-10 sm:h-9 flex items-center gap-2">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            <span className="text-[13px] text-muted-foreground">Mostrar</span>
          </div>
        </FilterField>
      </FilterBar>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-2.5">
        {sortedProducts.length === 0 ? (
          <div className="rounded-lg border border-border bg-card py-10 text-center text-sm text-muted-foreground">
            Nenhum produto encontrado.
          </div>
        ) : (
          sortedProducts.map((product) => (
            <div key={product.id} className="rounded-lg border border-border bg-card p-3.5 active:scale-[0.99] transition-transform">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">{product.sku}</p>
                </div>
                <Badge variant={product.isActive ? "default" : "secondary"} className="shrink-0">
                  {product.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>

              {product.tags && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {product.tags.split(",").map((tag) => {
                    const trimmed = tag.trim();
                    if (!trimmed) return null;
                    return (
                      <Badge key={trimmed} variant="outline" className="text-[10px] uppercase font-bold py-0.5 px-1.5 bg-primary/5 text-primary border-primary/20">
                        {trimmed}
                      </Badge>
                    );
                  })}
                </div>
              )}

              <div className="mt-2.5 flex items-end justify-between gap-2">
                <div>
                  <p className="text-base font-bold tabular-nums">
                    {new Intl.NumberFormat((product as any).currency === 'USD' ? 'en-US' : 'pt-BR', {
                      style: 'currency',
                      currency: (product as any).currency || 'PYG',
                      minimumFractionDigits: (product as any).currency === 'PYG' ? 0 : 2,
                      maximumFractionDigits: (product as any).currency === 'PYG' ? 0 : 2,
                    }).format(Number(product.price))}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {product.isService ? (
                      <span className="italic">Serviço</span>
                    ) : (
                      <span className={Number(product.currentStock) <= Number(product.minStock) ? "text-red-500 font-bold" : ""}>
                        Estoque: {Number(product.currentStock)} {product.unit}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <ProductSheet tenantId={tenantId} product={product} />
                  <ProductDeleteButton product={product} />
                </div>
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
              <TableHead onClick={() => handleSort("sku")} className="cursor-pointer hover:bg-muted/50 select-none">
                SKU{renderSortIndicator("sku")}
              </TableHead>
              <TableHead onClick={() => handleSort("name")} className="cursor-pointer hover:bg-muted/50 select-none">
                Nome{renderSortIndicator("name")}
              </TableHead>
              <TableHead onClick={() => handleSort("price")} className="cursor-pointer hover:bg-muted/50 select-none">
                Preço{renderSortIndicator("price")}
              </TableHead>
              <TableHead onClick={() => handleSort("currentStock")} className="cursor-pointer hover:bg-muted/50 select-none">
                Estoque{renderSortIndicator("currentStock")}
              </TableHead>
              <TableHead>Tags</TableHead>
              <TableHead onClick={() => handleSort("isActive")} className="cursor-pointer hover:bg-muted/50 select-none">
                Status{renderSortIndicator("isActive")}
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            ) : (
              sortedProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    {new Intl.NumberFormat((product as any).currency === 'PYG' ? 'pt-BR' : (product as any).currency === 'BRL' ? 'pt-BR' : 'en-US', {
                      style: 'currency',
                      currency: (product as any).currency || 'PYG',
                      minimumFractionDigits: (product as any).currency === 'PYG' ? 0 : 2,
                      maximumFractionDigits: (product as any).currency === 'PYG' ? 0 : 2,
                    }).format(Number(product.price))}
                  </TableCell>
                  <TableCell>
                    {product.isService ? (
                      <span className="text-muted-foreground italic font-medium">Serviço</span>
                    ) : (
                      <span className={Number(product.currentStock) <= Number(product.minStock) ? "text-red-500 font-bold" : ""}>
                        {Number(product.currentStock)} {product.unit}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {product.tags && product.tags.split(",").map((tag) => {
                        const trimmed = tag.trim();
                        if (!trimmed) return null;
                        return (
                          <Badge key={trimmed} variant="outline" className="text-[10px] uppercase font-bold py-0.5 px-1.5 bg-primary/5 text-primary border-primary/20">
                            {trimmed}
                          </Badge>
                        );
                      })}
                      {!product.tags && <span className="text-muted-foreground text-xs">-</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.isActive ? "default" : "secondary"}>
                      {product.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ProductSheet
                        tenantId={tenantId}
                        product={product}
                      />
                      <ProductDeleteButton product={product} />
                    </div>
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
