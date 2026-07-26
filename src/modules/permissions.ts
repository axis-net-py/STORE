// Extensão explícita: import de valor, resolvido pelo runner nativo do Node.
import { resolveModules } from "./registry.ts";

/**
 * Semeadura das permissões dos módulos.
 *
 * `requirePermission` (lib/authz.ts) nega OPERATOR e AUDITOR quando o tenant
 * já tem matriz de permissões configurada mas a ação pedida não consta dela.
 * Ativar um módulo sem semear as suas permissões torna-o inacessível a esses
 * papéis — daí isto correr sempre que os módulos de um cliente mudam.
 *
 * SOVEREIGN e ADMIN não dependem destas linhas (têm acesso total por regra),
 * mas semeiam-se na mesma para a matriz ficar completa e auditável.
 */

/** Todas as ações introduzidas pelos módulos ativos. */
export function permissionsFor(active: string[]): string[] {
  return resolveModules(active).flatMap((m) => m.permissions);
}

/**
 * Garante as linhas de Permission para os módulos de um cliente.
 * Idempotente: pode correr as vezes que forem precisas.
 *
 * @param db  cliente Prisma ou transação
 */
export async function seedModulePermissions(
  db: any,
  tenantId: string,
  active: string[]
): Promise<number> {
  const acoes = permissionsFor(active);
  if (acoes.length === 0) return 0;

  const linhas: Array<{ action: string; role: "SOVEREIGN" | "ADMIN" | "OPERATOR"; tenantId: string }> = [];
  for (const action of acoes) {
    linhas.push({ action, role: "SOVEREIGN", tenantId });
    linhas.push({ action, role: "ADMIN", tenantId });
    // OPERATOR opera, mas não apaga — mesma política do seed do núcleo.
    if (!action.endsWith(":delete")) {
      linhas.push({ action, role: "OPERATOR", tenantId });
    }
  }

  const r = await db.permission.createMany({ data: linhas, skipDuplicates: true });
  return r.count ?? 0;
}
