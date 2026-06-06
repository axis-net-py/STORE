import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database...');
  try {
    const tenants = await prisma.tenant.findMany();
    console.log('Successfully connected!');
    console.log('Tenants found:', tenants.length);
    for (const t of tenants) {
      console.log(`- Tenant: ${t.name} (ID: ${t.id})`);
    }

    const users = await prisma.user.findMany({
      include: { tenant: true }
    });
    console.log('Users found:', users.length);
    for (const u of users) {
      console.log(`- User: ${u.email}, Role: ${u.role}, Tenant: ${u.tenant?.name}`);
    }
  } catch (error) {
    console.error('Database connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
