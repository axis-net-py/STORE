/**
 * Matriz de permissões do núcleo, por papel.
 *
 * Módulo sem dependências de propósito: é política de autorização, não um
 * detalhe do provisionamento, e tem de poder ser testada isoladamente.
 *
 * Os QUATRO papéis têm de aparecer aqui. requirePermission (lib/authz.ts)
 * liberta apenas o SOVEREIGN por regra; ADMIN, OPERATOR e AUDITOR exigem uma
 * linha na tabela — e o recurso legado só se aplica quando o cliente não tem
 * matriz nenhuma. Um cliente com permissões semeadas e sem linhas para estes
 * papéis fica com eles trancados fora de tudo.
 *
 * Auditoria de 2026-07-30: era exatamente o caso. Os dois papéis tinham zero
 * permissões, e o utilizador operator@axis.erp não conseguia executar nada.
 * Não basta não negar — é preciso conceder.
 */

export type PapelPermissao = "SOVEREIGN" | "ADMIN" | "OPERATOR" | "AUDITOR";

/** Ações do núcleo. As dos módulos vêm dos manifestos. */
export const ACOES_NUCLEO = [
  "dashboard:read",
  "customers:read", "customers:write", "customers:delete",
  "suppliers:read", "suppliers:write", "suppliers:delete",
  "products:read", "products:write", "products:delete",
  "invoices:read", "invoices:write", "invoices:delete",
  "inventory:read", "inventory:write",
  "accounting:read", "accounting:write",
  "reports:read",
  "settings:read", "settings:write",
  "users:manage",
];

export type LinhaPermissao = { action: string; role: PapelPermissao; tenantId: string };

/**
 * - SOVEREIGN: tudo.
 * - ADMIN: tudo menos apagar e gerir utilizadores.
 * - OPERATOR: opera o dia a dia — lê e escreve, nunca apaga, não mexe em
 *   configurações nem em utilizadores.
 * - AUDITOR: só leitura. É o papel de quem confere, não de quem lança.
 */
export function permissoesDoNucleo(tenantId: string): LinhaPermissao[] {
  const linhas: LinhaPermissao[] = [];

  for (const action of ACOES_NUCLEO) {
    const apaga = action.endsWith(":delete");
    const leitura = action.endsWith(":read");
    const administrativa = action === "users:manage" || action === "settings:write";

    linhas.push({ action, role: "SOVEREIGN", tenantId });

    if (!apaga && action !== "users:manage") {
      linhas.push({ action, role: "ADMIN", tenantId });
    }
    if (!apaga && !administrativa) {
      linhas.push({ action, role: "OPERATOR", tenantId });
    }
    if (leitura) {
      linhas.push({ action, role: "AUDITOR", tenantId });
    }
  }

  return linhas;
}
