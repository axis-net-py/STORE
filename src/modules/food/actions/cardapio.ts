'use server'

import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'
import { revalidatePath } from 'next/cache'
import { handleActionError } from '@/lib/errors'
import { MenuItemSchema, AREAS, type MenuItemFormData } from '@/modules/food/schemas'
import { filaDaCozinha, minutosDeEspera, type Area, type EstadoItem } from '@/modules/food/lib/comanda'

/**
 * O cardápio e o ecrã da cozinha.
 *
 * O cardápio não duplica o produto: acrescenta-lhe o que só interessa ao salão
 * — em que secção aparece, por que ordem, onde se prepara e se hoje há.
 */

export type ItemDoCardapio = {
  id: string
  produtoId: string
  nome: string
  preco: number
  seccao: string
  ordem: number
  area: Area
  disponivel: boolean
}

export async function getCardapio(): Promise<ItemDoCardapio[]> {
  const { tenantId } = await requirePermission('food:read')

  const itens = await prisma.menuItem.findMany({
    where: { tenantId },
    orderBy: [{ seccao: 'asc' }, { ordem: 'asc' }],
    include: { product: { select: { id: true, name: true, price: true, isActive: true } } },
  })

  return itens
    // Um produto desativado sai do cardápio sem ninguém ter de se lembrar de o
    // tirar aqui também.
    .filter((i) => i.product.isActive)
    .map((i) => ({
      id: i.id,
      produtoId: i.product.id,
      nome: i.product.name,
      preco: Number(i.product.price),
      seccao: i.seccao,
      ordem: i.ordem,
      area: i.area,
      disponivel: i.disponivel,
    }))
}

/** Produtos ativos que ainda não têm face no cardápio. */
export async function getProdutosForaDoCardapio() {
  const { tenantId } = await requirePermission('food:read')
  return prisma.product.findMany({
    where: { tenantId, isActive: true, menuItem: null },
    select: { id: true, name: true, price: true, sku: true },
    orderBy: { name: 'asc' },
    take: 200,
  })
}

/**
 * Um prato preparado não tem estoque de si próprio.
 *
 * O núcleo recusa vender abaixo de zero, e faz bem: numa loja, vender o que não
 * se tem é um erro. Num restaurante seria impossível trabalhar — ninguém dá
 * entrada de "hambúrgueres" no armazém. O que existe em estoque é o pão, a
 * carne e o queijo; o hambúrguer nasce no momento em que é pedido.
 *
 * O núcleo já tem a distinção que é precisa: `isService` quer dizer "não move
 * estoque". O nome vem do comércio, onde a única coisa sem estoque é um
 * serviço, mas a regra é a mesma e não vale a pena duplicá-la.
 *
 * Uma garrafa de cerveja é o caso contrário: compra-se e revende-se tal e qual,
 * e aí o controlo de estoque é exatamente o que se quer. É por isso que a área
 * de preparo decide — SEM_PREPARO desconta, tudo o resto não.
 *
 * Quando houver ficha técnica, é ela que passa a descontar os ingredientes na
 * venda, e esta regra deixa de ser uma aproximação para ser o primeiro passo
 * dela.
 */
async function alinharControloDeEstoque(
  tenantId: string,
  productId: string,
  area: (typeof AREAS)[number]
) {
  await prisma.product.updateMany({
    where: { id: productId, tenantId },
    data: { isService: area !== 'SEM_PREPARO' },
  })
}

export async function adicionarAoCardapio(data: MenuItemFormData) {
  try {
    const { tenantId } = await requirePermission('food:write')
    const p = MenuItemSchema.parse(data)

    await prisma.menuItem.create({ data: { tenantId, ...p } })
    await alinharControloDeEstoque(tenantId, p.productId, p.area)

    revalidatePath(`/${tenantId}/cardapio`)
    revalidatePath(`/${tenantId}/products`)
  } catch (error) {
    handleActionError(error)
  }
}

export async function atualizarItemDoCardapio(id: string, data: Partial<MenuItemFormData>) {
  try {
    const { tenantId } = await requirePermission('food:write')
    const p = MenuItemSchema.partial().parse(data)

    await prisma.menuItem.updateMany({ where: { id, tenantId }, data: p })

    if (p.area) {
      const item = await prisma.menuItem.findFirst({
        where: { id, tenantId },
        select: { productId: true },
      })
      if (item) await alinharControloDeEstoque(tenantId, item.productId, p.area)
    }

    revalidatePath(`/${tenantId}/cardapio`)
    revalidatePath(`/${tenantId}/products`)
  } catch (error) {
    handleActionError(error)
  }
}

/**
 * Acabou hoje.
 *
 * Diferente de desativar o produto: amanhã há outra vez, e o histórico de
 * vendas não se toca. É o botão que o gerente carrega às oito da noite quando
 * a cozinha avisa que já não há.
 */
export async function alternarDisponibilidade(id: string) {
  try {
    const { tenantId } = await requirePermission('food:write')

    const item = await prisma.menuItem.findFirst({
      where: { id, tenantId },
      select: { disponivel: true },
    })
    if (!item) return

    await prisma.menuItem.updateMany({
      where: { id, tenantId },
      data: { disponivel: !item.disponivel },
    })
    revalidatePath(`/${tenantId}/cardapio`)
  } catch (error) {
    handleActionError(error)
  }
}

export async function removerDoCardapio(id: string) {
  try {
    const { tenantId } = await requirePermission('food:delete')
    await prisma.menuItem.deleteMany({ where: { id, tenantId } })
    revalidatePath(`/${tenantId}/cardapio`)
  } catch (error) {
    handleActionError(error)
  }
}

export type ItemNaCozinha = {
  id: string
  nome: string
  quantidade: number
  observacao: string | null
  estado: EstadoItem
  area: Area
  enviadoEm: Date | null
  espera: number
  comanda: { id: string; numero: number; mesa: string | null }
}

/**
 * O que está a ser feito, por ordem de espera.
 *
 * A espera é calculada no servidor com um relógio só — se cada navegador
 * usasse o seu, duas cozinhas veriam tempos diferentes para o mesmo prato.
 */
export async function getCozinha(area?: Area): Promise<ItemNaCozinha[]> {
  const { tenantId } = await requirePermission('food:read')

  const itens = await prisma.comandaItem.findMany({
    where: {
      comanda: { tenantId, estado: 'ABERTA' },
      estado: { in: ['EM_PREPARO', 'PRONTO'] },
    },
    include: {
      product: { select: { name: true } },
      comanda: {
        select: { id: true, numero: true, mesa: { select: { nome: true } } },
      },
    },
  })

  const agora = new Date()
  const ordenados = filaDaCozinha(
    itens.map((i) => ({
      id: i.id,
      area: i.area as Area,
      estado: i.estado as EstadoItem,
      enviadoEm: i.enviadoEm,
    })),
    area
  )

  const porId = new Map(itens.map((i) => [i.id, i]))
  return ordenados.map((o) => {
    const i = porId.get(o.id)!
    return {
      id: i.id,
      nome: i.product.name,
      quantidade: Number(i.quantidade),
      observacao: i.observacao,
      estado: i.estado as EstadoItem,
      area: i.area as Area,
      enviadoEm: i.enviadoEm,
      espera: minutosDeEspera(i.enviadoEm, agora),
      comanda: {
        id: i.comanda.id,
        numero: i.comanda.numero,
        mesa: i.comanda.mesa?.nome ?? null,
      },
    }
  })
}
