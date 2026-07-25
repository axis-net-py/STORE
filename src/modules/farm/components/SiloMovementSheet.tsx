"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { createSiloMovement } from "@/modules/farm/actions/siloMovement";
import type { Harvest, Contract, SiloMovementType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    trigger: "Novo Movimento",
    title: "Novo Movimento de Silo",
    description: "Registre entrada de safra ou saída de embarque do silo.",
    in: "Entrada",
    out: "Saída",
    quantity: "Quantidade",
    date: "Data",
    harvest: "Safra",
    selectOptional: "Selecione (opcional)",
    notInformed: "Não informado",
    moisture: "Umidade (%)",
    qualityGrade: "Grau/Classificação",
    qualityGradePlaceholder: "Ex: Tipo 1",
    contract: "Contrato",
    notLinked: "Não vinculado",
    notes: "Observações",
    cancel: "Cancelar",
    saving: "Salvando...",
    register: "Registrar",
    saveErr: "Erro ao registrar movimento",
  },
  es: {
    trigger: "Nuevo Movimiento",
    title: "Nuevo Movimiento de Silo",
    description: "Registre entrada de cosecha o salida de embarque del silo.",
    in: "Entrada",
    out: "Salida",
    quantity: "Cantidad",
    date: "Fecha",
    harvest: "Cosecha",
    selectOptional: "Seleccione (opcional)",
    notInformed: "No informado",
    moisture: "Humedad (%)",
    qualityGrade: "Grado/Clasificación",
    qualityGradePlaceholder: "Ej: Tipo 1",
    contract: "Contrato",
    notLinked: "No vinculado",
    notes: "Observaciones",
    cancel: "Cancelar",
    saving: "Guardando...",
    register: "Registrar",
    saveErr: "Error al registrar movimiento",
  },
} as const;

export function SiloMovementSheet({
  siloId,
  harvests,
  contracts,
}: {
  siloId: string;
  harvests: Harvest[];
  contracts: Contract[];
}) {
  const router = useRouter();
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [type, setType] = useState<SiloMovementType>("IN");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [harvestId, setHarvestId] = useState("");
  const [contractId, setContractId] = useState("");
  const [moisture, setMoisture] = useState("");
  const [qualityGrade, setQualityGrade] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quantity || !date) return;

    setLoading(true);
    try {
      await createSiloMovement({
        siloId,
        type,
        quantity: Number(quantity),
        date: new Date(date),
        harvestId: type === "IN" ? harvestId || undefined : undefined,
        contractId: type === "OUT" ? contractId || undefined : undefined,
        moisture: type === "IN" && moisture ? Number(moisture) : undefined,
        qualityGrade: type === "IN" ? qualityGrade || undefined : undefined,
        notes: notes || undefined,
      });
      setOpen(false);
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
          {s.trigger}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[50vw] w-[95vw] glass-pop-up p-0 overflow-hidden">
        <DialogHeader className="text-left space-y-1 p-6 border-b border-border bg-muted/30">
          <DialogTitle className="text-[18px] font-bold tracking-tight text-foreground">{s.title}</DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground font-medium">
            {s.description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType("IN")}
              className={cn(
                "h-[40px] rounded-[8px] text-[13px] font-bold flex items-center justify-center gap-2 border transition-all",
                type === "IN" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"
              )}
            >
              <ArrowDownToLine className="w-4 h-4" /> {s.in}
            </button>
            <button
              type="button"
              onClick={() => setType("OUT")}
              className={cn(
                "h-[40px] rounded-[8px] text-[13px] font-bold flex items-center justify-center gap-2 border transition-all",
                type === "OUT" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"
              )}
            >
              <ArrowUpFromLine className="w-4 h-4" /> {s.out}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.quantity}</Label>
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

          {type === "IN" ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.harvest}</Label>
                  <Select value={harvestId || "none"} onValueChange={(v) => setHarvestId(v === "none" ? "" : v)}>
                    <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                      <SelectValue placeholder={s.selectOptional} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-popover-foreground">
                      <SelectItem value="none" className="text-[12px]">{s.notInformed}</SelectItem>
                      {harvests.map((h) => (
                        <SelectItem key={h.id} value={h.id} className="text-[12px]">{h.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.moisture}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={moisture}
                    onChange={(e) => setMoisture(e.target.value)}
                    className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.qualityGrade}</Label>
                <Input
                  value={qualityGrade}
                  onChange={(e) => setQualityGrade(e.target.value)}
                  placeholder={s.qualityGradePlaceholder}
                  className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.contract}</Label>
              <Select value={contractId || "none"} onValueChange={(v) => setContractId(v === "none" ? "" : v)}>
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                  <SelectValue placeholder={s.selectOptional} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="none" className="text-[12px]">{s.notLinked}</SelectItem>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-[12px]">{c.contractNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
              disabled={loading}
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
