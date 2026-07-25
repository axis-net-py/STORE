import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { isRotaBloqueada } from "./registry";

/**
 * Fecha o URL de um módulo que o cliente não contratou.
 *
 * Esconder a entrada do menu não é suficiente: sem isto, bastava escrever
 * `/{tenantId}/pos` na barra de endereços. Chamado pelo layout de cada
 * conjunto de rotas de módulo.
 */
export async function assertModuloAtivo(tenantId: string, segmento: string) {
  let modules: string[] = ["store"];
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { modules: true },
    });
    if (tenant?.modules?.length) modules = tenant.modules;
  } catch {
    // Base ainda não migrada: não bloquear com base em informação ausente.
    return;
  }

  if (isRotaBloqueada(segmento, modules)) notFound();
}
