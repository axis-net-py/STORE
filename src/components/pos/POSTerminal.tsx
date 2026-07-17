"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getProducts } from "@/app/actions/product";
import { getCustomers } from "@/app/actions/customer";
import { createSalesInvoice } from "@/app/actions/invoice";
import { registerPayment } from "@/app/actions/payments";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { useLanguage } from "@/components/language-provider";
import {
  Search,
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  Loader2,
  CheckCircle2,
  Package,
} from "lucide-react";

type CartItem = {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  unitPrice: number;
  taxType: "IVA_10" | "IVA_5" | "EXENTO";
  quantity: number;
  stock: number;
};

const labels = {
  pt: {
    title: "PDV",
    subtitle: "Venda rápida no balcão — fatura e baixa em um clique",
    search: "Buscar produto por nome ou SKU...",
    cart: "Carrinho",
    empty: "Carrinho vazio. Toque em um produto para adicionar.",
    customer: "Cliente",
    walkIn: "Consumidor final",
    method: "Pagamento",
    cash: "Dinheiro",
    card: "Cartão",
    transfer: "Transferência",
    finalize: "Finalizar venda",
    total: "Total",
    success: "Venda concluída!",
    newSale: "Nova venda",
    noProducts: "Nenhum produto encontrado.",
    stock: "estoque",
  },
  es: {
    title: "POS",
    subtitle: "Venta rápida en mostrador — factura y cobro en un clic",
    search: "Buscar producto por nombre o SKU...",
    cart: "Carrito",
    empty: "Carrito vacío. Toca un producto para agregar.",
    customer: "Cliente",
    walkIn: "Consumidor final",
    method: "Pago",
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
    finalize: "Finalizar venta",
    total: "Total",
    success: "¡Venta completada!",
    newSale: "Nueva venta",
    noProducts: "Ningún producto encontrado.",
    stock: "stock",
  },
};

export default function POSTerminal() {
  const { language } = useLanguage();
  const t = labels[language as "pt" | "es"] || labels.pt;

  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [method, setMethod] = useState<"CASH" | "CARD" | "BANK_TRANSFER">("CASH");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getProducts(), getCustomers()])
      .then(([p, c]) => {
        setProducts(p.filter((x: any) => x.isActive));
        setCustomers(c.filter((x: any) => x.isActive));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return products.slice(0, 24);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)
      )
      .slice(0, 24);
  }, [products, query]);

  const addToCart = (p: any) => {
    setCart((prev) => {
      const found = prev.find((i) => i.productId === p.id);
      if (found) {
        return prev.map((i) =>
          i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          unit: p.unit || "un",
          unitPrice: Number(p.price),
          taxType: (p.taxType as CartItem["taxType"]) || "IVA_10",
          quantity: 1,
          stock: Number(p.currentStock),
        },
      ];
    });
  };

  const changeQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (productId: string) =>
    setCart((prev) => prev.filter((i) => i.productId !== productId));

  const total = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const finalize = async () => {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const now = new Date();
      const invoice = await createSalesInvoice({
        type: "SALES",
        customerId: customerId || customers[0]?.id,
        currency: "PYG",
        exchangeRate: 1,
        issuedAt: now,
        dueDate: now,
        notes: "Venda PDV (balcão)",
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          taxType: i.taxType,
        })),
      });
      // Baixa imediata: venda de balcão é sempre paga na hora
      await registerPayment({
        invoiceId: invoice.id,
        amount: total,
        method,
        notes: "Recebimento PDV",
      });
      setDone(invoice.documentNumber || invoice.id.slice(-6));
      setCart([]);
    } catch (e: any) {
      setError(e.message || "Erro ao finalizar venda");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-4 md:space-y-6">
        <PageHeader title={t.title} subtitle={t.subtitle} />
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="h-14 w-14 text-green-500" />
            <div>
              <p className="text-xl font-bold">{t.success}</p>
              <p className="text-muted-foreground text-sm">Fatura #{done}</p>
            </div>
            <Button className="axis-btn-gold" onClick={() => setDone(null)}>
              {t.newSale}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title={t.title} subtitle={t.subtitle} />

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-sm px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Product picker */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.search}
              className="pl-9 h-11"
            />
          </div>

          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {t.noProducts}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  className="rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary/50 hover:shadow-md active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Package className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-[10px] font-mono text-muted-foreground truncate">
                      {p.sku}
                    </span>
                  </div>
                  <p className="text-sm font-semibold leading-tight line-clamp-2">
                    {p.name}
                  </p>
                  <p className="text-sm font-bold text-primary mt-1.5">
                    {formatCurrency(Number(p.price), "PYG")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {Number(p.currentStock)} {p.unit} {t.stock}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 font-bold">
              <ShoppingCart className="h-4 w-4 text-primary" />
              {t.cart}
              {cart.length > 0 && (
                <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </div>

            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {t.empty}
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {cart.map((i) => (
                  <div
                    key={i.productId}
                    className="flex items-center gap-2 rounded-lg border border-border p-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{i.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatCurrency(i.unitPrice, "PYG")} × {i.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => changeQty(i.productId, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-xs font-bold">
                        {i.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => changeQty(i.productId, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removeItem(i.productId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                {t.customer}
              </label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder={t.walkIn} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                {t.method}
              </label>
              <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">{t.cash}</SelectItem>
                  <SelectItem value="CARD">{t.card}</SelectItem>
                  <SelectItem value="BANK_TRANSFER">{t.transfer}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {t.total}
              </span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(total, "PYG")}
              </span>
            </div>

            <Button
              className="w-full axis-btn-gold h-11"
              disabled={cart.length === 0 || submitting}
              onClick={finalize}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t.finalize
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
