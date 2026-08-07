'use server'

import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/authz'
import { revalidatePath } from 'next/cache'
import { handleActionError, ValidationError, NotFoundError } from '@/lib/errors'
import { createSalesInvoice } from '@/app/actions/invoice'
import {
  AbrirComandaSchema,
  LancarItemSchema,
  FecharComandaSchema,
  type AbrirComandaFormData,
  type LancarItemFormData,
  type FecharComandaFormData,
} from '@/modules/food/schemas'
import {
  totaisDaComanda,
  podeFechar,
  podeTransitar,
  estadoAoEnviar,
  distribuirDesconto,
  dividirConta,
  arredondar,
  type EstadoItem,
} from '@/modules/food/lib/comanda'

/**
 * A comanda, do abrir ao fechar.
 *
 * Todas as contas vêm de `lib/comanda.ts`, que é puro e testado. Aqui só se
 * carrega, se decide com base nessas funções, e se grava.
 */

export type ComandaCompleta = {
  id: string
  numero: number
  tipo: 'MESA' | 'BALCAO' | 'DELIVERY'
  estado: 'ABERTA' | 'FECHADA' | 'CANCELADA'
  mesa: { id: string; nome: string } | null
  cliente: { id: string; name: string } | null
  pessoas: number
  servicoPct: number
  desconto: number
  notas: string | null
  abertaEm: Date
  fechadaEm: Date | null
  invoiceId: string | null
  itens: {
    id: string
    produtoId: string
    nome: string
    quantidade: number
    precoUnit: number
    observacao: string | null
    estado: EstadoItem
    area: 'COZINHA' | 'BAR' | 'CHAPA' | 'SEM_PREPARO'
    enviadoEm: Date | null
  }[]
  totais: { subtotal: number; servico: number; desconto: number; total: number }
  porPessoa: number[]
}

async function carregar(tenantId: string, id: string) {
  const c = await prisma.comanda.findFirst({
    where: { id, tenantId },
    include: {
      mesa: { select: { id: true, nome: true } },
      customer: { select: { id: true, name: true } },
      itens: {
        orderBy: { createdAt: 'asc' },
        include: { product: { select: { id: true, name: true } } },
      },
    },
  })
  if (!c) throw new NotFoundError('Comanda')
  return c
}

function montar(c: Awaited<ReturnType<typeof carregar>>): ComandaCompleta {
  const linhas = c.itens.map((i) => ({
    quantidade: Number(i.quantidade),
    precoUnit: Number(i.precoUnit),
    estado: i.estado as EstadoItem,
  }))
  const totais = totaisDaComanda(linhas, {
    servicoPct: Number(c.servicoPct),
    desconto: Number(c.desconto),
  })

  return {
    id: c.id,
    numero: c.numero,
    tipo: c.tipo,
    estado: c.estado,
    mesa: c.mesa,
    cliente: c.customer,
    pessoas: c.pessoas,
    servicoPct: Number(c.servicoPct),
    desconto: Number(c.desconto),
    notas: c.notas,
    abertaEm: c.abertaEm,
    fechadaEm: c.fechadaEm,
    invoiceId: c.invoiceId,
    itens: c.itens.map((i) => ({
      id: i.id,
      produtoId: i.productId,
      nome: i.product.name,
      quantidade: Number(i.quantidade),
      precoUnit: Number(i.precoUnit),
      observacao: i.observacao,
      estado: i.estado as EstadoItem,
      area: i.area,
      enviadoEm: i.enviadoEm,
    })),
    totais,
    porPessoa: dividirConta(totais.total, c.pessoas),
  }
}

export async function getComanda(id: string): Promise<ComandaCompleta> {
  const { tenantId } = await requirePermission('food:read')
  return montar(await carregar(tenantId, id))
}

export async function getComandasAbertas(): Promise<
  { id: string; numero: number; tipo: string; mesa: string | null; total: number; abertaEm: Date }[]
> {
  const { tenantId } = await requirePermission('food:read')

  const cs = await prisma.comanda.findMany({
    where: { tenantId, estado: 'ABERTA' },
    orderBy: { abertaEm: 'asc' },
    include: {
      mesa: { select: { nome: true } },
      itens: { select: { quantidade: true, precoUnit: true, estado: true } },
    },
  })

  return cs.map((c) => ({
    id: c.id,
    numero: c.numero,
    tipo: c.tipo,
    mesa: c.mesa?.nome ?? null,
    abertaEm: c.abertaEm,
    total: totaisDaComanda(
      c.itens.map((i) => ({
        quantidade: Number(i.quantidade),
        precoUnit: Number(i.precoUnit),
        estado: i.estado as EstadoItem,
      })),
      { servicoPct: Number(c.servicoPct), desconto: Number(c.desconto) }
    ).total,
  }))
}

export async function abrirComanda(data: AbrirComandaFormData): Promise<{ id: string }> {
  try {
    const { tenantId, userId } = await requirePermission('food:write')
    const p = AbrirComandaSchema.parse(data)

    if (p.mesaId) {
      const ocupada = await prisma.comanda.count({
        where: { tenantId, mesaId: p.mesaId, estado: 'ABERTA' },
      })
      // Duas comandas na mesma mesa é como se perde uma delas: a segunda tapa
      // a primeira no ecrã e a conta sai a metade.
      if (ocupada > 0) throw new ValidationError('Esta mesa já tem uma comanda aberta.')
    }

    // O número é sequencial por cliente e serve para se chamar em voz alta.
    // Numa transação com o `max` para duas caixas ao mesmo tempo não pedirem o
    // mesmo número — o índice único apanharia, mas com um erro que ninguém
    // percebe em vez de um número seguinte.
    const comanda = await prisma.$transaction(async (tx) => {
      const ultima = await tx.comanda.aggregate({
        where: { tenantId },
        _max: { numero: true },
      })
      return tx.comanda.create({
        data: {
          tenantId,
          numero: (ultima._max.numero ?? 0) + 1,
          tipo: p.tipo,
          mesaId: p.mesaId || null,
          customerId: p.customerId || null,
          pessoas: p.pessoas,
          notas: p.notas || null,
          abertaPor: userId,
        },
        select: { id: true },
      })
    })

    revalidatePath(`/${tenantId}/salao`)
    return comanda
  } catch (error) {
    handleActionError(error)
  }
}

export async function lancarItem(comandaId: string, data: LancarItemFormData) {
  try {
    const { tenantId } = await requirePermission('food:write')
    const p = LancarItemSchema.parse(data)

    const comanda = await prisma.comanda.findFirst({
      where: { id: comandaId, tenantId },
      select: { estado: true },
    })
    if (!comanda) throw new NotFoundError('Comanda')
    if (comanda.estado !== 'ABERTA') {
      throw new ValidationError('A comanda já está fechada.')
    }

    const produto = await prisma.product.findFirst({
      where: { id: p.productId, tenantId },
      select: { price: true, menuItem: { select: { area: true, disponivel: true } } },
    })
    if (!produto) throw new NotFoundError('Produto')
    if (produto.menuItem && !produto.menuItem.disponivel) {
      throw new ValidationError('Este item está esgotado hoje.')
    }

    await prisma.comandaItem.create({
      data: {
        comandaId,
        productId: p.productId,
        quantidade: p.quantidade,
        // O preço é copiado agora. Se a casa mudar a tabela a meio do serviço,
        // quem já pediu paga o que lhe foi dito.
        precoUnit: produto.price,
        observacao: p.observacao || null,
        area: produto.menuItem?.area ?? 'COZINHA',
      },
    })

    revalidatePath(`/${tenantId}/comandas/${comandaId}`)
  } catch (error) {
    handleActionError(error)
  }
}

/** Manda para a cozinha tudo o que ainda está por enviar. */
export async function enviarParaPreparo(comandaId: string) {
  try {
    const { tenantId } = await requirePermission('food:write')

    const itens = await prisma.comandaItem.findMany({
      where: { comandaId, estado: 'LANCADO', comanda: { tenantId } },
      select: { id: true, area: true },
    })
    if (itens.length === 0) throw new ValidationError('Não há itens novos para enviar.')

    const agora = new Date()
    await prisma.$transaction(
      itens.map((i) =>
        prisma.comandaItem.update({
          where: { id: i.id },
          data: {
            estado: estadoAoEnviar(i.area),
            enviadoEm: agora,
            // Uma bebida engarrafada é entregue no mesmo gesto: não há preparo
            // para esperar, e deixá-la "pronta" enchia o ecrã da cozinha.
            prontoEm: i.area === 'SEM_PREPARO' ? agora : null,
          },
        })
      )
    )

    revalidatePath(`/${tenantId}/comandas/${comandaId}`)
    revalidatePath(`/${tenantId}/cozinha`)
    return { enviados: itens.length }
  } catch (error) {
    handleActionError(error)
  }
}

export async function mudarEstadoItem(itemId: string, para: EstadoItem) {
  try {
    const { tenantId } = await requirePermission('food:write')

    const item = await prisma.comandaItem.findFirst({
      where: { id: itemId, comanda: { tenantId } },
      select: { estado: true, comandaId: true },
    })
    if (!item) throw new NotFoundError('Item')

    if (!podeTransitar(item.estado as EstadoItem, para)) {
      throw new ValidationError(
        `Um item ${item.estado.toLowerCase()} não pode passar a ${para.toLowerCase()}.`
      )
    }

    await prisma.comandaItem.update({
      where: { id: itemId },
      data: {
        estado: para,
        ...(para === 'PRONTO' ? { prontoEm: new Date() } : {}),
      },
    })

    revalidatePath(`/${tenantId}/comandas/${item.comandaId}`)
    revalidatePath(`/${tenantId}/cozinha`)
  } catch (error) {
    handleActionError(error)
  }
}

/**
 * Fecha a conta e emite a venda.
 *
 * O desconto reparte-se pelas linhas em vez de ir numa linha própria: reduzir a
 * base tributável é o tratamento correto de um desconto, e uma linha negativa
 * baralharia o cálculo do IVA no núcleo.
 *
 * O serviço vai como uma linha de serviço — porque é isso que é, e porque assim
 * aparece discriminado no documento em vez de diluído na comida.
 */
export async function fecharComanda(id: string, data: FecharComandaFormData) {
  try {
    const { tenantId } = await requirePermission('food:write')
    const p = FecharComandaSchema.parse(data)

    const c = await carregar(tenantId, id)
    if (c.estado !== 'ABERTA') throw new ValidationError('A comanda já está fechada.')

    const linhas = c.itens.map((i) => ({
      quantidade: Number(i.quantidade),
      precoUnit: Number(i.precoUnit),
      estado: i.estado as EstadoItem,
    }))

    const verificacao = podeFechar(linhas)
    if (!verificacao.pode) throw new ValidationError(verificacao.motivo!)

    const totais = totaisDaComanda(linhas, {
      servicoPct: p.servicoPct,
      desconto: p.desconto,
    })

    const cobraveis = c.itens.filter((i) => i.estado !== 'CANCELADO')
    const totaisDeLinha = cobraveis.map((i) => Number(i.quantidade) * Number(i.precoUnit))
    const descontos = distribuirDesconto(totaisDeLinha, totais.desconto)

    const itensDaFatura = cobraveis.map((i, n) => {
      const qtd = Number(i.quantidade)
      return {
        productId: i.productId,
        quantity: qtd,
        unitPrice: arredondar((totaisDeLinha[n] - descontos[n]) / qtd, 'USD'),
      }
    })

    if (totais.servico > 0) {
      itensDaFatura.push({
        productId: await produtoDeServico(tenantId),
        quantity: 1,
        unitPrice: totais.servico,
      })
    }

    const invoice = await createSalesInvoice({
      type: 'SALES',
      customerId: c.customerId ?? (await consumidorFinal(tenantId)),
      notes: `Comanda ${c.numero}${c.mesa ? ` — ${c.mesa.nome}` : ''}`,
      items: itensDaFatura,
    })

    await prisma.comanda.update({
      where: { id },
      data: {
        estado: 'FECHADA',
        servicoPct: p.servicoPct,
        desconto: totais.desconto,
        fechadaEm: new Date(),
        invoiceId: invoice.id,
      },
    })

    revalidatePath(`/${tenantId}/salao`)
    revalidatePath(`/${tenantId}/comandas/${id}`)
    return { invoiceId: invoice.id, total: totais.total }
  } catch (error) {
    handleActionError(error)
  }
}

export async function cancelarComanda(id: string, motivo: string) {
  try {
    const { tenantId, userId } = await requirePermission('food:delete')

    const c = await prisma.comanda.findFirst({
      where: { id, tenantId },
      select: { estado: true, numero: true },
    })
    if (!c) throw new NotFoundError('Comanda')
    if (c.estado !== 'ABERTA') throw new ValidationError('Só se cancela uma comanda aberta.')

    await prisma.$transaction([
      prisma.comandaItem.updateMany({
        where: { comandaId: id, estado: { notIn: ['ENTREGUE', 'CANCELADO'] } },
        data: { estado: 'CANCELADO' },
      }),
      prisma.comanda.update({
        where: { id },
        data: { estado: 'CANCELADA', fechadaEm: new Date() },
      }),
      // Cancelar uma conta com comida já feita é prejuízo. Fica registado quem
      // cancelou e porquê — não para culpar ninguém, para se poder somar ao fim
      // do mês e perceber o que está a acontecer.
      prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'CANCEL_COMANDA',
          entity: 'Comanda',
          entityId: id,
          details: { numero: c.numero, motivo },
        },
      }),
    ])

    revalidatePath(`/${tenantId}/salao`)
    revalidatePath(`/${tenantId}/comandas/${id}`)
  } catch (error) {
    handleActionError(error)
  }
}

/**
 * O cliente das contas de balcão.
 *
 * A fatura do núcleo exige um cliente, e a esmagadora maioria das contas de uma
 * lanchonete não tem um. "Consumidor Final" é o que a SET reconhece para vendas
 * sem identificação, e criar um por cliente é melhor do que obrigar o
 * empregado a inventar nomes ao balcão.
 */
async function consumidorFinal(tenantId: string): Promise<string> {
  const existente = await prisma.customer.findFirst({
    where: { tenantId, name: 'Consumidor Final' },
    select: { id: true },
  })
  if (existente) return existente.id

  const criado = await prisma.customer.create({
    data: { tenantId, name: 'Consumidor Final', category: 'retail' },
    select: { id: true },
  })
  return criado.id
}

/** O serviço é um produto de serviço — sem estoque e sem entrar no inventário. */
async function produtoDeServico(tenantId: string): Promise<string> {
  const sku = 'FOOD-SERVICO'
  const existente = await prisma.product.findFirst({
    where: { tenantId, sku },
    select: { id: true },
  })
  if (existente) return existente.id

  const criado = await prisma.product.create({
    data: {
      tenantId,
      sku,
      name: 'Serviço',
      price: 0,
      isService: true,
      unit: 'serv',
    },
    select: { id: true },
  })
  return criado.id
}
