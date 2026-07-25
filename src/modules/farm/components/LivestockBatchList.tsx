"use client";

import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LivestockBatchSheet } from "@/modules/farm/components/LivestockBatchSheet";
import type { LivestockBatch } from "@prisma/client";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    lot: "Lote",
    category: "Categoria",
    head: "Cabeças",
    averageWeight: "Peso Médio",
    location: "Piquete",
    status: "Status",
    actions: "Ações",
    empty: "Nenhum lote de gado cadastrado.",
    active: "Ativo",
    sold: "Vendido",
    categories: { bezerro: "Bezerro", novilho: "Novilho", vaca: "Vaca", touro: "Touro", boi: "Boi" } as Record<string, string>,
  },
  es: {
    lot: "Lote",
    category: "Categoría",
    head: "Cabezas",
    averageWeight: "Peso Promedio",
    location: "Potrero",
    status: "Estado",
    actions: "Acciones",
    empty: "No hay lotes de ganado registrados.",
    active: "Activo",
    sold: "Vendido",
    categories: { bezerro: "Ternero", novilho: "Novillo", vaca: "Vaca", touro: "Toro", boi: "Buey" } as Record<string, string>,
  },
} as const;

export function LivestockBatchList({ batches, tenantId }: { batches: LivestockBatch[]; tenantId: string }) {
  const { language } = useLanguage();
  const s = STRINGS[language];
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{s.lot}</TableHead>
            <TableHead>{s.category}</TableHead>
            <TableHead>{s.head}</TableHead>
            <TableHead>{s.averageWeight}</TableHead>
            <TableHead>{s.location}</TableHead>
            <TableHead>{s.status}</TableHead>
            <TableHead className="text-right">{s.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                {s.empty}
              </TableCell>
            </TableRow>
          ) : (
            batches.map((batch) => (
              <TableRow key={batch.id}>
                <TableCell className="font-medium">
                  <Link href={`/${tenantId}/rebanho/${batch.id}`} className="hover:underline hover:text-primary">
                    {batch.name}
                  </Link>
                </TableCell>
                <TableCell className="capitalize">{s.categories[batch.category] ?? batch.category}</TableCell>
                <TableCell>{batch.quantity}</TableCell>
                <TableCell>{batch.averageWeight ? `${Number(batch.averageWeight).toLocaleString()} kg` : "-"}</TableCell>
                <TableCell>{batch.location || "-"}</TableCell>
                <TableCell>
                  {batch.status === "ACTIVE" ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600/90 text-white border-none">{s.active}</Badge>
                  ) : (
                    <Badge variant="secondary">{s.sold}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <LivestockBatchSheet batch={batch} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
