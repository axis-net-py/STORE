import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log('Querying invoices...');
  try {
    const invoices = await prisma.commercialInvoice.findMany({
      include: {
        customer: { select: { id: true, name: true } },
        items: true
      }
    });
    console.log('Invoices query succeeded, length:', invoices.length);
  } catch (error) {
    console.error('Invoices query failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}
main();
