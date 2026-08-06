import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { estadoDoCertificado, deveAvisar, mensagem } from "@/lib/certificado-alerta";

/**
 * Verificação diária dos certificados fiscais (spec Projeto 2, §6.5).
 *
 * Percorre os clientes ativos, classifica o certificado de cada um e regista
 * um aviso quando há motivo. Sem provedor de email configurado, o aviso vive
 * onde é auditável e onde o cliente o vê: no AuditLog e na própria aplicação.
 *
 * Agendada em vercel.json.
 */

export const dynamic = "force-dynamic";

/**
 * Esta rota percorre TODOS os clientes: aberta, entregaria a qualquer pessoa
 * a lista de quem tem certificado a expirar. O Vercel Cron envia o segredo
 * no cabeçalho Authorization.
 */
function autorizado(req: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  // Sem segredo definido, a rota fica fechada — em vez de aberta.
  if (!segredo) return false;

  const recebido = req.headers.get("authorization") ?? "";
  const esperado = `Bearer ${segredo}`;

  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const tenants = await prisma.tenant.findMany({
    // Só quem emite eletronicamente. Para os restantes, "não tem certificado"
    // não é um aviso — é o estado escolhido, e registá-lo todos os dias enchia
    // o registo de auditoria com ruído que ninguém pode resolver.
    where: { electronicInvoicing: true },
    select: {
      id: true,
      name: true,
      fiscalCredentials: {
        where: { isActive: true },
        select: { id: true, validUntil: true },
        take: 1,
      },
    },
  });

  const avisos: Array<{ tenant: string; severidade: string; dias: number | null; texto: string }> = [];

  for (const t of tenants) {
    const cred = t.fiscalCredentials[0];
    const estado = estadoDoCertificado(cred?.validUntil ?? null, !!cred);
    if (!deveAvisar(estado)) continue;

    const texto = mensagem(estado, t.name);
    avisos.push({ tenant: t.name, severidade: estado.severidade, dias: estado.dias, texto });

    try {
      await prisma.auditLog.create({
        data: {
          tenantId: t.id,
          action: "CERTIFICADO_AVISO",
          entity: "FiscalCredential",
          entityId: cred?.id ?? null,
          details: {
            severidade: estado.severidade,
            dias: estado.dias,
            marco: estado.marco,
            mensagem: texto,
          },
        },
      });
    } catch (e) {
      // Um cliente com problema não pode impedir a verificação dos restantes.
      console.error(`[cron/certificados] Falha ao registar aviso de ${t.name}:`, e);
    }
  }

  return NextResponse.json({
    verificados: tenants.length,
    avisos: avisos.length,
    detalhe: avisos,
  });
}
