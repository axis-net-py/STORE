"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  getOrders,
  createOrder,
  cancelOrder,
  convertOrderToInvoice,
  type OrderListItem,
} from "@/app/actions/orders";
import { getCustomers } from "@/app/actions/customer";
import { getSuppliers } from "@/app/actions/supplier";
import { getProducts } from "@/app/actions/product";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useLanguage } from "@/components/language-provider";
import { toast } from "sonner";
import { Plus, Trash2, FileCheck2, XCircle, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const fmtGs = (n: number) =>
  `${new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n)} Gs.`;
const fmtDate = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

const texts = {
  pt: {
    title: "Pedidos",
    subtitle: "Pedidos de venda e de compra (pré-faturamento)",
    newOrder: "Novo Pedido",
    all: "Todos",
    sales: "Venda",
    purchase: "Compra",
    number: "Número",
    entity: "Cliente/Fornecedor",
    expected: "Previsão",
    total: "Total",
    status: "Status",
    items: "itens",
    invoice: "Faturar",
    cancel: "Cancelar",
    empty: "Nenhum pedido registrado.",
    type: "Tipo",
    customer: "Cliente",
    supplier: "Fornecedor",
    expectedDate: "Data prevista",
    notes: "Observações",
    product: "Produto",
    qty: "Qtd.",
    price: "Preço unit.",
    addItem: "Adicionar item",
    save: "Salvar Pedido",
    close: "Fechar",
    created: "Pedido criado",
    invoiced: "Pedido faturado com sucesso!",
    cancelled: "Pedido cancelado",
    confirmInvoice: "Gerar a fatura deste pedido? Estoque e contabilidade serão atualizados.",
    statuses: {
      DRAFT: "Rascunho",
      CONFIRMED: "Confirmado",
      INVOICED: "Faturado",
      CANCELLED: "Cancelado",
    } as Record<string, string>,
  },
  es: {
    title: "Pedidos",
    subtitle: "Pedidos de venta y de compra (pre-facturación)",
    newOrder: "Nuevo Pedido",
    all: "Todos",
    sales: "Venta",
    purchase: "Compra",
    number: "Número",
    entity: "Cliente/Proveedor",
    expected: "Previsión",
    total: "Total",
    status: "Estado",
    items: "ítems",
    invoice: "Facturar",
    cancel: "Cancelar",
    empty: "Ningún pedido registrado.",
    type: "Tipo",
    customer: "Cliente",
    supplier: "Proveedor",
    expectedDate: "Fecha prevista",
    notes: "Observaciones",
    product: "Producto",
    qty: "Cant.",
    price: "Precio unit.",
    addItem: "Agregar ítem",
    save: "Guardar Pedido",
    close: "Cerrar",
    created: "Pedido creado",
    invoiced: "¡Pedido facturado con éxito!",
    cancelled: "Pedido cancelado",
    confirmInvoice: "¿Generar la factura de este pedido? Stock y contabilidad serán actualizados.",
    statuses: {
      DRAFT: "Borrador",
      CONFIRMED: "Confirmado",
      INVOICED: "Facturado",
      CANCELLED: "Cancelado",
    } as Record<string, string>,
  },
};

type ItemRow = { productId: string; quantity: string; unitPrice: string };

const statusVariant = (s: string) =>
  s === "INVOICED" ? "default" : s === "CANCELLED" ? "destructive" : s === "CONFIRMED" ? "secondary" : "outline";

export default function OrdersPage() {
  const { language } = useLanguage();
  const t = texts[language as "pt" | "es"] || texts.pt;

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | "SALES" | "PURCHASE">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Novo pedido
  const [open, setOpen] = useState(false);
  const [orderType, setOrderType] = useState<"SALES" | "PURCHASE">("SALES");
  const [entityId, setEntityId] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<ItemRow[]>([{ productId: "", quantity: "1", unitPrice: "" }]);
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await getOrders());
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const openNew = async () => {
    setOpen(true);
    setOrderType("SALES");
    setEntityId("");
    setExpectedAt("");
    setNotes("");
    setRows([{ productId: "", quantity: "1", unitPrice: "" }]);
    try {
      const [c, s, p] = await Promise.all([getCustomers(), getSuppliers(), getProducts()]);
      setCustomers(c.filter((x: any) => x.isActive));
      setSuppliers(s.filter((x: any) => x.isActive));
      setProducts(p.filter((x: any) => x.isActive));
    } catch {
      toast.error("Erro ao carregar cadastros");
    }
  };

  const setRow = (idx: number, patch: Partial<ItemRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const pickProduct = (idx: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    const price = prod ? (orderType === "SALES" ? prod.price : prod.cost) : "";
    setRow(idx, { productId, unitPrice: price !== "" ? String(price) : "" });
  };

  const orderTotal = rows.reduce((s, r) => {
    const q = parseFloat(r.quantity.replace(",", ".")) || 0;
    const p = parseFloat(r.unitPrice.replace(",", ".")) || 0;
    return s + q * p;
  }, 0);

  const handleSave = async () => {
    const items = rows
      .filter((r) => r.productId)
      .map((r) => ({
        productId: r.productId,
        quantity: parseFloat(r.quantity.replace(",", ".")) || 0,
        unitPrice: parseFloat(r.unitPrice.replace(",", ".")) || 0,
      }));

    setSaving(true);
    try {
      const res = await createOrder({
        type: orderType,
        entityId,
        expectedAt: expectedAt ? new Date(`${expectedAt}T12:00:00`) : undefined,
        notes: notes || undefined,
        items,
      });
      toast.success(`${t.created}: ${res.orderNumber}`);
      setOpen(false);
      loadOrders();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar pedido");
    } finally {
      setSaving(false);
    }
  };

  const handleInvoice = async (order: OrderListItem) => {
    if (!window.confirm(t.confirmInvoice)) return;
    setBusyId(order.id);
    try {
      await convertOrderToInvoice(order.id);
      toast.success(t.invoiced);
      loadOrders();
    } catch (err: any) {
      toast.error(err.message || "Erro ao faturar pedido");
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (order: OrderListItem) => {
    setBusyId(order.id);
    try {
      await cancelOrder(order.id);
      toast.success(t.cancelled);
      loadOrders();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cancelar pedido");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = orders.filter((o) => typeFilter === "all" || o.type === typeFilter);

  const OrderActions = ({ order }: { order: OrderListItem }) =>
    order.status === "CONFIRMED" || order.status === "DRAFT" ? (
      <div className="flex items-center gap-1.5 justify-end">
        <Button
          size="sm"
          className="h-9"
          disabled={busyId === order.id}
          onClick={() => handleInvoice(order)}
        >
          <FileCheck2 className="h-3.5 w-3.5 mr-1" />
          {t.invoice}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-9 text-muted-foreground hover:text-destructive"
          disabled={busyId === order.id}
          onClick={() => handleCancel(order)}
          title={t.cancel}
        >
          <XCircle className="h-4 w-4" />
        </Button>
      </div>
    ) : null;

  return (
    <div className="space-y-4 md:space-y-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button className="h-11 sm:h-10 w-full sm:w-auto" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1.5" />
          {t.newOrder}
        </Button>
      </div>

      {/* Filtro por tipo */}
      <div className="flex rounded-lg border border-border bg-card p-1 gap-1 w-full md:w-fit">
        {(
          [
            { key: "all", label: t.all },
            { key: "SALES", label: t.sales },
            { key: "PURCHASE", label: t.purchase },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setTypeFilter(opt.key)}
            className={cn(
              "flex-1 md:flex-none md:px-6 h-10 rounded-md text-sm font-medium transition-all",
              typeFilter === opt.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 md:h-12 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
            <ClipboardList className="h-8 w-8 opacity-40" />
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
                  <TableHead>{t.number}</TableHead>
                  <TableHead>{t.type}</TableHead>
                  <TableHead>{t.entity}</TableHead>
                  <TableHead>{t.expected}</TableHead>
                  <TableHead className="text-right">{t.total}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead className="w-44"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>
                    <TableCell>
                      <Badge variant={o.type === "PURCHASE" ? "default" : "secondary"}>
                        {o.type === "PURCHASE" ? t.purchase : t.sales}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{o.entityName}</TableCell>
                    <TableCell>{fmtDate(o.expectedAt)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmtGs(o.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(o.status)}>{t.statuses[o.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <OrderActions order={o} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: cards */}
          <div className="md:hidden space-y-2.5">
            {filtered.map((o) => (
              <Card key={o.id} className="overflow-hidden active:scale-[0.99] transition-transform">
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{o.entityName}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        {o.orderNumber} · {o.itemCount} {t.items}
                      </p>
                    </div>
                    <Badge variant={statusVariant(o.status)} className="shrink-0 text-[10px]">
                      {t.statuses[o.status]}
                    </Badge>
                  </div>
                  <div className="mt-2.5 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[11px] text-muted-foreground">
                        {o.type === "PURCHASE" ? t.purchase : t.sales} · {fmtDate(o.expectedAt)}
                      </p>
                      <p className="text-base font-bold tabular-nums">{fmtGs(o.totalAmount)}</p>
                    </div>
                    <OrderActions order={o} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Dialog: novo pedido */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] rounded-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.newOrder}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t.type}</Label>
                <Select
                  value={orderType}
                  onValueChange={(v) => {
                    setOrderType(v as "SALES" | "PURCHASE");
                    setEntityId("");
                  }}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SALES">{t.sales}</SelectItem>
                    <SelectItem value="PURCHASE">{t.purchase}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{orderType === "SALES" ? t.customer : t.supplier}</Label>
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {(orderType === "SALES" ? customers : suppliers).map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="order-expected">{t.expectedDate}</Label>
              <Input
                id="order-expected"
                type="date"
                value={expectedAt}
                onChange={(e) => setExpectedAt(e.target.value)}
                className="h-11"
              />
            </div>

            {/* Itens */}
            <div className="space-y-2">
              <Label>
                {t.product} / {t.qty} / {t.price}
              </Label>
              {rows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_72px_100px_36px] sm:grid-cols-[1fr_90px_130px_40px] gap-1.5 items-center">
                  <Select value={row.productId} onValueChange={(v) => pickProduct(idx, v)}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={t.product} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0.01}
                    step="any"
                    value={row.quantity}
                    onChange={(e) => setRow(idx, { quantity: e.target.value })}
                    className="h-11 tabular-nums"
                    placeholder={t.qty}
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step="any"
                    value={row.unitPrice}
                    onChange={(e) => setRow(idx, { unitPrice: e.target.value })}
                    className="h-11 tabular-nums"
                    placeholder={t.price}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-9 sm:w-10 text-muted-foreground hover:text-destructive"
                    disabled={rows.length === 1}
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full sm:w-auto"
                onClick={() => setRows((prev) => [...prev, { productId: "", quantity: "1", unitPrice: "" }])}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t.addItem}
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="order-notes">{t.notes}</Label>
              <Textarea id="order-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <p className="text-right text-sm">
              {t.total}: <span className="font-bold tabular-nums">{fmtGs(orderTotal)}</span>
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-11" onClick={() => setOpen(false)} disabled={saving}>
              {t.close}
            </Button>
            <Button
              className="h-11"
              onClick={handleSave}
              disabled={saving || !entityId || rows.every((r) => !r.productId)}
            >
              {saving ? "..." : t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
