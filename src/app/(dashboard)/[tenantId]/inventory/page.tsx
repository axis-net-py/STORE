"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  getWarehouses,
  getWarehouseStock,
  createWarehouse,
  transferStock,
  type WarehouseInfo,
  type WarehouseStockRow,
} from "@/app/actions/warehouse";
import { getProducts } from "@/app/actions/product";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { useLanguage } from "@/components/language-provider";
import { toast } from "sonner";
import { Plus, ArrowLeftRight, Boxes, Star } from "lucide-react";

const fmtQty = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);

const texts = {
  pt: {
    title: "Estoque",
    subtitle: "Saldos por depósito e transferências",
    warehouse: "Depósito",
    newWarehouse: "Novo Depósito",
    transfer: "Transferir",
    product: "Produto",
    sku: "SKU",
    inWarehouse: "Neste depósito",
    total: "Total geral",
    empty: "Nenhum saldo neste depósito ainda. As próximas compras entram no depósito padrão.",
    name: "Nome",
    code: "Código (ex.: FILIAL1)",
    save: "Salvar",
    cancel: "Cancelar",
    from: "Origem",
    to: "Destino",
    qty: "Quantidade",
    created: "Depósito criado",
    transferred: "Transferência realizada",
    default: "Padrão",
    search: "Buscar por SKU ou nome do produto...",
    searchLabel: "Buscar",
  },
  es: {
    title: "Inventario",
    subtitle: "Saldos por depósito y transferencias",
    warehouse: "Depósito",
    newWarehouse: "Nuevo Depósito",
    transfer: "Transferir",
    product: "Producto",
    sku: "SKU",
    inWarehouse: "En este depósito",
    total: "Total general",
    empty: "Ningún saldo en este depósito aún. Las próximas compras entran al depósito predeterminado.",
    name: "Nombre",
    code: "Código (ej.: FILIAL1)",
    save: "Guardar",
    cancel: "Cancelar",
    from: "Origen",
    to: "Destino",
    qty: "Cantidad",
    created: "Depósito creado",
    transferred: "Transferencia realizada",
    default: "Predeterminado",
    search: "Buscar por SKU o nombre del producto...",
    searchLabel: "Buscar",
  },
};

export default function InventoryPage() {
  const { language } = useLanguage();
  const t = texts[language as "pt" | "es"] || texts.pt;

  const [warehouses, setWarehouses] = useState<WarehouseInfo[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [rows, setRows] = useState<WarehouseStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Novo depósito
  const [openNew, setOpenNew] = useState(false);
  const [whName, setWhName] = useState("");
  const [whCode, setWhCode] = useState("");

  // Transferência
  const [openTransfer, setOpenTransfer] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [tProduct, setTProduct] = useState("");
  const [tFrom, setTFrom] = useState("");
  const [tTo, setTTo] = useState("");
  const [tQty, setTQty] = useState("");
  const [saving, setSaving] = useState(false);

  const loadWarehouses = useCallback(async () => {
    try {
      const ws = await getWarehouses();
      setWarehouses(ws);
      if (ws.length > 0) {
        setActiveId((prev) => (prev && ws.some((w) => w.id === prev) ? prev : ws[0].id));
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar depósitos");
    }
  }, []);

  const loadStock = useCallback(async (warehouseId: string) => {
    if (!warehouseId) return;
    setLoading(true);
    try {
      setRows(await getWarehouseStock(warehouseId));
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar saldos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  useEffect(() => {
    if (activeId) loadStock(activeId);
  }, [activeId, loadStock]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createWarehouse({ name: whName, code: whCode });
      toast.success(t.created);
      setOpenNew(false);
      setWhName("");
      setWhCode("");
      loadWarehouses();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar depósito");
    } finally {
      setSaving(false);
    }
  };

  const openTransferDialog = async () => {
    setOpenTransfer(true);
    setTProduct("");
    setTFrom(activeId);
    setTTo("");
    setTQty("");
    try {
      const p = await getProducts();
      setProducts(p.filter((x: any) => x.isActive && !x.isService));
    } catch {
      toast.error("Erro ao carregar produtos");
    }
  };

  const handleTransfer = async () => {
    const qty = parseFloat(tQty.replace(",", "."));
    setSaving(true);
    try {
      await transferStock({
        productId: tProduct,
        fromWarehouseId: tFrom,
        toWarehouseId: tTo,
        quantity: qty,
      });
      toast.success(t.transferred);
      setOpenTransfer(false);
      loadStock(activeId);
    } catch (err: any) {
      toast.error(err.message || "Erro na transferência");
    } finally {
      setSaving(false);
    }
  };

  const filtered = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 md:space-y-6 max-w-full overflow-x-hidden">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <>
            <Button variant="outline" className="h-11 sm:h-10 flex-1 sm:flex-none" onClick={() => setOpenNew(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              {t.newWarehouse}
            </Button>
            <Button
              className="h-11 sm:h-10 flex-1 sm:flex-none"
              onClick={openTransferDialog}
              disabled={warehouses.length < 2}
            >
              <ArrowLeftRight className="h-4 w-4 mr-1.5" />
              {t.transfer}
            </Button>
          </>
        }
      />

      {/* Barra de filtros padrão */}
      <FilterBar>
        <FilterField label={t.warehouse}>
          <Select value={activeId} onValueChange={setActiveId}>
            <SelectTrigger className="w-full sm:w-[260px] h-10 sm:h-9 rounded-lg bg-card text-[13px] font-medium">
              <SelectValue placeholder={t.warehouse} />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name} ({w.code}){w.isDefault ? " ★" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t.searchLabel} grow>
          <Input
            placeholder={t.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 sm:h-9 rounded-lg border-border bg-card text-[13px]"
          />
        </FilterField>
      </FilterBar>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 md:h-12 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
            <Boxes className="h-8 w-8 opacity-40" />
            {t.empty}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop: tabela */}
          <Card className="hidden md:block overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.sku}</TableHead>
                  <TableHead>{t.product}</TableHead>
                  <TableHead className="text-right">{t.inWarehouse}</TableHead>
                  <TableHead className="text-right">{t.total}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.productId}>
                    <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {fmtQty(r.quantity)} {r.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmtQty(r.totalStock)} {r.unit}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: cards */}
          <div className="md:hidden space-y-2.5">
            {filtered.map((r) => (
              <Card key={r.productId} className="overflow-hidden">
                <CardContent className="p-3.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{r.name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">{r.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold tabular-nums">
                      {fmtQty(r.quantity)} {r.unit}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.total}: {fmtQty(r.totalStock)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Dialog: novo depósito */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)] rounded-lg">
          <DialogHeader>
            <DialogTitle>{t.newWarehouse}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wh-name">{t.name}</Label>
              <Input id="wh-name" value={whName} onChange={(e) => setWhName(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wh-code">{t.code}</Label>
              <Input
                id="wh-code"
                value={whCode}
                onChange={(e) => setWhCode(e.target.value.toUpperCase())}
                className="h-11 font-mono uppercase"
                maxLength={12}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-11" onClick={() => setOpenNew(false)} disabled={saving}>
              {t.cancel}
            </Button>
            <Button className="h-11" onClick={handleCreate} disabled={saving || !whName || !whCode}>
              {saving ? "..." : t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: transferência */}
      <Dialog open={openTransfer} onOpenChange={setOpenTransfer}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] rounded-lg">
          <DialogHeader>
            <DialogTitle>{t.transfer}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.product}</Label>
              <Select value={tProduct} onValueChange={setTProduct}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t.from}</Label>
                <Select value={tFrom} onValueChange={setTFrom}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t.to}</Label>
                <Select value={tTo} onValueChange={setTTo}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses
                      .filter((w) => w.id !== tFrom)
                      .map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-qty">{t.qty}</Label>
              <Input
                id="t-qty"
                type="number"
                inputMode="decimal"
                min={0.01}
                step="any"
                value={tQty}
                onChange={(e) => setTQty(e.target.value)}
                className="h-11 tabular-nums"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-11" onClick={() => setOpenTransfer(false)} disabled={saving}>
              {t.cancel}
            </Button>
            <Button
              className="h-11"
              onClick={handleTransfer}
              disabled={saving || !tProduct || !tFrom || !tTo || !tQty}
            >
              {saving ? "..." : t.transfer}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
