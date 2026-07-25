import { getServices } from "@/modules/clinic/actions/service";
import { ServiceSheet } from "@/modules/clinic/components/ServiceSheet";
import { ServiceList } from "@/modules/clinic/components/ServiceList";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/get-locale";
import { PageHeader } from "@/components/ui/page-header";

const HEADER = {
  pt: { title: "Serviços", subtitle: "Serviços agendáveis: consultas, sessões e procedimentos" },
  es: { title: "Servicios", subtitle: "Servicios agendables: consultas, sesiones y procedimientos" },
} as const;

export default async function ServicesPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;

  const services = await getServices();
  const t = HEADER[await getLocale()];

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title={t.title} subtitle={t.subtitle} actions={<ServiceSheet tenantId={tenantId} />} />

      <ServiceList services={services} tenantId={tenantId} />
    </div>
  );
}
