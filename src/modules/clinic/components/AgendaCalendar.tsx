"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import {
  DAY_START_HOUR,
  DAY_END_HOUR,
  SLOT_MINUTES,
  DAY_TOTAL_MINUTES,
  blockPosition,
  addDays,
  isWithinWorkingHours,
  minutesIntoDay,
  type WorkingHours,
} from "@/modules/clinic/lib/agenda";
import { NewAppointmentDialog, type AgendaPatient, type AgendaService } from "./NewAppointmentDialog";
import { AppointmentPanel, type AgendaAppointment } from "./AppointmentPanel";

interface Professional {
  id: string;
  name: string;
  color: string;
  workingHours: unknown;
}

const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);
const SLOTS_PER_DAY = DAY_TOTAL_MINUTES / SLOT_MINUTES;

const STATUS_DIM: Record<string, string> = {
  CANCELADA: "opacity-35 line-through",
  FALTOU: "opacity-50",
  CONCLUIDA: "opacity-75",
};

const AGENDA_STRINGS = {
  pt: {
    heading: "Agenda",
    subtitle: "Atendimentos por profissional — clique num horário livre para agendar",
    prev: "Anterior",
    next: "Próximo",
    today: "Hoje",
    day: "Dia",
    week: "Semana",
    allProfessionals: "Todos os profissionais",
    newAppointment: "Nova Consulta",
    noProfessionals: "Cadastre profissionais para usar a agenda.",
    outsideHours: "Fora do horário de trabalho",
    bookHere: "Agendar neste horário",
  },
  es: {
    heading: "Agenda",
    subtitle: "Atenciones por profesional — haga clic en un horario libre para agendar",
    prev: "Anterior",
    next: "Siguiente",
    today: "Hoy",
    day: "Día",
    week: "Semana",
    allProfessionals: "Todos los profesionales",
    newAppointment: "Nueva Consulta",
    noProfessionals: "Registre profesionales para usar la agenda.",
    outsideHours: "Fuera del horario de trabajo",
    bookHere: "Agendar en este horario",
  },
} as const;

function fmtDayTitle(d: Date, locale: string): string {
  return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function AgendaCalendar({
  tenantId,
  view,
  anchor, // ISO yyyy-mm-dd of the visible day / any day within visible week
  weekStart,
  appointments,
  professionals,
  services,
  patients,
  selectedProfessionalId,
}: {
  tenantId: string;
  view: "day" | "week";
  anchor: string;
  weekStart: string;
  appointments: AgendaAppointment[];
  professionals: Professional[];
  services: AgendaService[];
  patients: AgendaPatient[];
  selectedProfessionalId: string;
}) {
  const { language } = useLanguage();
  const locale = language === "es" ? "es-PY" : "pt-BR";
  const s = AGENDA_STRINGS[language];
  const anchorDate = useMemo(() => new Date(`${anchor}T00:00:00`), [anchor]);
  const weekStartDate = useMemo(() => new Date(`${weekStart}T00:00:00`), [weekStart]);
  const now = new Date();

  const [newOpen, setNewOpen] = useState(false);
  const [newSlot, setNewSlot] = useState<{ startsAt: Date; professionalId?: string } | undefined>();
  const [selected, setSelected] = useState<AgendaAppointment | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const visibleProfessionals =
    selectedProfessionalId === "all" ? professionals : professionals.filter((p) => p.id === selectedProfessionalId);

  const filteredAppointments =
    selectedProfessionalId === "all"
      ? appointments
      : appointments.filter((a) => a.professional.id === selectedProfessionalId);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));

  const navHref = (delta: number) => {
    const step = view === "day" ? 1 : 7;
    const d = addDays(anchorDate, delta * step);
    return `/${tenantId}/agenda?view=${view}&d=${isoDate(d)}&p=${selectedProfessionalId}`;
  };
  const viewHref = (v: "day" | "week") => `/${tenantId}/agenda?view=${v}&d=${anchor}&p=${selectedProfessionalId}`;
  const profHref = (pid: string) => `/${tenantId}/agenda?view=${view}&d=${anchor}&p=${pid}`;

  function openNew(day: Date, slotIndex: number, professionalId?: string) {
    const startsAt = new Date(day);
    startsAt.setHours(DAY_START_HOUR, slotIndex * SLOT_MINUTES, 0, 0);
    setNewSlot({ startsAt, professionalId });
    setNewOpen(true);
  }

  function openAppointment(a: AgendaAppointment, e: React.MouseEvent) {
    e.stopPropagation();
    setSelected(a);
    setPanelOpen(true);
  }

  const title =
    view === "day"
      ? fmtDayTitle(anchorDate, locale)
      : `${weekDays[0].toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${weekDays[6].toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`;

  // Columns: week view = 7 days; day view = one per professional
  const columns: { key: string; day: Date; professionalId?: string; header: React.ReactNode }[] =
    view === "week"
      ? weekDays.map((d) => ({
          key: isoDate(d),
          day: d,
          header: (
            <div className={`text-center py-2 ${isSameDay(d, now) ? "text-primary" : ""}`}>
              <p className="text-[10px] uppercase tracking-widest font-bold">{d.toLocaleDateString(locale, { weekday: "short" })}</p>
              <p className={`text-[17px] leading-tight ${isSameDay(d, now) ? "font-bold" : "font-medium"}`}>{d.getDate()}</p>
            </div>
          ),
        }))
      : visibleProfessionals.map((p) => ({
          key: p.id,
          day: anchorDate,
          professionalId: p.id,
          header: (
            <div className="flex items-center justify-center gap-2 py-3">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
              <p className="text-[12px] font-semibold truncate">{p.name}</p>
            </div>
          ),
        }));

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 pb-4">
        <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden">
          <Link href={navHref(-1)} className="px-2.5 py-2 hover:bg-muted transition-colors" aria-label={s.prev}>
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <Link
            href={`/${tenantId}/agenda?view=${view}&d=${isoDate(now)}&p=${selectedProfessionalId}`}
            className="px-3 py-2 text-[12px] font-bold border-x border-border hover:bg-muted transition-colors"
          >
            {s.today}
          </Link>
          <Link href={navHref(1)} className="px-2.5 py-2 hover:bg-muted transition-colors" aria-label={s.next}>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <h2 className="text-[15px] font-semibold capitalize">{title}</h2>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card overflow-hidden text-[12px] font-bold">
            <Link href={viewHref("day")} className={`px-3 py-2 transition-colors ${view === "day" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {s.day}
            </Link>
            <Link href={viewHref("week")} className={`px-3 py-2 transition-colors ${view === "week" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {s.week}
            </Link>
          </div>

          <select
            value={selectedProfessionalId}
            onChange={(e) => (window.location.href = profHref(e.target.value))}
            className="h-[36px] rounded-lg border border-border bg-card px-2 text-[12px] font-medium cursor-pointer"
          >
            <option value="all">{s.allProfessionals}</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              const startsAt = new Date(anchorDate);
              startsAt.setHours(Math.max(now.getHours() + 1, DAY_START_HOUR), 0, 0, 0);
              setNewSlot({ startsAt });
              setNewOpen(true);
            }}
            className="axis-btn-primary h-[36px] px-4 text-[13px] flex items-center gap-1.5 font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {s.newAppointment}
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0 rounded-xl border border-border bg-card overflow-auto animate-fade-up">
        {columns.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            {s.noProfessionals}
          </div>
        ) : (
          <div className="min-w-[720px]">
            {/* Header row */}
            <div className="grid sticky top-0 z-10 bg-card border-b border-border" style={{ gridTemplateColumns: `56px repeat(${columns.length}, 1fr)` }}>
              <div />
              {columns.map((c) => (
                <div key={c.key} className="border-l border-border">
                  {c.header}
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="grid" style={{ gridTemplateColumns: `56px repeat(${columns.length}, 1fr)` }}>
              {/* Hour gutter */}
              <div className="relative" style={{ height: `${SLOTS_PER_DAY * 3}rem` }}>
                {HOURS.map((h, i) => (
                  <span
                    key={h}
                    className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium"
                    style={{ top: `${(i / HOURS.length) * 100}%` }}
                  >
                    {i === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                  </span>
                ))}
              </div>

              {columns.map((col) => {
                const colProfessional = col.professionalId ? professionals.find((p) => p.id === col.professionalId) : null;
                const colAppointments = filteredAppointments.filter((a) => {
                  const sameDay = isSameDay(new Date(a.startsAt), col.day);
                  return col.professionalId ? sameDay && a.professional.id === col.professionalId : sameDay;
                });
                const isToday = isSameDay(col.day, now);
                const nowPct = (Math.min(Math.max(minutesIntoDay(now), 0), DAY_TOTAL_MINUTES) / DAY_TOTAL_MINUTES) * 100;

                return (
                  <div key={col.key} className="relative border-l border-border" style={{ height: `${SLOTS_PER_DAY * 3}rem` }}>
                    {/* Slot cells */}
                    {Array.from({ length: SLOTS_PER_DAY }, (_, i) => {
                      const slotDate = new Date(col.day);
                      slotDate.setHours(DAY_START_HOUR, i * SLOT_MINUTES, 0, 0);
                      const wh = (colProfessional?.workingHours ?? null) as WorkingHours | null;
                      const off = colProfessional ? !isWithinWorkingHours(wh, slotDate) : false;
                      return (
                        <div
                          key={i}
                          onClick={() => openNew(col.day, i, col.professionalId)}
                          className={`h-12 border-b cursor-pointer transition-colors ${
                            i % 2 === 1 ? "border-border" : "border-border/40"
                          } ${off ? "bg-muted/60" : "hover:bg-primary/5"}`}
                          title={off ? s.outsideHours : s.bookHere}
                        />
                      );
                    })}

                    {/* Now line */}
                    {isToday && minutesIntoDay(now) >= 0 && minutesIntoDay(now) <= DAY_TOTAL_MINUTES && (
                      <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${nowPct}%` }}>
                        <div className="h-[2px] bg-destructive/80" />
                        <div className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-destructive" />
                      </div>
                    )}

                    {/* Appointment blocks */}
                    {colAppointments.map((a) => {
                      const { topPct, heightPct } = blockPosition(new Date(a.startsAt), new Date(a.endsAt));
                      return (
                        <button
                          key={a.id}
                          onClick={(e) => openAppointment(a, e)}
                          className={`absolute left-1 right-1 z-10 rounded-md px-2 py-1 text-left overflow-hidden border shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-150 cursor-pointer ${STATUS_DIM[a.status] ?? ""}`}
                          style={{
                            top: `${topPct}%`,
                            height: `${heightPct}%`,
                            backgroundColor: `${a.professional.color}22`,
                            borderColor: `${a.professional.color}66`,
                            borderLeft: `3px solid ${a.professional.color}`,
                          }}
                        >
                          <p className="text-[11px] font-bold truncate leading-tight">{a.patient.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate leading-tight">{a.service.name}</p>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <NewAppointmentDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        patients={patients}
        professionals={professionals}
        services={services}
        initialStartsAt={newSlot?.startsAt}
        initialProfessionalId={newSlot?.professionalId}
      />
      <AppointmentPanel appointment={selected} open={panelOpen} onOpenChange={setPanelOpen} />
    </div>
  );
}
