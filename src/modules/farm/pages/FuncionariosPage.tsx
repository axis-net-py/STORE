import { getEmployees } from "@/modules/farm/actions/funcionario";
import { EmployeeSheet } from "@/modules/farm/components/EmployeeSheet";
import { EmployeeList } from "@/modules/farm/components/EmployeeList";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/get-locale";

const HEADER = {
  pt: {
    title: "Funcionários",
    subtitle: "Gerencie os funcionários da fazenda e seus cargos",
  },
  es: {
    title: "Personal",
    subtitle: "Gestione el personal de la granja y sus cargos",
  },
} as const;

export default async function FuncionariosPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;
  const locale = await getLocale();
  const t = HEADER[locale];

  const employees = await getEmployees();

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
          <p className="text-muted-foreground text-sm">{t.subtitle}</p>
        </div>
        <div className="self-start sm:self-auto">
          <EmployeeSheet tenantId={tenantId} />
        </div>
      </div>

      <EmployeeList employees={employees} tenantId={tenantId} />
    </div>
  );
}
