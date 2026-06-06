"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProductSheet } from "@/components/ProductSheet";
import type { Product } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tag } from "lucide-react";

export function ProductList({ products, tenantId }: { products: Product[]; tenantId: string }) {
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
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

    return matchesSearch && matchesTag && matchesType;
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
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex gap-2 w-full sm:w-auto">
          <Input
            placeholder="Buscar por SKU ou Nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs h-[38px] rounded-lg border-border bg-card"
          />
          <Select value={selectedTag} onValueChange={setSelectedTag}>
            <SelectTrigger className="w-[180px] h-[38px] rounded-lg bg-card">
              <SelectValue placeholder="Filtrar por Tag" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="all">Todas as Tags</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag} value={tag} className="capitalize">
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[180px] h-[38px] rounded-lg bg-card">
              <SelectValue placeholder="Filtrar por Tipo" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="all">Todos os Tipos</SelectItem>
              <SelectItem value="product">Produtos</SelectItem>
              <SelectItem value="service">Serviços</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
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
                    <ProductSheet
                      tenantId={tenantId}
                      product={product}
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
