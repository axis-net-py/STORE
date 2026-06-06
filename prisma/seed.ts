import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create production tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: "axis" },
    update: {},
    create: {
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

  // Create SOVEREIGN user
  const hashedPassword = await hash("admin123", 12);
  const user = await prisma.user.upsert({
    where: { email: "admin@axis.erp" },
    update: {},
    create: {
      email: "admin@axis.erp",
      name: "Admin",
      password: hashedPassword,
      role: "SOVEREIGN",
      tenantId: tenant.id,
    },
  });

  // Create OPERATOR user
  await prisma.user.upsert({
    where: { email: "operator@axis.erp" },
    update: {},
    create: {
      email: "operator@axis.erp",
      name: "Operador",
      password: await hash("operator123", 12),
      role: "OPERATOR",
      tenantId: tenant.id,
    },
  });

  // Create chart of accounts
  const accounts = [
    { code: "1.1.01", namePt: "Caixa", nameEs: "Caja", type: "ASSET" as const },
    { code: "1.1.02", namePt: "Bancos", nameEs: "Bancos", type: "ASSET" as const },
    { code: "1.2.01", namePt: "Clientes", nameEs: "Clientes", type: "ASSET" as const },
    { code: "1.2.02", namePt: "Estoque", nameEs: "Inventario", type: "ASSET" as const },
    { code: "2.1.01", namePt: "Fornecedores", nameEs: "Proveedores", type: "LIABILITY" as const },
    { code: "2.2.01", namePt: "IVA Crédito", nameEs: "IVA Crédito", type: "LIABILITY" as const },
    { code: "2.2.02", namePt: "IVA Débito", nameEs: "IVA Débito", type: "LIABILITY" as const },
    { code: "3.1.01", namePt: "Capital Social", nameEs: "Capital Social", type: "EQUITY" as const },
    { code: "4.1.01", namePt: "Receita de Vendas", nameEs: "Ingresos por Ventas", type: "REVENUE" as const },
    { code: "5.1.01", namePt: "Custo das Mercadorias", nameEs: "Costo de Mercancías", type: "EXPENSE" as const },
    { code: "5.2.01", namePt: "Despesas Operacionais", nameEs: "Gastos Operativos", type: "EXPENSE" as const },
  ];

  for (const account of accounts) {
    await prisma.account.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: account.code } },
      update: {},
      create: {
        ...account,
        tenantId: tenant.id,
      },
    });
  }

  // Create default permissions for SOVEREIGN (all enabled)
  const permissionActions = [
    "dashboard:read", "customers:read", "customers:write", "customers:delete",
    "suppliers:read", "suppliers:write", "suppliers:delete",
    "products:read", "products:write", "products:delete",
    "invoices:read", "invoices:write", "invoices:delete",
    "inventory:read", "inventory:write",
    "accounting:read", "accounting:write",
    "reports:read",
    "settings:read", "settings:write",
    "users:manage",
  ];

  for (const action of permissionActions) {
    await prisma.permission.upsert({
      where: {
        action_role_tenantId: {
          action,
          role: "SOVEREIGN",
          tenantId: tenant.id,
        },
      },
      update: {},
      create: {
        action,
        role: "SOVEREIGN",
        tenantId: tenant.id,
      },
    });
    // Also grant most permissions to ADMIN
    if (!action.includes("delete") && action !== "users:manage") {
      await prisma.permission.upsert({
        where: {
          action_role_tenantId: {
            action,
            role: "ADMIN",
            tenantId: tenant.id,
          },
        },
        update: {},
        create: {
          action,
          role: "ADMIN",
          tenantId: tenant.id,
        },
      });
    }
  }

  // Create sample exchange rate
  await prisma.exchangeRate.create({
    data: {
      tenantId: tenant.id,
      ratePYGtoUSD: 7800,
      ratePYGtoBRL: 1350,
      source: "BCP_API",
      isManual: false,
    },
  });

  // Create sample products
  const products = [
    { sku: "PROD-001", name: "Produto Demo A", price: 50000, cost: 35000, currentStock: 100, minStock: 10 },
    { sku: "PROD-002", name: "Produto Demo B", price: 75000, cost: 50000, currentStock: 50, minStock: 5 },
    { sku: "PROD-003", name: "Produto Demo C", price: 120000, cost: 80000, currentStock: 25, minStock: 3 },
    { sku: "SERV-001", name: "Serviço de Consultoria", price: 250000, cost: 0, currentStock: 0, minStock: 0, isService: true, unit: "hora" },
  ];

  for (const prod of products) {
    await prisma.product.upsert({
      where: {
        tenantId_sku: {
          tenantId: tenant.id,
          sku: prod.sku,
        },
      },
      update: {
        name: prod.name,
        price: prod.price,
        cost: prod.cost,
        currentStock: prod.currentStock,
        minStock: prod.minStock,
        isService: prod.isService ?? false,
        unit: prod.unit ?? "un",
      },
      create: {
        ...prod,
        tenantId: tenant.id,
      },
    });
  }

  // Create sample customers
  const customers = [
    { name: "João Silva", document: "1234567-8", documentType: "CI", email: "joao@email.com", country: "PY", category: "fisica" },
    { name: "María García", document: "80098765-1", documentType: "RUC", email: "maria@email.com", country: "PY", category: "fisica" },
    { name: "Carlos Import S.A.", document: "80054321-0", documentType: "RUC", email: "carlos@import.com", country: "PY", category: "juridica" },
  ];

  for (const cust of customers) {
    await prisma.customer.create({
      data: {
        ...cust,
        tenantId: tenant.id,
      },
    });
  }

  // Create sample suppliers
  const suppliers = [
    { name: "Distribuidora Paraguay", businessName: "Distribuidora Paraguay S.A.", document: "80011111-1", documentType: "RUC", email: "contato@distpy.com", country: "PY", paymentTerms: "30 días" },
    { name: "Fornecedor Brasil", businessName: "Fornecedor Brasil Ltda.", document: "12345678000199", documentType: "CNPJ", email: "vendas@fornbr.com", country: "BR", paymentTerms: "Net 60" },
  ];

  for (const sup of suppliers) {
    await prisma.supplier.create({
      data: {
        ...sup,
        tenantId: tenant.id,
      },
    });
  }

  console.log("Seed completed successfully!");
  console.log(`  Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`  Admin: admin@axis.erp / admin123`);
  console.log(`  Operator: operator@axis.erp / operator123`);
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
