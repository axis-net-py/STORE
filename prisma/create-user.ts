import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || "User";
  const role = process.argv[5] || "SOVEREIGN"; // Default role to SOVEREIGN for full permissions
  const tenantId = process.argv[6] || "axis";

  if (!email || !password) {
    console.error("Uso: npx tsx prisma/create-user.ts <email> <senha> [nome] [role] [tenantId]");
    process.exit(1);
  }

  console.log(`Criando/atualizando usuário ${email} no banco de dados...`);

  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant) {
    console.log(`Tenant '${tenantId}' não existe. Criando tenant...`);
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: tenantId.toUpperCase(),
        businessName: `${tenantId.toUpperCase()} S.A.`,
      }
    });
  }

  const hashedPassword = await hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      name,
      role: role as any,
      tenantId,
    },
    create: {
      email,
      name,
      password: hashedPassword,
      role: role as any,
      tenantId,
    },
  });

  console.log(`Sucesso! Usuário criado no banco de dados.`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Role: ${user.role}`);
  console.log(`  Tenant: ${user.tenantId}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
