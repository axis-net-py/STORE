"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { createPlotApplication } from "@/modules/farm/actions/plotApplication";
import type { Employee } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    newTrigger: "Nova Aplicação",
    description: "Registra consumo de insumo neste talhão e baixa o estoque do produto.",
    product: "Insumo",
    productPlaceholder: "Selecione o produto",
    inStock: "em estoque",
    quantity: "Quantidade",
    date: "Data",
    employee: "Funcionário",
    employeePlaceholder: "Selecione (opcional)",
    notInformed: "Não informado",
    notes: "Observações",
    saveErr: "Erro ao registrar aplicação",
    cancel: "Cancelar",
    saving: "Salvando...",
    register: "Registrar",
  },
  es: {
    newTrigger: "Nueva Aplicación",
    description: "Registra el consumo de insumo en esta parcela y descuenta el stock del producto.",
    product: "Insumo",
    productPlaceholder: "Seleccione el producto",
    inStock: "en stock",
    quantity: "Cantidad",
    date: "Fecha",
    employee: "Empleado",
    employeePlaceholder: "Seleccione (opcional)",
    notInformed: "No informado",
    notes: "Observaciones",
    saveErr: "Error al registrar la aplicación",
    cancel: "Cancelar",
    saving: "Guardando...",
    register: "Registrar",
  },
} as const;

export function PlotApplicationSheet({
  plotId,
  products,
  employees,
}: {
  plotId: string;
  products: { id: string; name: string; unit: string; currentStock: any }[];
  employees: Employee[];
}) {
  const router = useRouter();
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [employeeId, setEmployeeId] = useState("");
  const [notes, setNotes] = useState("");

  const selectedProduct = products.find((p) => p.id === productId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !quantity || !date) return;

    setLoading(true);
    try {
      await createPlotApplication({
        plotId,
        productId,
        quantity: Number(quantity),
        date: new Date(date),
        employeeId: employeeId || undefined,
        notes: notes || undefined,
      });
      setOpen(false);
      setProductId("");
      setQuantity("");
      setNotes("");
      router.refresh();
    } catch (err: any) {
      alert(err.message || s.saveErr);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="axis-btn-primary min-h-[44px] md:h-[32px] px-6 md:px-4 text-[14px] md:text-[13px] flex items-center justify-center font-bold shadow-md cursor-pointer">
          {s.newTrigger}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[50vw] w-[95vw] glass-pop-up p-0 overflow-hidden">
        <DialogHeader className="text-left space-y-1 p-6 border-b border-border bg-muted/30">
          <DialogTitle className="text-[18px] font-bold tracking-tight text-foreground">{s.newTrigger}</DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground font-medium">
            {s.description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          <div className="space-y-2">
            <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.product}</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                <SelectValue placeholder={s.productPlaceholder} />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-[12px]">
                    {p.name} ({Number(p.currentStock).toLocaleString()} {p.unit} {s.inStock})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">
                {s.quantity}{selectedProduct ? ` (${selectedProduct.unit})` : ""}
              </Label>
              <Input
                type="number"
                step="0.01"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.date}</Label>
              <Input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.employee}</Label>
            <Select value={employeeId || "none"} onValueChange={(v) => setEmployeeId(v === "none" ? "" : v)}>
              <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                <SelectValue placeholder={s.employeePlaceholder} />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                <SelectItem value="none" className="text-[12px]">{s.notInformed}</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id} className="text-[12px]">{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.notes}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="bg-background border-border text-[13px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
            />
          </div>

          <div className="mt-4 pt-6 border-t border-border flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 h-[40px] rounded-[8px] text-[14px] font-semibold text-muted-foreground hover:bg-muted transition-all"
            >
              {s.cancel}
            </button>
            <button
              type="submit"
              disabled={loading || !productId}
              className="bg-primary text-primary-foreground px-6 h-[40px] rounded-[8px] hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-[14px] font-bold disabled:opacity-50 shadow-md active:scale-95"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin text-secondary" />}
              {loading ? s.saving : s.register}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
