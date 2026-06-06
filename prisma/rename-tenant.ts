import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando migração de tenant 'tenant-demo' para 'axis'...");

  // Verificar se o tenant 'axis' já existe
  let targetTenant = await prisma.tenant.findUnique({
    where: { id: "axis" },
  });

  if (!targetTenant) {
    // 1. Criar novo tenant 'axis'
    targetTenant = await prisma.tenant.create({
      data: {
        id: "axis",
        name: "AXIS",
        businessName: "AXIS Comércio Geral S.A.",
        ruc: "80012345-1",
        tradeName: "AXIS",
        establishment: "001",
        emissionPoint: "001",
        address: "Asunción, Paraguay",
        economicActivity: "Comercio General",
      },
    });
    console.log("Novo tenant 'axis' criado.");
  } else {
    // Garantir que o nome é AXIS
    await prisma.tenant.update({
      where: { id: "axis" },
      data: { name: "AXIS" },
    });
    console.log("Tenant 'axis' já existe. Nome atualizado para 'AXIS'.");
  }

  // 2. Atualizar chaves estrangeiras em todas as tabelas relacionadas
  const tables = [
    "user",
    "customer",
    "supplier",
    "product",
    "commercialInvoice",
    "exchangeRate",
    "account",
    "transaction",
    "permission",
    "journalEntry",
    "auditLog",
    "inventoryMovement",
  ];

  for (const table of tables) {
    try {
      const count = await (prisma as any)[table].updateMany({
        where: { tenantId: "tenant-demo" },
        data: { tenantId: "axis" },
      });
      console.log(`Tabela '${table}': ${count.count} registros migrados.`);
    } catch (e: any) {
      console.error(`Erro ao migrar tabela '${table}':`, e.message);
    }
  }

  // 3. Excluir o tenant demo antigo
  try {
    await prisma.tenant.delete({
      where: { id: "tenant-demo" },
    });
    console.log("Tenant antigo 'tenant-demo' excluído com sucesso.");
  } catch (e: any) {
    console.log("Tenant antigo 'tenant-demo' já havia sido removido.");
  }

  console.log("Migração concluída com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro na migração:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
