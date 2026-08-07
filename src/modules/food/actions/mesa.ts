'use server'

import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'
import { revalidatePath } from 'next/cache'
import { handleActionError, ValidationError } from '@/lib/errors'
import { MesaSchema, type MesaFormData } from '@/modules/food/schemas'

/**
 * O salão: as mesas e o que está em cima delas.
 *
 * O estado da mesa não guarda "ocupada". Ocupada é ter uma comanda aberta — e
 * uma verdade que se pode derivar não deve ser guardada em dois sítios, senão
 * um dia divergem e é a mesa que fica errada no ecrã enquanto o cliente está lá
 * sentado.
 */

export type MesaNoSalao = {
  id: string
  nome: string
  zona: string | null
  lugares: number
  estado: 'LIVRE' | 'RESERVADA' | 'INATIVA'
  comanda: { id: string; numero: number; abertaEm: Date; total: number } | null
}

export async function getSalao(): Promise<MesaNoSalao[]> {
  const { tenantId } = await requirePermission('food:read')

  const mesas = await prisma.restaurantTable.findMany({
    where: { tenantId },
    orderBy: [{ zona: 'asc' }, { nome: 'asc' }],
    include: {
      comandas: {
        where: { estado: 'ABERTA' },
        take: 1,
        select: {
          id: true,
          numero: true,
          abertaEm: true,
          itens: { select: { quantidade: true, precoUnit: true, estado: true } },
        },
      },
    },
  })

  return mesas.map((m) => {
    const c = m.comandas[0]
    return {
      id: m.id,
      nome: m.nome,
      zona: m.zona,
      lugares: m.lugares,
      estado: m.estado,
      comanda: c
        ? {
            id: c.id,
            numero: c.numero,
            abertaEm: c.abertaEm,
            total: c.itens
              .filter((i) => i.estado !== 'CANCELADO')
              .reduce((t, i) => t + Number(i.quantidade) * Number(i.precoUnit), 0),
          }
        : null,
    }
  })
}

export async function createMesa(data: MesaFormData) {
  try {
    const { tenantId } = await requirePermission('food:write')
    const p = MesaSchema.parse(data)

    await prisma.restaurantTable.create({
      data: { tenantId, ...p, zona: p.zona || null },
    })

    revalidatePath(`/${tenantId}/salao`)
  } catch (error) {
    handleActionError(error)
  }
}

export async function updateMesa(id: string, data: Partial<MesaFormData>) {
  try {
    const { tenantId } = await requirePermission('food:write')
    const p = MesaSchema.partial().parse(data)

    await prisma.restaurantTable.updateMany({
      where: { id, tenantId },
      data: { ...p, ...(p.zona !== undefined ? { zona: p.zona || null } : {}) },
    })

    revalidatePath(`/${tenantId}/salao`)
  } catch (error) {
    handleActionError(error)
  }
}

export async function deleteMesa(id: string) {
  try {
    const { tenantId } = await requirePermission('food:delete')

    // Apagar uma mesa com conta aberta deixaria a conta sem sítio. Desativar é
    // o que se quer quase sempre — a mesa saiu do salão mas o histórico fica.
    const aberta = await prisma.comanda.count({
      where: { tenantId, mesaId: id, estado: 'ABERTA' },
    })
    if (aberta > 0) {
      throw new ValidationError('Esta mesa tem uma comanda aberta. Feche-a primeiro.')
    }

    await prisma.restaurantTable.deleteMany({ where: { id, tenantId } })
    revalidatePath(`/${tenantId}/salao`)
  } catch (error) {
    handleActionError(error)
  }
}
