import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/get-locale";
import { PageHeader } from "@/components/ui/page-header";
import { getSalao } from "@/modules/food/actions/mesa";
import { getComandasAbertas } from "@/modules/food/actions/comanda";
import { SalaoGrelha } from "@/modules/food/components/SalaoGrelha";
import { MesaSheet } from "@/modules/food/components/MesaSheet";

const HEADER = {
  pt: { title: "Salão", subtitle: "Mesas, contas abertas e o que cada uma já consumiu" },
  es: { title: "Salón", subtitle: "Mesas, cuentas abiertas y lo que cada una lleva consumido" },
} as const;

export default async function SalaoPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;

  const [mesas, abertas] = await Promise.all([getSalao(), getComandasAbertas()]);
  const t = HEADER[await getLocale()];

  // Balcão e delivery não estão em cima de nenhuma mesa, e sem isto ficavam
  // invisíveis para quem só olha para o salão — que é onde se está a trabalhar.
  const semMesa = abertas.filter((c) => c.tipo !== "MESA");

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title={t.title} subtitle={t.subtitle} actions={<MesaSheet tenantId={tenantId} />} />

      <SalaoGrelha tenantId={tenantId} mesas={mesas} semMesa={semMesa} />
    </div>
  );
}
