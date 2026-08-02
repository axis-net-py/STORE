import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { AIAssistant } from "@/components/AIAssistant";
import { verificarCoerencia } from "@/lib/tenant-context";
import { acentoDoCliente } from "@/lib/tema";
import { AcentoNoDocumento } from "@/components/AcentoNoDocumento";
import { CertificadoBanner } from "@/components/CertificadoBanner";

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

  // Defesa em profundidade (spec Projeto 2, §4.2): quando o acesso vem por
  // subdomínio, a sessão tem de pertencer àquele cliente. A cookie host-only
  // já o garante; isto é a segunda linha, para o caso de falhar.
  const coerencia = await verificarCoerencia(session.user.tenantId as string);
  if (!coerencia.ok) {
    console.warn(`[layout] Acesso recusado por subdomínio: ${coerencia.motivo}`);
    redirect("/login");
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

  // Módulos ativos e cor do design system. Tolerante a base ainda não migrada:
  // sem as colunas, assume-se o vertical de origem em vez de derrubar a
  // aplicação.
  let modules: string[] = ["store"];
  let themeColor: string | null = null;
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { modules: true, themeColor: true },
    });
    if (tenant?.modules?.length) modules = tenant.modules;
    themeColor = tenant?.themeColor ?? null;
  } catch (err) {
    console.error("[layout] Falha ao ler Tenant.modules/themeColor (migração pendente?):", err);
  }

  // Resolvida no servidor, e não no cliente, de propósito: a cor vai no HTML
  // da primeira resposta. Decidida no navegador, o utilizador via a paleta
  // trocar depois da página pintada, a cada carregamento.
  const acento = acentoDoCliente(themeColor, modules);

  return (
    /**
     * `display: contents` — o contentor existe para as variáveis CSS serem
     * herdadas por tudo o que está dentro, e não para a disposição do ecrã.
     * Envolve também o assistente, que é irmão do painel: sem isto ficava de
     * fora do acento e aparecia com a cor neutra por cima de uma interface
     * verde ou offwhite.
     */
    <div data-accent={acento} className="contents">
      <AcentoNoDocumento acento={acento} />
      <DashboardShell tenantId={tenantId} modules={modules}>
        <CertificadoBanner tenantId={tenantId} />
        {children}
      </DashboardShell>
      <AIAssistant tenantId={tenantId} />
    </div>
  );
}
