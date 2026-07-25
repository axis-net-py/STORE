import Link from "next/link";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getLocale } from "@/lib/get-locale";
import { CalendarDays, Clock, UserX, Banknote } from "lucide-react";

const STRINGS = {
  pt: {
    today: "Consultas Hoje",
    todayDone: (n: number) => `${n} concluída${n === 1 ? "" : "s"}`,
    todayFree: "Agenda livre",
    next: "Próxima Consulta",
    nextNone: "Nada agendado",
    noShow: "Taxa de Falta (30d)",
    noShowDetail: (m: number, a: number) => `${m} falta${m === 1 ? "" : "s"} · ${a} atendida${a === 1 ? "" : "s"}`,
    revenue: "Receita de Consultas (mês)",
    revenueDetail: "Atendimentos concluídos",
  },
  es: {
    today: "Consultas Hoy",
    todayDone: (n: number) => `${n} completada${n === 1 ? "" : "s"}`,
    todayFree: "Agenda libre",
    next: "Próxima Consulta",
    nextNone: "Nada agendado",
    noShow: "Tasa de Falta (30d)",
    noShowDetail: (m: number, a: number) => `${m} falta${m === 1 ? "" : "s"} · ${a} atendida${a === 1 ? "" : "s"}`,
    revenue: "Ingresos por Consultas (mes)",
    revenueDetail: "Atenciones completadas",
  },
} as const;

function fmtTime(d: Date, locale: string): string {
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export async function AgendaStats() {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) return null;

  const lang = await getLocale();
  const locale = lang === "es" ? "es-PY" : "pt-BR";
  const s = STRINGS[lang];

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [todayTotal, todayDone, next, missed, attended, monthRevenue] = await Promise.all([
    prisma.appointment.count({
      where: { tenantId, startsAt: { gte: dayStart, lt: dayEnd }, status: { notIn: ["CANCELADA"] } },
    }),
    prisma.appointment.count({
      where: { tenantId, startsAt: { gte: dayStart, lt: dayEnd }, status: "CONCLUIDA" },
    }),
    prisma.appointment.findFirst({
      where: { tenantId, startsAt: { gte: now }, status: { in: ["AGENDADA", "CONFIRMADA"] } },
      orderBy: { startsAt: "asc" },
      include: {
        patient: { select: { name: true } },
        professional: { select: { name: true, color: true } },
      },
    }),
    prisma.appointment.count({ where: { tenantId, startsAt: { gte: thirtyAgo }, status: "FALTOU" } }),
    prisma.appointment.count({ where: { tenantId, startsAt: { gte: thirtyAgo }, status: "CONCLUIDA" } }),
    prisma.appointment.aggregate({
      where: { tenantId, startsAt: { gte: monthStart }, status: "CONCLUIDA" },
      _sum: { chargedAmount: true },
    }),
  ]);

  const noShowRate = missed + attended > 0 ? Math.round((missed / (missed + attended)) * 100) : 0;
  const revenue = Number(monthRevenue._sum.chargedAmount ?? 0);

  const cards = [
    {
      icon: CalendarDays,
      label: s.today,
      value: String(todayTotal),
      detail: todayTotal > 0 ? s.todayDone(todayDone) : s.todayFree,
    },
    {
      icon: Clock,
      label: s.next,
      value: next ? fmtTime(next.startsAt, locale) : "—",
      detail: next
        ? `${next.patient.name} · ${next.professional.name}${next.startsAt >= dayEnd ? ` (${next.startsAt.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" })})` : ""}`
        : s.nextNone,
    },
    {
      icon: UserX,
      label: s.noShow,
      value: `${noShowRate}%`,
      detail: s.noShowDetail(missed, attended),
    },
    {
      icon: Banknote,
      label: s.revenue,
      value: `Gs. ${revenue.toLocaleString("es-PY")}`,
      detail: s.revenueDetail,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
      {cards.map((c, i) => (
        <Link
          key={c.label}
          href={`/${tenantId}/agenda`}
          className="rounded-xl border bg-card p-5 hover-lift animate-fade-up block"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <c.icon className="w-4 h-4 text-primary" />
            <span className="text-[11px] uppercase tracking-widest font-bold">{c.label}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-foreground" style={{ fontFamily: "var(--font-serif), Georgia, serif" }}>
            {c.value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground truncate">{c.detail}</p>
        </Link>
      ))}
    </div>
  );
}
