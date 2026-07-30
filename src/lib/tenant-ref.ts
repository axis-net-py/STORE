/**
 * Verificação de referências entre registos do mesmo cliente.
 *
 * Um identificador que vem do formulário é input do utilizador como qualquer
 * outro: nada impede que seja o de outra empresa. Gravar uma chave estrangeira
 * sem a verificar cria uma referência cruzada entre clientes — integridade
 * quebrada, e potencialmente dados alheios visíveis quando a relação é
 * resolvida no ecrã.
 *
 * Auditoria de 2026-07-30: 12 chaves estrangeiras eram gravadas sem esta
 * verificação, incluindo o cliente de uma fatura de venda.
 */

/** Nomes amigáveis para as mensagens de erro. */
const ROTULOS: Record<string, string> = {
  customer: "Cliente",
  supplier: "Fornecedor",
  product: "Produto",
  harvest: "Safra",
  plot: "Talhão",
  silo: "Silo",
  contract: "Contrato",
  vehicle: "Veículo",
  employee: "Funcionário",
  livestockBatch: "Lote",
  professional: "Profissional",
  service: "Serviço",
  warehouse: "Depósito",
};

/**
 * Confirma que o registo existe E pertence a este cliente.
 *
 * @param db      cliente Prisma ou transação
 * @param modelo  nome do model em camelCase, como no cliente Prisma
 * @param id      identificador vindo do input; null/undefined passa sem erro
 */
export async function assertRefDoTenant(
  db: any,
  tenantId: string,
  modelo: keyof typeof ROTULOS | string,
  id?: string | null
): Promise<void> {
  if (!id) return;

  const existe = await db[modelo].findFirst({
    where: { id, tenantId },
    select: { id: true },
  });

  if (!existe) {
    const rotulo = ROTULOS[modelo] ?? modelo;
    // Mensagem deliberadamente igual à de "não existe": não distinguir os dois
    // casos evita confirmar a existência de registos de outra empresa.
    throw new Error(`${rotulo} não encontrado.`);
  }
}

/** Versão para vários identificadores do mesmo model. */
export async function assertRefsDoTenant(
  db: any,
  tenantId: string,
  modelo: string,
  ids: Array<string | null | undefined>
): Promise<void> {
  for (const id of ids) await assertRefDoTenant(db, tenantId, modelo, id);
}
