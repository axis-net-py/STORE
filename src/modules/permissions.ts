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

  type Papel = "SOVEREIGN" | "ADMIN" | "OPERATOR" | "AUDITOR";
  const linhas: Array<{ action: string; role: Papel; tenantId: string }> = [];

  for (const action of acoes) {
    linhas.push({ action, role: "SOVEREIGN", tenantId });
    // Apagar é exclusivo do SOVEREIGN, aqui como no núcleo. Ter o ADMIN a
    // apagar uma safra mas não um cliente seria arbitrário — a política de
    // eliminação tem de ser a mesma em todo o sistema.
    if (!action.endsWith(":delete")) {
      linhas.push({ action, role: "ADMIN", tenantId });
      linhas.push({ action, role: "OPERATOR", tenantId });
    }
    // AUDITOR confere, não lança. Sem esta linha ficava sem ver o módulo:
    // requirePermission exige uma linha para este papel.
    if (action.endsWith(":read")) {
      linhas.push({ action, role: "AUDITOR", tenantId });
    }
  }

  const r = await db.permission.createMany({ data: linhas, skipDuplicates: true });
  return r.count ?? 0;
}
