import { getProfessionals } from "@/modules/clinic/actions/professional";
import { ProfessionalSheet } from "@/modules/clinic/components/ProfessionalSheet";
import { ProfessionalList } from "@/modules/clinic/components/ProfessionalList";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/get-locale";
import { PageHeader } from "@/components/ui/page-header";

const HEADER = {
  pt: { title: "Profissionais", subtitle: "Equipe que atende na agenda da clínica" },
  es: { title: "Profesionales", subtitle: "Equipo que atiende en la agenda de la clínica" },
} as const;

export default async function ProfessionalsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;

  const professionals = await getProfessionals();
  const t = HEADER[await getLocale()];

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title={t.title} subtitle={t.subtitle} actions={<ProfessionalSheet tenantId={tenantId} />} />

      <ProfessionalList professionals={professionals} tenantId={tenantId} />
    </div>
  );
}
