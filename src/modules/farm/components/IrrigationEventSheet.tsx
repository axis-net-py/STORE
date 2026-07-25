"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { createIrrigationEvent } from "@/modules/farm/actions/irrigationEvent";
import type { Employee } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    newTrigger: "Novo Turno de Irrigação",
    description: "Registre um turno de irrigação deste talhão.",
    date: "Data",
    method: "Método",
    pivo: "Pivô Central",
    gotejamento: "Gotejamento",
    aspersao: "Aspersão",
    sulco: "Sulco",
    outro: "Outro",
    duration: "Duração (h)",
    flowRate: "Vazão",
    volumeApplied: "Volume Aplicado",
    volumePlaceholder: "mm ou m³",
    employee: "Funcionário",
    employeePlaceholder: "Selecione (opcional)",
    notInformed: "Não informado",
    notes: "Observações",
    saveErr: "Erro ao registrar turno de irrigação",
    cancel: "Cancelar",
    saving: "Salvando...",
    register: "Registrar",
  },
  es: {
    newTrigger: "Nuevo Turno de Riego",
    description: "Registre un turno de riego de esta parcela.",
    date: "Fecha",
    method: "Método",
    pivo: "Pivote Central",
    gotejamento: "Goteo",
    aspersao: "Aspersión",
    sulco: "Surco",
    outro: "Otro",
    duration: "Duración (h)",
    flowRate: "Caudal",
    volumeApplied: "Volumen Aplicado",
    volumePlaceholder: "mm o m³",
    employee: "Empleado",
    employeePlaceholder: "Seleccione (opcional)",
    notInformed: "No informado",
    notes: "Observaciones",
    saveErr: "Error al registrar el turno de riego",
    cancel: "Cancelar",
    saving: "Guardando...",
    register: "Registrar",
  },
} as const;

export function IrrigationEventSheet({ plotId, employees }: { plotId: string; employees: Employee[] }) {
  const router = useRouter();
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("pivo");
  const [durationHours, setDurationHours] = useState("");
  const [flowRate, setFlowRate] = useState("");
  const [volumeApplied, setVolumeApplied] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;

    setLoading(true);
    try {
      await createIrrigationEvent({
        plotId,
        date: new Date(date),
        method: method || undefined,
        durationHours: durationHours ? Number(durationHours) : undefined,
        flowRate: flowRate ? Number(flowRate) : undefined,
        volumeApplied: volumeApplied ? Number(volumeApplied) : undefined,
        employeeId: employeeId || undefined,
        notes: notes || undefined,
      });
      setOpen(false);
      setDurationHours("");
      setFlowRate("");
      setVolumeApplied("");
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
        <button className="px-4 h-[32px] rounded-[8px] text-[13px] font-bold border border-border bg-background hover:bg-muted transition-all">
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
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.method}</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="pivo" className="text-[12px]">{s.pivo}</SelectItem>
                  <SelectItem value="gotejamento" className="text-[12px]">{s.gotejamento}</SelectItem>
                  <SelectItem value="aspersao" className="text-[12px]">{s.aspersao}</SelectItem>
                  <SelectItem value="sulco" className="text-[12px]">{s.sulco}</SelectItem>
                  <SelectItem value="outro" className="text-[12px]">{s.outro}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.duration}</Label>
              <Input
                type="number"
                step="0.1"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.flowRate}</Label>
              <Input
                type="number"
                step="0.01"
                value={flowRate}
                onChange={(e) => setFlowRate(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.volumeApplied}</Label>
              <Input
                type="number"
                step="0.01"
                value={volumeApplied}
                onChange={(e) => setVolumeApplied(e.target.value)}
                placeholder={s.volumePlaceholder}
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
