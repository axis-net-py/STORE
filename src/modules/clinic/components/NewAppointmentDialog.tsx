"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { createAppointment } from "@/modules/clinic/actions/appointment";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { COMMON } from "@/lib/ui-strings";

const STRINGS = {
  pt: {
    title: "Nova Consulta",
    subtitle: "Agende um atendimento para um paciente.",
    patient: "Paciente",
    change: "trocar",
    searchPatient: "Buscar paciente pelo nome...",
    noPatients: "Nenhum paciente encontrado. Cadastre em Pacientes.",
    professional: "Profissional",
    service: "Serviço",
    select: "Selecione",
    dateTime: "Data e Hora",
    minutes: "minutos",
    scheduling: "Agendando...",
    schedule: "Agendar",
    scheduledOk: "Consulta agendada.",
    scheduleErr: "Erro ao agendar.",
  },
  es: {
    title: "Nueva Consulta",
    subtitle: "Agende una atención para un paciente.",
    patient: "Paciente",
    change: "cambiar",
    searchPatient: "Buscar paciente por nombre...",
    noPatients: "Ningún paciente encontrado. Regístrelo en Pacientes.",
    professional: "Profesional",
    service: "Servicio",
    select: "Seleccione",
    dateTime: "Fecha y Hora",
    minutes: "minutos",
    scheduling: "Agendando...",
    schedule: "Agendar",
    scheduledOk: "Consulta agendada.",
    scheduleErr: "Error al agendar.",
  },
} as const;

export interface AgendaPatient {
  id: string;
  name: string;
  phone: string | null;
}
export interface AgendaProfessional {
  id: string;
  name: string;
  color: string;
  workingHours?: unknown;
}
export interface AgendaService {
  id: string;
  name: string;
  durationMin: number;
  price: unknown;
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewAppointmentDialog({
  open,
  onOpenChange,
  patients,
  professionals,
  services,
  initialStartsAt,
  initialProfessionalId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patients: AgendaPatient[];
  professionals: AgendaProfessional[];
  services: AgendaService[];
  initialStartsAt?: Date;
  initialProfessionalId?: string;
}) {
  const router = useRouter();
  const { language } = useLanguage();
  const s = STRINGS[language];
  const c = COMMON[language];
  const [loading, setLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientId, setPatientId] = useState("");
  const [professionalId, setProfessionalId] = useState(initialProfessionalId ?? "");
  const [serviceId, setServiceId] = useState("");
  const [startsAt, setStartsAt] = useState(initialStartsAt ? toLocalInputValue(initialStartsAt) : "");

  // Sync prefill when dialog reopens on another slot
  const [lastKey, setLastKey] = useState("");
  const key = `${initialStartsAt?.toISOString() ?? ""}|${initialProfessionalId ?? ""}`;
  if (open && key !== lastKey) {
    setLastKey(key);
    if (initialStartsAt) setStartsAt(toLocalInputValue(initialStartsAt));
    if (initialProfessionalId) setProfessionalId(initialProfessionalId);
  }

  const filteredPatients = useMemo(() => {
    const term = patientSearch.toLowerCase();
    return term ? patients.filter((p) => p.name.toLowerCase().includes(term)) : patients;
  }, [patients, patientSearch]);

  const selectedService = services.find((s) => s.id === serviceId);
  const selectedPatient = patients.find((p) => p.id === patientId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId || !professionalId || !serviceId || !startsAt) return;

    setLoading(true);
    try {
      await createAppointment({ patientId, professionalId, serviceId, startsAt });
      toast.success(s.scheduledOk);
      onOpenChange(false);
      setPatientId("");
      setPatientSearch("");
      setServiceId("");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || s.scheduleErr);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] w-[95vw] glass-pop-up p-0 overflow-hidden">
        <DialogHeader className="text-left space-y-1 p-6 border-b border-border bg-muted/30">
          <DialogTitle className="text-[18px] font-bold tracking-tight text-foreground">{s.title}</DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground font-medium">
            {s.subtitle}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          <div className="space-y-2">
            <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.patient}</Label>
            {selectedPatient ? (
              <div className="flex items-center justify-between h-[40px] px-3 rounded-[8px] border border-primary/40 bg-primary/5 text-[13px] font-medium">
                <span>{selectedPatient.name}</span>
                <button type="button" onClick={() => setPatientId("")} className="text-[12px] text-muted-foreground hover:text-foreground">
                  {s.change}
                </button>
              </div>
            ) : (
              <>
                <Input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder={s.searchPatient}
                  className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
                />
                <div className="max-h-36 overflow-y-auto rounded-[8px] border border-border divide-y divide-border">
                  {filteredPatients.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground p-3">
                      {s.noPatients}
                    </p>
                  ) : (
                    filteredPatients.slice(0, 8).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPatientId(p.id)}
                        className="w-full text-left px-3 py-2 text-[13px] hover:bg-muted transition-colors"
                      >
                        {p.name}
                        {p.phone && <span className="text-muted-foreground text-[11px] ml-2">{p.phone}</span>}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.professional}</Label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                  <SelectValue placeholder={s.select} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-[12px]">
                      <span className="inline-block h-2.5 w-2.5 rounded-full mr-2 align-middle" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.service}</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                  <SelectValue placeholder={s.select} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-[12px]">
                      {s.name} · {s.durationMin}min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.dateTime}</Label>
            <Input
              required
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
            />
            {selectedService && (
              <p className="text-[12px] text-muted-foreground">
                {selectedService.durationMin} {s.minutes} · Gs. {Number(selectedService.price).toLocaleString("es-PY")}
              </p>
            )}
          </div>

          <div className="mt-2 pt-5 border-t border-border flex justify-end gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 h-[40px] rounded-[8px] text-[14px] font-semibold text-muted-foreground hover:bg-muted transition-all"
            >
              {c.cancel}
            </button>
            <button
              type="submit"
              disabled={loading || !patientId || !professionalId || !serviceId || !startsAt}
              className="bg-primary text-primary-foreground px-6 h-[40px] rounded-[8px] hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-[14px] font-bold disabled:opacity-50 shadow-md active:scale-95"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? s.scheduling : s.schedule}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
