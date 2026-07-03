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

  // Primeiro acesso com senha temporária: forçar troca antes de usar o sistema
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id as string },
    select: { mustChangePassword: true },
  });
  if (dbUser?.mustChangePassword) {
    redirect("/change-password");
  }

  return (
    <>
      <DashboardShell tenantId={tenantId}>{children}</DashboardShell>
      <AIAssistant tenantId={tenantId} />
    </>
  );
}
