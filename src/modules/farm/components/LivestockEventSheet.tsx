"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Scale, Syringe, MapPinned } from "lucide-react";
import { createLivestockEvent } from "@/modules/farm/actions/livestockEvent";
import type { Employee, LivestockEventType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    newTrigger: "Novo Evento",
    title: "Novo Evento do Lote",
    description: "Registre pesagem, sanidade ou movimentação do lote.",
    weighing: "Pesagem",
    health: "Sanidade",
    movement: "Movimentação",
    date: "Data",
    weight: "Peso Médio do Lote (kg)",
    healthDesc: "Descrição",
    healthDescPlaceholder: "Ex: Vacina aftosa, vermifugação",
    newLocation: "Novo Piquete/Pasto",
    newLocationPlaceholder: "Ex: Piquete 5",
    employee: "Funcionário",
    employeePlaceholder: "Selecione (opcional)",
    notInformed: "Não informado",
    notes: "Observações",
    cancel: "Cancelar",
    saving: "Salvando...",
    register: "Registrar",
    saveErr: "Erro ao registrar evento",
  },
  es: {
    newTrigger: "Nuevo Evento",
    title: "Nuevo Evento del Lote",
    description: "Registre pesaje, sanidad o movimiento del lote.",
    weighing: "Pesaje",
    health: "Sanidad",
    movement: "Movimiento",
    date: "Fecha",
    weight: "Peso Promedio del Lote (kg)",
    healthDesc: "Descripción",
    healthDescPlaceholder: "Ej: Vacuna aftosa, desparasitación",
    newLocation: "Nuevo Potrero/Pastura",
    newLocationPlaceholder: "Ej: Potrero 5",
    employee: "Empleado",
    employeePlaceholder: "Seleccione (opcional)",
    notInformed: "No informado",
    notes: "Observaciones",
    cancel: "Cancelar",
    saving: "Guardando...",
    register: "Registrar",
    saveErr: "Error al registrar evento",
  },
} as const;

export function LivestockEventSheet({ batchId, employees }: { batchId: string; employees: Employee[] }) {
  const router = useRouter();
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [type, setType] = useState<LivestockEventType>("WEIGHING");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [weight, setWeight] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;

    setLoading(true);
    try {
      await createLivestockEvent({
        batchId,
        type,
        date: new Date(date),
        weight: type === "WEIGHING" && weight ? Number(weight) : undefined,
        location: type === "MOVEMENT" ? location || undefined : undefined,
        description: type === "HEALTH" ? description || undefined : undefined,
        employeeId: employeeId || undefined,
        notes: notes || undefined,
      });
      setOpen(false);
      setWeight("");
      setLocation("");
      setDescription("");
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
          <DialogTitle className="text-[18px] font-bold tracking-tight text-foreground">{s.title}</DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground font-medium">
            {s.description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setType("WEIGHING")}
              className={cn(
                "h-[40px] rounded-[8px] text-[12px] font-bold flex items-center justify-center gap-1.5 border transition-all",
                type === "WEIGHING" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"
              )}
            >
              <Scale className="w-4 h-4" /> {s.weighing}
            </button>
            <button
              type="button"
              onClick={() => setType("HEALTH")}
              className={cn(
                "h-[40px] rounded-[8px] text-[12px] font-bold flex items-center justify-center gap-1.5 border transition-all",
                type === "HEALTH" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"
              )}
            >
              <Syringe className="w-4 h-4" /> {s.health}
            </button>
            <button
              type="button"
              onClick={() => setType("MOVEMENT")}
              className={cn(
                "h-[40px] rounded-[8px] text-[12px] font-bold flex items-center justify-center gap-1.5 border transition-all",
                type === "MOVEMENT" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"
              )}
            >
              <MapPinned className="w-4 h-4" /> {s.movement}
            </button>
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

          {type === "WEIGHING" && (
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.weight}</Label>
              <Input
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
          )}

          {type === "HEALTH" && (
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.healthDesc}</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={s.healthDescPlaceholder}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
          )}

          {type === "MOVEMENT" && (
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.newLocation}</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={s.newLocationPlaceholder}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
          )}

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
