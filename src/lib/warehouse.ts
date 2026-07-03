import { Prisma } from '@prisma/client'

/**
 * Helpers de multi-depósito para uso DENTRO de transações Prisma (tx).
 *
 * Modelo: Product.currentStock continua sendo o TOTAL consolidado (fonte de
 * verdade das validações de venda); WarehouseStock guarda a distribuição
 * por depósito. Fluxos de fatura movimentam o depósito padrão do tenant.
 */

export async function ensureDefaultWarehouse(tx: any, tenantId: string) {
  let warehouse = await tx.warehouse.findFirst({
    where: { tenantId, isDefault: true, isActive: true },
  })
  if (!warehouse) {
    warehouse = await tx.warehouse.findFirst({
      where: { tenantId, code: 'MAIN' },
    })
  }
  if (!warehouse) {
    warehouse = await tx.warehouse.create({
      data: { tenantId, name: 'Depósito Principal', code: 'MAIN', isDefault: true },
    })
  }
  return warehouse
}

/** Soma (delta positivo) ou subtrai (negativo) do saldo do produto no depósito. */
export async function bumpWarehouseStock(
  tx: any,
  warehouseId: string,
  productId: string,
  delta: number | Prisma.Decimal
) {
  const d = new Prisma.Decimal(delta)
  await tx.warehouseStock.upsert({
    where: { warehouseId_productId: { warehouseId, productId } },
    update: { quantity: { increment: d } },
    create: { warehouseId, productId, quantity: d },
  })
}
