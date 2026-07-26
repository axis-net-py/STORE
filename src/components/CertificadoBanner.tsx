import Link from "next/link";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import prisma from "@/lib/prisma";
import { estadoDoCertificado } from "@/lib/certificado-alerta";

/**
 * Aviso de certificado fiscal dentro da aplicação.
 *
 * O registo no AuditLog é auditável mas ninguém o lê no dia a dia. Este é o
 * canal que o cliente vê: aparece no topo do painel quando o certificado está
 * a expirar, expirado ou em falta — e desaparece quando está tudo bem.
 */
export async function CertificadoBanner({ tenantId }: { tenantId: string }) {
  let cred: { validUntil: Date | null } | null = null;
  try {
    cred = await prisma.fiscalCredential.findFirst({
      where: { tenantId, isActive: true },
      select: { validUntil: true },
    });
  } catch {
    // Base ainda não migrada: não vale a pena alarmar por causa disso.
    return null;
  }

  const estado = estadoDoCertificado(cred?.validUntil ?? null, !!cred);
  if (estado.severidade === "ok") return null;

  const grave = estado.severidade === "expirado" || estado.severidade === "sem-certificado";

  const texto =
    estado.severidade === "sem-certificado"
      ? "Nenhum certificado digital ativo — não é possível emitir documentos eletrônicos."
      : estado.severidade === "expirado"
      ? `Certificado digital expirado há ${Math.abs(estado.dias!)} dia(s). A emissão de documentos eletrônicos está bloqueada.`
      : `Certificado digital expira em ${estado.dias} dia(s).`;

  return (
    <div
      role="status"
      className={`flex items-start gap-3 px-4 py-2.5 text-sm border-b ${
        grave
          ? "bg-destructive/10 border-destructive/30 text-destructive"
          : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-500"
      }`}
    >
      {grave ? (
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      )}
      <p className="flex-1">
        {texto}{" "}
        <Link href={`/${tenantId}/settings/fiscal`} className="font-semibold underline underline-offset-2">
          Gerenciar certificado
        </Link>
      </p>
    </div>
  );
}
