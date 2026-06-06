import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function test() {
  console.log('Testing Prisma product creation...')
  try {
    const product = await prisma.product.create({
      data: {
        tenantId: 'axis',
        sku: 'TEST-' + Date.now(),
        name: 'Produto Teste',
        price: new Prisma.Decimal(100),
        cost: new Prisma.Decimal(50),
        unit: 'un',
        currentStock: 0,
        minStock: 0,
        isActive: true,
        tags: 'test',
        isService: true,
      },
    })
    console.log('Successfully created product:', product)
  } catch (err) {
    console.error('Error during creation:', err)
  } finally {
    await prisma.$disconnect()
  }
}

test()
