import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAgendaData } from "@/modules/clinic/actions/appointment";
import { AgendaCalendar } from "@/modules/clinic/components/AgendaCalendar";
import { startOfWeek, addDays } from "@/modules/clinic/lib/agenda";
import { getLocale } from "@/lib/get-locale";

const HEADER = {
  pt: { title: "Agenda", subtitle: "Atendimentos por profissional — clique num horário livre para agendar" },
  es: { title: "Agenda", subtitle: "Atenciones por profesional — haga clic en un horario libre para agendar" },
} as const;

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; d?: string; p?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;

  const params = await searchParams;
  const view = params.view === "day" ? "day" : "week";
  const anchorDate = params.d ? new Date(`${params.d}T00:00:00`) : new Date();
  const anchor = isoDate(isNaN(anchorDate.getTime()) ? new Date() : anchorDate);
  const selectedProfessionalId = params.p ?? "all";

  const weekStartDate = startOfWeek(new Date(`${anchor}T00:00:00`));
  const from = view === "week" ? weekStartDate : new Date(`${anchor}T00:00:00`);
  const to = addDays(from, view === "week" ? 7 : 1);

  const { appointments, professionals, services, patients } = await getAgendaData(
    from.toISOString(),
    to.toISOString()
  );

  const locale = await getLocale();
  const t = HEADER[locale];

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
        <p className="text-muted-foreground text-sm">{t.subtitle}</p>
      </div>

      <AgendaCalendar
        tenantId={tenantId}
        view={view}
        anchor={anchor}
        weekStart={isoDate(weekStartDate)}
        appointments={appointments as any}
        professionals={professionals as any}
        services={services as any}
        patients={patients}
        selectedProfessionalId={selectedProfessionalId}
      />
    </div>
  );
}
