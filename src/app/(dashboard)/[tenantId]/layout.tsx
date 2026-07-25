import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { AIAssistant } from "@/components/AIAssistant";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const { tenantId } = await params;

  // Ensure user belongs to this tenant
  if (session.user.tenantId !== tenantId) {
    redirect(`/${session.user.tenantId}/dashboard`);
  }

  // Primeiro acesso com senha temporária: forçar troca antes de usar o sistema.
  // Tolerante a banco ainda não migrado (coluna ausente) para não derrubar o app inteiro.
  let mustChange = false;
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id as string },
      select: { mustChangePassword: true },
    });
    mustChange = !!dbUser?.mustChangePassword;
  } catch (err) {
    console.error("[layout] Falha ao verificar mustChangePassword (migração pendente?):", err);
  }
  if (mustChange) {
    redirect("/change-password");
  }

  // Módulos ativos deste cliente. Tolerante a base ainda não migrada: sem a
  // coluna, assume-se o vertical de origem em vez de derrubar a aplicação.
  let modules: string[] = ["store"];
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { modules: true },
    });
    if (tenant?.modules?.length) modules = tenant.modules;
  } catch (err) {
    console.error("[layout] Falha ao ler Tenant.modules (migração pendente?):", err);
  }

  return (
    <>
      <DashboardShell tenantId={tenantId} modules={modules}>{children}</DashboardShell>
      <AIAssistant tenantId={tenantId} />
    </>
  );
}
