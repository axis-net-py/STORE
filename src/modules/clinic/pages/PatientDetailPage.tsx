import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getPatientWithHistory } from "@/modules/clinic/actions/patient";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Mail, MapPin, HeartPulse, CalendarDays, FileText } from "lucide-react";
import { getLocale } from "@/lib/get-locale";
import { COMMON, APPOINTMENT_STATUS_LABEL } from "@/lib/ui-strings";

const STRINGS = {
  pt: {
    back: "Pacientes",
    yearsOld: (n: number) => `${n} anos`,
    born: "nasc.",
    healthNotes: "Observações de Saúde",
    upcoming: "Próximas consultas",
    history: "Histórico de atendimentos",
    noHistory: "Nenhum atendimento registrado ainda.",
    invoiced: "Faturada",
  },
  es: {
    back: "Pacientes",
    yearsOld: (n: number) => `${n} años`,
    born: "nac.",
    healthNotes: "Observaciones de Salud",
    upcoming: "Próximas consultas",
    history: "Historial de atenciones",
    noHistory: "Ningún atendimiento registrado todavía.",
    invoiced: "Facturada",
  },
} as const;

function age(birthDate: Date): number {
  const now = new Date();
  let a = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) a--;
  return a;
}

function fmtDateTime(d: Date, locale: string): string {
  return d.toLocaleString(locale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ tenantId: string; id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;

  const { id } = await params;
  const patient = await getPatientWithHistory(id);
  if (!patient) notFound();

  const lang = await getLocale();
  const locale = lang === "es" ? "es-PY" : "pt-BR";
  const s = STRINGS[lang];
  const c = COMMON[lang];
  const STATUS_LABEL = APPOINTMENT_STATUS_LABEL[lang];

  const now = new Date();
  const upcoming = patient.appointments
    .filter((a) => a.startsAt > now && (a.status === "AGENDADA" || a.status === "CONFIRMADA"))
    .reverse(); // asc para próximas
  const history = patient.appointments.filter((a) => !(a.startsAt > now && (a.status === "AGENDADA" || a.status === "CONFIRMADA")));

  return (
    <div className="space-y-4 md:space-y-6 max-w-4xl">
      <Link
        href={`/${tenantId}/customers`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {s.back}
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl text-foreground">{patient.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {patient.birthDate && (
                <span>{s.yearsOld(age(patient.birthDate))} · {s.born} {patient.birthDate.toLocaleDateString(locale)}</span>
              )}
              {patient.document && <span>{patient.documentType ?? "DOC"}: {patient.document}</span>}
              {patient.phone && (
                <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{patient.phone}</span>
              )}
              {patient.email && (
                <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{patient.email}</span>
              )}
              {patient.city && (
                <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{patient.city}</span>
              )}
            </div>
          </div>
          <Badge variant={patient.isActive ? "default" : "secondary"}>
            {patient.isActive ? c.active : c.inactive}
          </Badge>
        </div>

        {patient.healthNotes && (
          <div className="mt-4 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/60 p-3 flex gap-2">
            <HeartPulse className="w-4 h-4 text-amber-700 dark:text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-amber-700 dark:text-amber-500">{s.healthNotes}</p>
              <p className="text-sm mt-0.5 whitespace-pre-wrap">{patient.healthNotes}</p>
            </div>
          </div>
        )}
      </div>

      {/* Próximas */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg">{s.upcoming}</h2>
          {upcoming.map((a) => (
            <div key={a.id} className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
              <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: a.professional.color }} />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{a.service.name} · {a.professional.name}</p>
                <p className="text-xs text-muted-foreground">{fmtDateTime(a.startsAt, locale)}</p>
              </div>
              <Badge className="ml-auto bg-primary/15 text-primary">{STATUS_LABEL[a.status]}</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-3">
        <h2 className="text-lg">{s.history}</h2>
        {history.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{s.noHistory}</p>
          </div>
        ) : (
          <ol className="relative border-l-2 border-border ml-2 space-y-5">
            {history.map((a) => (
              <li key={a.id} className="ml-5 relative animate-fade-up">
                <span
                  className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-card"
                  style={{ backgroundColor: a.professional.color }}
                />
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{a.service.name}</p>
                    <span className="text-xs text-muted-foreground">· {a.professional.name}</span>
                    <Badge
                      variant={a.status === "CONCLUIDA" ? "default" : "secondary"}
                      className={a.status === "CANCELADA" || a.status === "FALTOU" ? "text-destructive" : ""}
                    >
                      {STATUS_LABEL[a.status]}
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(a.startsAt, locale)}</span>
                  </div>
                  {a.clinicalNotes && (
                    <p className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap border-t border-border pt-2">{a.clinicalNotes}</p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    {a.chargedAmount !== null && a.status === "CONCLUIDA" && (
                      <span>Gs. {Number(a.chargedAmount).toLocaleString("es-PY")}</span>
                    )}
                    {a.invoiceId && (
                      <Link href={`/${tenantId}/invoices`} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <FileText className="w-3 h-3" /> {s.invoiced}
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
