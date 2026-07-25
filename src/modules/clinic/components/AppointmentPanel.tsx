"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, CalendarClock, CheckCircle2, XCircle, UserX, Check, FileText } from "lucide-react";
import { rescheduleAppointment, setAppointmentStatus, completeAppointment, invoiceAppointment } from "@/modules/clinic/actions/appointment";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { AppointmentStatus } from "@prisma/client";
import { useLanguage } from "@/components/language-provider";
import { APPOINTMENT_STATUS_LABEL } from "@/lib/ui-strings";

export interface AgendaAppointment {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  clinicalNotes: string | null;
  chargedAmount: unknown;
  invoiceId: string | null;
  patient: { id: string; name: string; phone: string | null };
  professional: { id: string; name: string; color: string };
  service: { id: string; name: string; durationMin: number; price: unknown };
}

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  AGENDADA: "bg-secondary text-secondary-foreground",
  CONFIRMADA: "bg-primary/15 text-primary",
  CONCLUIDA: "bg-emerald-bright/15 text-emerald-bright",
  CANCELADA: "bg-destructive/10 text-destructive",
  FALTOU: "bg-amber-500/15 text-amber-700",
};

const STRINGS = {
  pt: {
    evolution: "Evolução",
    confirm: "Confirmar",
    reschedule: "Remarcar",
    conclude: "Concluir",
    missed: "Faltou",
    cancel: "Cancelar",
    confirmCancel: "Cancelar esta consulta?",
    generateInvoice: "Gerar Fatura",
    invoiced: "Consulta faturada",
    sendWhatsapp: "Enviar confirmação no WhatsApp",
    newDateTime: "Nova Data e Hora",
    back: "Voltar",
    evolutionNotes: "Evolução / Notas do Atendimento",
    notesPlaceholder: "Como foi o atendimento, conduta, orientações...",
    chargedAmount: "Valor Cobrado (Gs.)",
    concludeAttendance: "Concluir Atendimento",
    confirmedOk: "Consulta confirmada.",
    missedOk: "Falta registrada.",
    cancelledOk: "Consulta cancelada.",
    invoicedOk: "Fatura gerada.",
    rescheduledOk: "Consulta remarcada.",
    completedOk: "Atendimento concluído.",
    opErr: "Erro na operação.",
    waMessage: (name: string, service: string, prof: string, when: string) =>
      `Olá ${name}! Confirmamos sua consulta de ${service} com ${prof} em ${when}. Até lá!`,
  },
  es: {
    evolution: "Evolución",
    confirm: "Confirmar",
    reschedule: "Reagendar",
    conclude: "Concluir",
    missed: "Ausente",
    cancel: "Cancelar",
    confirmCancel: "¿Cancelar esta consulta?",
    generateInvoice: "Generar Factura",
    invoiced: "Consulta facturada",
    sendWhatsapp: "Enviar confirmación por WhatsApp",
    newDateTime: "Nueva Fecha y Hora",
    back: "Volver",
    evolutionNotes: "Evolución / Notas de la Atención",
    notesPlaceholder: "Cómo fue la atención, conducta, indicaciones...",
    chargedAmount: "Valor Cobrado (Gs.)",
    concludeAttendance: "Concluir Atención",
    confirmedOk: "Consulta confirmada.",
    missedOk: "Ausencia registrada.",
    cancelledOk: "Consulta cancelada.",
    invoicedOk: "Factura generada.",
    rescheduledOk: "Consulta reagendada.",
    completedOk: "Atención concluida.",
    opErr: "Error en la operación.",
    waMessage: (name: string, service: string, prof: string, when: string) =>
      `¡Hola ${name}! Confirmamos su consulta de ${service} con ${prof} el ${when}. ¡Hasta luego!`,
  },
} as const;

function fmtDateTime(d: Date, locale: string): string {
  return new Date(d).toLocaleString(locale, { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtTime(d: Date, locale: string): string {
  return new Date(d).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}
function toLocalInputValue(d: Date): string {
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

export function AppointmentPanel({
  appointment,
  open,
  onOpenChange,
}: {
  appointment: AgendaAppointment | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { language } = useLanguage();
  const locale = language === "es" ? "es-PY" : "pt-BR";
  const s = STRINGS[language];
  const STATUS_LABEL = APPOINTMENT_STATUS_LABEL[language];
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"view" | "reschedule" | "complete">("view");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");

  if (!appointment) return null;
  const a = appointment;
  const isFinal = a.status === "CONCLUIDA" || a.status === "CANCELADA";

  const waMessage = encodeURIComponent(
    s.waMessage(a.patient.name, a.service.name, a.professional.name, fmtDateTime(a.startsAt, locale))
  );
  const waHref = a.patient.phone ? `https://wa.me/${a.patient.phone.replace(/\D/g, "")}?text=${waMessage}` : null;

  async function run(fn: () => Promise<void>, successMsg: string) {
    setLoading(true);
    try {
      await fn();
      toast.success(successMsg);
      setMode("view");
      onOpenChange(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || s.opErr);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setMode("view");
      }}
    >
      <DialogContent className="sm:max-w-[440px] w-[95vw] glass-pop-up p-0 overflow-hidden">
        <DialogHeader className="text-left space-y-1 p-6 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-[18px] font-bold tracking-tight text-foreground">{a.patient.name}</DialogTitle>
            <Badge className={STATUS_STYLE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
          </div>
          <DialogDescription className="text-[12px] text-muted-foreground font-medium">
            {a.service.name} · {fmtDateTime(a.startsAt, locale)} – {fmtTime(a.endsAt, locale)}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="inline-block h-3 w-3 rounded-full border border-border" style={{ backgroundColor: a.professional.color }} />
            <span className="font-medium">{a.professional.name}</span>
            <span className="text-muted-foreground ml-auto">Gs. {Number(a.chargedAmount ?? a.service.price).toLocaleString("es-PY")}</span>
          </div>

          {a.clinicalNotes && (
            <div className="rounded-[8px] border border-border bg-muted/40 p-3">
              <p className="text-[11px] uppercase tracking-widest font-bold text-primary mb-1">{s.evolution}</p>
              <p className="text-[13px] whitespace-pre-wrap">{a.clinicalNotes}</p>
            </div>
          )}

          {mode === "view" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {a.status === "AGENDADA" && (
                  <button
                    onClick={() => run(() => setAppointmentStatus(a.id, "CONFIRMADA"), s.confirmedOk)}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 h-[40px] rounded-[8px] border border-primary/40 text-primary text-[13px] font-bold hover:bg-primary/5 transition-all disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" /> {s.confirm}
                  </button>
                )}
                {!isFinal && (
                  <>
                    <button
                      onClick={() => {
                        setNewStartsAt(toLocalInputValue(a.startsAt));
                        setMode("reschedule");
                      }}
                      className="flex items-center justify-center gap-2 h-[40px] rounded-[8px] border border-border text-[13px] font-bold hover:bg-muted transition-all"
                    >
                      <CalendarClock className="w-4 h-4" /> {s.reschedule}
                    </button>
                    <button
                      onClick={() => {
                        setNotes(a.clinicalNotes ?? "");
                        setAmount(String(Number(a.chargedAmount ?? a.service.price)));
                        setMode("complete");
                      }}
                      className="flex items-center justify-center gap-2 h-[40px] rounded-[8px] bg-primary text-primary-foreground text-[13px] font-bold hover:bg-primary/90 transition-all shadow-md"
                    >
                      <CheckCircle2 className="w-4 h-4" /> {s.conclude}
                    </button>
                    <button
                      onClick={() => run(() => setAppointmentStatus(a.id, "FALTOU"), s.missedOk)}
                      disabled={loading}
                      className="flex items-center justify-center gap-2 h-[40px] rounded-[8px] border border-border text-[13px] font-bold text-amber-700 hover:bg-amber-500/10 transition-all disabled:opacity-50"
                    >
                      <UserX className="w-4 h-4" /> {s.missed}
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(s.confirmCancel)) {
                          run(() => setAppointmentStatus(a.id, "CANCELADA"), s.cancelledOk);
                        }
                      }}
                      disabled={loading}
                      className="flex items-center justify-center gap-2 h-[40px] rounded-[8px] border border-destructive/40 text-destructive text-[13px] font-bold hover:bg-destructive/5 transition-all disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" /> {s.cancel}
                    </button>
                  </>
                )}
              </div>

              {a.status === "CONCLUIDA" && !a.invoiceId && (
                <button
                  onClick={() => run(() => invoiceAppointment(a.id).then(() => {}), s.invoicedOk)}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 h-[40px] rounded-[8px] bg-primary text-primary-foreground text-[13px] font-bold hover:bg-primary/90 transition-all shadow-md disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" /> {s.generateInvoice}
                </button>
              )}
              {a.invoiceId && (
                <div className="flex items-center justify-center gap-2 h-[36px] rounded-[8px] bg-emerald-bright/10 text-emerald-bright text-[12px] font-bold">
                  <FileText className="w-3.5 h-3.5" /> {s.invoiced}
                </div>
              )}

              {waHref && !isFinal && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 h-[40px] rounded-[8px] bg-[#25D366]/10 border border-[#25D366]/40 text-[#128C4A] text-[13px] font-bold hover:bg-[#25D366]/20 transition-all"
                >
                  <MessageCircle className="w-4 h-4" /> {s.sendWhatsapp}
                </a>
              )}
            </>
          )}

          {mode === "reschedule" && (
            <div className="space-y-3">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.newDateTime}</Label>
              <Input
                type="datetime-local"
                value={newStartsAt}
                onChange={(e) => setNewStartsAt(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px]"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setMode("view")} className="px-4 h-[38px] rounded-[8px] text-[13px] font-semibold text-muted-foreground hover:bg-muted">
                  {s.back}
                </button>
                <button
                  onClick={() => run(() => rescheduleAppointment(a.id, newStartsAt), s.rescheduledOk)}
                  disabled={loading || !newStartsAt}
                  className="bg-primary text-primary-foreground px-5 h-[38px] rounded-[8px] text-[13px] font-bold disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />} {s.reschedule}
                </button>
              </div>
            </div>
          )}

          {mode === "complete" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.evolutionNotes}</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  placeholder={s.notesPlaceholder}
                  className="w-full bg-background border border-border text-[13px] rounded-[8px] px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.chargedAmount}</Label>
                <Input
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-background border-border text-[13px] h-[40px] rounded-[8px]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setMode("view")} className="px-4 h-[38px] rounded-[8px] text-[13px] font-semibold text-muted-foreground hover:bg-muted">
                  {s.back}
                </button>
                <button
                  onClick={() => run(() => completeAppointment(a.id, { clinicalNotes: notes, chargedAmount: amount }), s.completedOk)}
                  disabled={loading}
                  className="bg-primary text-primary-foreground px-5 h-[38px] rounded-[8px] text-[13px] font-bold disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />} {s.concludeAttendance}
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
