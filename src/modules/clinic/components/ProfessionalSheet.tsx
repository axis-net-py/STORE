"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { createProfessional, updateProfessional, deleteProfessional } from "@/modules/clinic/actions/professional";
import type { Professional } from "@prisma/client";
import { toast } from "sonner";
import type { WorkingHours } from "@/modules/clinic/lib/agenda";
import { useLanguage } from "@/components/language-provider";
import { COMMON } from "@/lib/ui-strings";

// ponytail: uma faixa por dia; múltiplas faixas (ex: almoço) quando alguma clínica pedir
const WEEK: { key: string; label: { pt: string; es: string } }[] = [
  { key: "mon", label: { pt: "Seg", es: "Lun" } },
  { key: "tue", label: { pt: "Ter", es: "Mar" } },
  { key: "wed", label: { pt: "Qua", es: "Mié" } },
  { key: "thu", label: { pt: "Qui", es: "Jue" } },
  { key: "fri", label: { pt: "Sex", es: "Vie" } },
  { key: "sat", label: { pt: "Sáb", es: "Sáb" } },
  { key: "sun", label: { pt: "Dom", es: "Dom" } },
];

const STRINGS = {
  pt: {
    newItem: "Novo Profissional",
    editItem: "Editar Profissional",
    editSubtitle: "Atualize os dados do profissional",
    newSubtitle: "Cadastre um profissional para a agenda da clínica.",
    confirmDelete: "Tem certeza que deseja excluir este profissional? Se ele já tiver consultas, será arquivado em vez de apagado (o histórico é preservado).",
    archivedMsg: "Profissional arquivado: tem consultas vinculadas, então o cadastro foi desativado para preservar o histórico.",
    deletedOk: "Profissional excluído com sucesso.",
    deleteErr: "Erro ao excluir profissional.",
    updatedOk: "Profissional atualizado com sucesso.",
    createdOk: "Profissional cadastrado com sucesso.",
    saveErr: "Erro ao salvar profissional.",
    specialty: "Especialidade",
    specialtyPlaceholder: "Ex: Odontologia",
    agendaColor: "Cor da Agenda",
    workingHours: "Horário de Trabalho",
    to: "às",
    notAvailable: "Não atende",
    workingHoursHint: "Sem dias marcados = agenda sempre livre. Slots fora do horário aparecem atenuados, mas continuam agendáveis.",
    register: "Registrar Profissional",
    update: "Atualizar",
  },
  es: {
    newItem: "Nuevo Profesional",
    editItem: "Editar Profesional",
    editSubtitle: "Actualice los datos del profesional",
    newSubtitle: "Registre un profesional para la agenda de la clínica.",
    confirmDelete: "¿Está seguro de eliminar este profesional? Si ya tiene consultas, será archivado en lugar de eliminado (el historial se preserva).",
    archivedMsg: "Profesional archivado: tiene consultas vinculadas, por eso el registro fue desactivado para preservar el historial.",
    deletedOk: "Profesional eliminado con éxito.",
    deleteErr: "Error al eliminar profesional.",
    updatedOk: "Profesional actualizado con éxito.",
    createdOk: "Profesional registrado con éxito.",
    saveErr: "Error al guardar profesional.",
    specialty: "Especialidad",
    specialtyPlaceholder: "Ej: Odontología",
    agendaColor: "Color de la Agenda",
    workingHours: "Horario de Trabajo",
    to: "a",
    notAvailable: "No atiende",
    workingHoursHint: "Sin días marcados = agenda siempre libre. Los horarios fuera de rango aparecen atenuados, pero siguen siendo agendables.",
    register: "Registrar Profesional",
    update: "Actualizar",
  },
} as const;

type DayHours = { enabled: boolean; from: string; to: string };

function toDayState(wh: WorkingHours | null): Record<string, DayHours> {
  const state: Record<string, DayHours> = {};
  for (const { key } of WEEK) {
    const range = wh?.[key]?.[0];
    state[key] = range
      ? { enabled: true, from: range[0], to: range[1] }
      : { enabled: false, from: "08:00", to: "18:00" };
  }
  return state;
}

function toWorkingHours(state: Record<string, DayHours>): WorkingHours | undefined {
  const wh: WorkingHours = {};
  for (const { key } of WEEK) {
    if (state[key].enabled) wh[key] = [[state[key].from, state[key].to]];
  }
  return Object.keys(wh).length > 0 ? wh : undefined;
}

export function ProfessionalSheet({
  tenantId,
  professional,
  onSuccess,
}: {
  tenantId: string;
  professional?: Professional;
  onSuccess?: () => void;
}) {
  const { language } = useLanguage();
  const s = STRINGS[language];
  const c = COMMON[language];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!professional;

  const [name, setName] = useState(professional?.name ?? "");
  const [specialty, setSpecialty] = useState(professional?.specialty ?? "");
  const [color, setColor] = useState(professional?.color ?? "#3e5c50");
  const [active, setActive] = useState(professional?.active ?? true);
  const [hours, setHours] = useState<Record<string, DayHours>>(() =>
    toDayState((professional?.workingHours ?? null) as WorkingHours | null)
  );

  const setDay = (key: string, patch: Partial<DayHours>) =>
    setHours((h) => ({ ...h, [key]: { ...h[key], ...patch } }));

  async function handleDelete() {
    if (!professional) return;
    const confirmDelete = window.confirm(s.confirmDelete);
    if (!confirmDelete) return;

    setLoading(true);
    try {
      const res = await deleteProfessional(professional.id);
      toast.success(res?.archived ? s.archivedMsg : s.deletedOk);
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || s.deleteErr);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;

    setLoading(true);
    try {
      const data = { name, specialty, color, active, workingHours: toWorkingHours(hours) };
      if (isEdit && professional) {
        await updateProfessional(professional.id, data);
      } else {
        await createProfessional(data);
      }
      toast.success(isEdit ? s.updatedOk : s.createdOk);
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || s.saveErr);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="axis-btn-primary min-h-[44px] md:h-[32px] px-6 md:px-4 text-[14px] md:text-[13px] flex items-center justify-center font-bold shadow-md cursor-pointer">
          {isEdit ? c.edit : s.newItem}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] w-[95vw] glass-pop-up p-0 overflow-hidden">
        <DialogHeader className="text-left space-y-1 p-6 border-b border-border bg-muted/30">
          <DialogTitle className="text-[18px] font-bold tracking-tight text-foreground">
            {isEdit ? s.editItem : s.newItem}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground font-medium">
            {isEdit ? s.editSubtitle : s.newSubtitle}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          <div className="space-y-2">
            <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{c.name}</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Dra. María González"
              className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.specialty}</Label>
              <Input
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder={s.specialtyPlaceholder}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.agendaColor}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-[40px] w-[52px] rounded-[8px] border border-border bg-background cursor-pointer p-1"
                />
                <span className="text-[12px] text-muted-foreground font-mono">{color}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.workingHours}</Label>
            <div className="rounded-[8px] border border-border divide-y divide-border">
              {WEEK.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3 px-3 py-1.5">
                  <label className="flex items-center gap-2 w-16 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hours[key].enabled}
                      onChange={(e) => setDay(key, { enabled: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    <span className="text-[12px] font-semibold">{label[language]}</span>
                  </label>
                  {hours[key].enabled ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={hours[key].from}
                        onChange={(e) => setDay(key, { from: e.target.value })}
                        className="h-[30px] rounded-[6px] border border-border bg-background px-1.5 text-[12px]"
                      />
                      <span className="text-[11px] text-muted-foreground">{s.to}</span>
                      <input
                        type="time"
                        value={hours[key].to}
                        onChange={(e) => setDay(key, { to: e.target.value })}
                        className="h-[30px] rounded-[6px] border border-border bg-background px-1.5 text-[12px]"
                      />
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">{s.notAvailable}</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{s.workingHoursHint}</p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="professionalActive"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="professionalActive" className="text-[13px] cursor-pointer">{c.active}</Label>
          </div>

          <div className="mt-4 pt-6 border-t border-border flex justify-between items-center gap-3">
            <div>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 h-[40px] rounded-[8px] text-[14px] font-bold disabled:opacity-50 shadow-md active:scale-95 transition-all"
                >
                  {c.delete}
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 h-[40px] rounded-[8px] text-[14px] font-semibold text-muted-foreground hover:bg-muted transition-all"
              >
                {c.cancel}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-primary text-primary-foreground px-6 h-[40px] rounded-[8px] hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-[14px] font-bold disabled:opacity-50 shadow-md active:scale-95"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin text-secondary" />}
                {loading ? c.saving : isEdit ? s.update : s.register}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
