"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  getOpenInvoices,
  getFinanceSummary,
  registerPayment,
  getInvoicePayments,
  cancelPayment,
  type OpenInvoice,
  type FinanceSummary,
  type PaymentMethodType,
} from "@/app/actions/payments";
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
import {
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  Wallet,
  HandCoins,
  CalendarClock,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fmtGs = (n: number) =>
  `${new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n)} Gs.`;

const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const texts = {
  pt: {
    title: "Financeiro",
    subtitle: "Contas a receber e a pagar",
    receivable: "A Receber",
    payable: "A Pagar",
    overdue: "Vencido",
    receivedMonth: "Recebido no mês",
    paidMonth: "Pago no mês",
    tabReceivable: "Contas a Receber",
    tabPayable: "Contas a Pagar",
    document: "Documento",
    entityCustomer: "Cliente",
    entitySupplier: "Fornecedor",
    dueDate: "Vencimento",
    total: "Total",
    paid: "Pago",
    balance: "Saldo",
    settle: "Baixar",
    settleReceipt: "Registrar Recebimento",
    settlePayment: "Registrar Pagamento",
    amount: "Valor",
    method: "Forma",
    date: "Data",
    notes: "Observações",
    confirm: "Confirmar",
    cancel: "Cancelar",
    empty: "Nenhum título em aberto. 🎉",
    daysLate: "dias em atraso",
    success: "Baixa registrada com sucesso!",
    history: "Baixas anteriores",
    reversed: "Baixa estornada",
    reverse: "Estornar",
    methods: {
      CASH: "Dinheiro",
      BANK_TRANSFER: "Transferência",
      CHECK: "Cheque",
      CARD: "Cartão",
      OTHER: "Outro",
    } as Record<PaymentMethodType, string>,
  },
  es: {
    title: "Finanzas",
    subtitle: "Cuentas a cobrar y a pagar",
    receivable: "A Cobrar",
    payable: "A Pagar",
    overdue: "Vencido",
    receivedMonth: "Cobrado en el mes",
    paidMonth: "Pagado en el mes",
    tabReceivable: "Cuentas a Cobrar",
    tabPayable: "Cuentas a Pagar",
    document: "Documento",
    entityCustomer: "Cliente",
    entitySupplier: "Proveedor",
    dueDate: "Vencimiento",
    total: "Total",
    paid: "Pagado",
    balance: "Saldo",
    settle: "Liquidar",
    settleReceipt: "Registrar Cobro",
    settlePayment: "Registrar Pago",
    amount: "Monto",
    method: "Forma",
    date: "Fecha",
    notes: "Observaciones",
    confirm: "Confirmar",
    cancel: "Cancelar",
    empty: "Ningún título pendiente. 🎉",
    daysLate: "días de atraso",
    success: "¡Liquidación registrada con éxito!",
    history: "Liquidaciones anteriores",
    reversed: "Liquidación revertida",
    reverse: "Revertir",
    methods: {
      CASH: "Efectivo",
      BANK_TRANSFER: "Transferencia",
      CHECK: "Cheque",
      CARD: "Tarjeta",
      OTHER: "Otro",
    } as Record<PaymentMethodType, string>,
  },
};

export default function FinancePage() {
  const { language } = useLanguage();
  const t = texts[language as "pt" | "es"] || texts.pt;

  const [tab, setTab] = useState<"SALES" | "PURCHASE">("SALES");
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialog de baixa
  const [selected, setSelected] = useState<OpenInvoice | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethodType>("CASH");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const loadData = useCallback(async (activeTab: "SALES" | "PURCHASE") => {
    setLoading(true);
    try {
      const [inv, sum] = await Promise.all([getOpenInvoices(activeTab), getFinanceSummary()]);
      setInvoices(inv);
      setSummary(sum);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(tab);
  }, [tab, loadData]);

  const openSettle = (inv: OpenInvoice) => {
    setSelected(inv);
    setAmount(String(Math.round(inv.balance)));
    setMethod("CASH");
    setPaidAt(new Date().toISOString().slice(0, 10));
    setNotes("");
    setHistory([]);
    if (inv.paidAmount > 0) {
      getInvoicePayments(inv.id).then(setHistory).catch(() => {});
    }
  };

  const handleReverse = async (paymentId: string) => {
    try {
      await cancelPayment(paymentId);
      toast.success(t.reversed);
      setSelected(null);
      loadData(tab);
    } catch (err: any) {
      toast.error(err.message || "Erro ao estornar");
    }
  };

  const handleSettle = async () => {
    if (!selected) return;
    const value = parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setSaving(true);
    try {
      await registerPayment({
        invoiceId: selected.id,
        amount: value,
        method,
        paidAt: new Date(`${paidAt}T12:00:00`),
        notes: notes || undefined,
      });
      toast.success(t.success);
      setSelected(null);
      loadData(tab);
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar baixa");
    } finally {
      setSaving(false);
    }
  };

  const totalOpen = useMemo(() => invoices.reduce((s, i) => s + i.balance, 0), [invoices]);

  const kpis = summary
    ? [
        {
          label: t.receivable,
          value: summary.receivableOpen,
          sub: summary.receivableOverdue > 0 ? `${t.overdue}: ${fmtGs(summary.receivableOverdue)}` : null,
          icon: ArrowDownCircle,
          color: "text-emerald-600 dark:text-emerald-400",
        },
        {
          label: t.payable,
          value: summary.payableOpen,
          sub: summary.payableOverdue > 0 ? `${t.overdue}: ${fmtGs(summary.payableOverdue)}` : null,
          icon: ArrowUpCircle,
          color: "text-rose-600 dark:text-rose-400",
        },
        {
          label: t.receivedMonth,
          value: summary.receivedThisMonth,
          sub: null,
          icon: HandCoins,
          color: "text-blue-600 dark:text-blue-400",
        },
        {
          label: t.paidMonth,
          value: summary.paidThisMonth,
          sub: null,
          icon: Wallet,
          color: "text-amber-600 dark:text-amber-400",
        },
      ]
    : [];

  return (
    <div className="space-y-4 md:space-y-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {/* KPI cards — 2 colunas no mobile, 4 no desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {summary
          ? kpis.map((kpi) => (
              <Card key={kpi.label} className="overflow-hidden">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <kpi.icon className={cn("h-4 w-4 shrink-0", kpi.color)} />
                    <span className="text-[11px] md:text-xs font-medium uppercase tracking-wide truncate">
                      {kpi.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-base md:text-xl font-bold tabular-nums truncate">
                    {fmtGs(kpi.value)}
                  </p>
                  {kpi.sub && (
                    <p className="mt-0.5 text-[10px] md:text-xs text-rose-500 flex items-center gap-1 truncate">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {kpi.sub}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[84px] md:h-[96px] rounded-lg" />)}
      </div>

      {/* Tabs — largura total no mobile para toque fácil */}
      <div className="flex rounded-lg border border-border bg-card p-1 gap-1 w-full md:w-fit">
        {(
          [
            { key: "SALES", label: t.tabReceivable },
            { key: "PURCHASE", label: t.tabPayable },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setTab(opt.key)}
            className={cn(
              "flex-1 md:flex-none md:px-6 h-10 rounded-md text-sm font-medium transition-all",
              tab === opt.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 md:h-12 rounded-lg" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">{t.empty}</CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop: tabela */}
          <Card className="hidden md:block overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.document}</TableHead>
                  <TableHead>{tab === "SALES" ? t.entityCustomer : t.entitySupplier}</TableHead>
                  <TableHead>{t.dueDate}</TableHead>
                  <TableHead className="text-right">{t.total}</TableHead>
                  <TableHead className="text-right">{t.paid}</TableHead>
                  <TableHead className="text-right">{t.balance}</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id} className={cn(inv.isOverdue && "bg-rose-500/5")}>
                    <TableCell className="font-mono text-xs">{inv.documentNumber || inv.id.slice(-8)}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{inv.entityName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {fmtDate(inv.dueDate)}
                        {inv.isOverdue && (
                          <Badge variant="destructive" className="text-[10px]">
                            {inv.daysOverdue} {t.daysLate}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtGs(inv.totalAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmtGs(inv.paidAmount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmtGs(inv.balance)}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => openSettle(inv)}>
                        {t.settle}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: cards com alvo de toque grande */}
          <div className="md:hidden space-y-2.5">
            {invoices.map((inv) => (
              <Card
                key={inv.id}
                className={cn("overflow-hidden active:scale-[0.99] transition-transform", inv.isOverdue && "border-rose-500/40")}
              >
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{inv.entityName}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {inv.documentNumber || inv.id.slice(-8)}
                      </p>
                    </div>
                    {inv.isOverdue && (
                      <Badge variant="destructive" className="text-[10px] shrink-0">
                        {inv.daysOverdue} {t.daysLate}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {fmtDate(inv.dueDate)}
                    </span>
                    <span>
                      {t.paid}: {fmtGs(inv.paidAmount)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.balance}</p>
                      <p className="text-base font-bold tabular-nums">{fmtGs(inv.balance)}</p>
                    </div>
                    <Button className="h-11 px-5" onClick={() => openSettle(inv)}>
                      {t.settle}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <p className="text-center text-xs text-muted-foreground pt-1">
              {t.balance}: <span className="font-semibold">{fmtGs(totalOpen)}</span>
            </p>
          </div>
        </>
      )}

      {/* Dialog de baixa */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] rounded-lg">
          <DialogHeader>
            <DialogTitle>{tab === "SALES" ? t.settleReceipt : t.settlePayment}</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium truncate">{selected.entityName}</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {selected.documentNumber || selected.id.slice(-8)} · {t.balance}:{" "}
                  <span className="font-semibold text-foreground">{fmtGs(selected.balance)}</span>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-amount">{t.amount} (Gs.)</Label>
                <Input
                  id="pay-amount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-11 text-base tabular-nums"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t.method}</Label>
                  <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethodType)}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(t.methods) as PaymentMethodType[]).map((m) => (
                        <SelectItem key={m} value={m}>
                          {t.methods[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-date">{t.date}</Label>
                  <Input
                    id="pay-date"
                    type="date"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-notes">{t.notes}</Label>
                <Textarea
                  id="pay-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {history.length > 0 && (
                <div className="space-y-1.5">
                  <Label>{t.history}</Label>
                  <div className="rounded-md border border-border divide-y divide-border max-h-36 overflow-y-auto">
                    {history.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium tabular-nums">{fmtGs(Number(p.amount))}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {fmtDate(p.paidAt)} · {t.methods[p.method as PaymentMethodType] || p.method}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 px-2 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => handleReverse(p.id)}
                          title={t.reverse}
                        >
                          <Undo2 className="h-4 w-4 mr-1" />
                          {t.reverse}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-11" onClick={() => setSelected(null)} disabled={saving}>
              {t.cancel}
            </Button>
            <Button className="h-11" onClick={handleSettle} disabled={saving}>
              {saving ? "..." : t.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
