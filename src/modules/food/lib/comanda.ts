/**
 * Regras da comanda — puras, sem base de dados, testáveis com `node --test`.
 *
 * Aqui vive o que decide dinheiro e o que decide se a cozinha pode avançar.
 * Fora daqui só há leitura e escrita: as server actions carregam, chamam estas
 * funções e gravam. Contas feitas dentro de um componente ou de uma action são
 * contas que ninguém consegue testar sem levantar meia aplicação.
 */

export type EstadoItem =
  | 'LANCADO'
  | 'EM_PREPARO'
  | 'PRONTO'
  | 'ENTREGUE'
  | 'CANCELADO'

export type Area = 'COZINHA' | 'BAR' | 'CHAPA' | 'SEM_PREPARO'

export type LinhaComanda = {
  quantidade: number
  precoUnit: number
  estado: EstadoItem
}

export type Totais = {
  subtotal: number
  servico: number
  desconto: number
  total: number
}

/**
 * Casas decimais de cada moeda.
 *
 * O guarani não tem cêntimos. Arredondar a duas casas produzia contas que
 * nenhuma caixa do Paraguai consegue pagar — não há moeda para 1.234,56 Gs.
 */
export function casasDecimais(moeda: string): number {
  return moeda === 'PYG' ? 0 : 2
}

/** Arredonda para a menor unidade que existe fisicamente nesta moeda. */
export function arredondar(valor: number, moeda: string): number {
  const f = 10 ** casasDecimais(moeda)
  // O epsilon corrige o erro de vírgula flutuante que faz Math.round(2.675*100)
  // dar 267 em vez de 268. Numa conta de restaurante isso é um guarani a menos
  // por linha, todos os dias.
  return Math.round(valor * f + Number.EPSILON * f) / f
}

/**
 * Um item cancelado não se cobra, e um item por lançar também não existe para
 * a conta antes de ser lançado. Tudo o resto conta, incluindo o que ainda está
 * na chapa: quem pediu, pagou.
 */
export function contaParaTotal(estado: EstadoItem): boolean {
  return estado !== 'CANCELADO'
}

export function totaisDaComanda(
  itens: LinhaComanda[],
  opcoes: { servicoPct?: number; desconto?: number; moeda?: string } = {}
): Totais {
  const moeda = opcoes.moeda ?? 'PYG'
  const servicoPct = Math.max(0, opcoes.servicoPct ?? 0)

  const subtotal = arredondar(
    itens
      .filter((i) => contaParaTotal(i.estado))
      .reduce((t, i) => t + i.quantidade * i.precoUnit, 0),
    moeda
  )

  // O serviço incide sobre o consumo, nunca sobre o desconto que a casa deu.
  // Cobrar 10% de serviço sobre um valor que já se abateu é cobrar duas vezes
  // ao cliente pela mesma cortesia.
  const servico = arredondar((subtotal * servicoPct) / 100, moeda)

  // O desconto nunca põe a conta negativa: uma conta a pagar ao cliente não é
  // um desconto, é um erro de digitação.
  const desconto = arredondar(
    Math.min(Math.max(0, opcoes.desconto ?? 0), subtotal + servico),
    moeda
  )

  return {
    subtotal,
    servico,
    desconto,
    total: arredondar(subtotal + servico - desconto, moeda),
  }
}

/**
 * Divide a conta por N pessoas, sem perder nem inventar dinheiro.
 *
 * Dividir 10.001 Gs por 3 e arredondar cada parte dá 3.334 × 3 = 10.002 — um
 * guarani a mais, todas as noites, em todas as mesas. As partes saem por baixo
 * e o resto distribui-se uma unidade de cada vez pelas primeiras pessoas: a
 * soma bate sempre e a diferença máxima entre dois pagadores é a menor moeda
 * que existe.
 */
export function dividirConta(total: number, pessoas: number, moeda = 'PYG'): number[] {
  const n = Math.max(1, Math.floor(pessoas))
  const f = 10 ** casasDecimais(moeda)

  const unidades = Math.round(arredondar(total, moeda) * f)
  const base = Math.floor(unidades / n)
  const resto = unidades - base * n

  return Array.from({ length: n }, (_, i) => (base + (i < resto ? 1 : 0)) / f)
}

/**
 * Reparte um desconto pelas linhas, na proporção do que cada uma pesa.
 *
 * O desconto tem de chegar à fatura de alguma forma, e a forma certa é reduzir
 * a base tributável linha a linha: um desconto reduz o que se vendeu, e o IVA
 * segue-o. As alternativas eram piores — uma linha "Desconto" com valor
 * negativo baralha o cálculo do imposto, e descontar só na última linha faria
 * uma garrafa de água pagar o desconto de um bife.
 *
 * Reparte-se em unidades mínimas da moeda e o resto vai para as linhas maiores,
 * por ordem: a soma bate ao guarani com o desconto pedido, sem sobras.
 */
export function distribuirDesconto(
  totaisDeLinha: number[],
  desconto: number,
  moeda = 'PYG'
): number[] {
  const f = 10 ** casasDecimais(moeda)
  const linhas = totaisDeLinha.map((t) => Math.round(t * f))
  const soma = linhas.reduce((a, b) => a + b, 0)
  const alvo = Math.min(Math.max(0, Math.round(desconto * f)), soma)

  if (soma === 0 || alvo === 0) return totaisDeLinha.map(() => 0)

  const partes = linhas.map((v) => Math.floor((v * alvo) / soma))
  let resto = alvo - partes.reduce((a, b) => a + b, 0)

  // O resto vai para as linhas de maior valor: são as que absorvem uma unidade
  // sem que se note, e a ordem é determinista para a conta dar sempre o mesmo.
  const ordem = linhas
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v || a.i - b.i)
  for (const { i } of ordem) {
    if (resto <= 0) break
    partes[i] += 1
    resto -= 1
  }

  return partes.map((p) => p / f)
}

/**
 * Transições permitidas de um item.
 *
 * Um item SEM_PREPARO — uma garrafa de água, um refrigerante — salta o preparo
 * e vai direto para entregue: não há nada a fazer com ele na cozinha, e obrigar
 * o balcão a carregar em "pronto" numa cerveja é trabalho inventado.
 *
 * Depois de entregue, acabou. Cancelar comida já servida é uma devolução, e uma
 * devolução é um assunto do fecho da conta, não do estado do item.
 */
const TRANSICOES: Record<EstadoItem, EstadoItem[]> = {
  LANCADO: ['EM_PREPARO', 'ENTREGUE', 'CANCELADO'],
  EM_PREPARO: ['PRONTO', 'CANCELADO'],
  PRONTO: ['ENTREGUE'],
  ENTREGUE: [],
  CANCELADO: [],
}

export function podeTransitar(de: EstadoItem, para: EstadoItem): boolean {
  return TRANSICOES[de].includes(para)
}

/** Para onde vai um item quando é enviado, conforme onde se prepara. */
export function estadoAoEnviar(area: Area): EstadoItem {
  return area === 'SEM_PREPARO' ? 'ENTREGUE' : 'EM_PREPARO'
}

/**
 * A conta só fecha quando não há comida por entregar.
 *
 * Fechar com um prato ainda na chapa é cobrar por algo que ninguém comeu, e é
 * assim que se descobre o problema à porta, com o cliente já a pagar.
 */
export function podeFechar(itens: LinhaComanda[]): { pode: boolean; motivo?: string } {
  const pendentes = itens.filter(
    (i) => i.estado === 'EM_PREPARO' || i.estado === 'PRONTO'
  ).length
  if (pendentes > 0) {
    return {
      pode: false,
      motivo: `Há ${pendentes} item(ns) por entregar. Entregue ou cancele antes de fechar.`,
    }
  }
  if (itens.filter((i) => contaParaTotal(i.estado)).length === 0) {
    return { pode: false, motivo: 'A comanda não tem itens a cobrar.' }
  }
  return { pode: true }
}

export type ItemNaFila = {
  id: string
  area: Area
  estado: EstadoItem
  enviadoEm: Date | null
}

/**
 * Ordem de trabalho da cozinha: o que espera há mais tempo é o que sai a
 * seguir.
 *
 * Um item pronto continua na fila até ser levantado — o cozinheiro precisa de
 * o ver para o cantar, e o empregado precisa de saber que está à espera dele.
 * O que ainda não foi enviado não pertence aqui: está a ser escrito na mesa.
 */
export function filaDaCozinha(itens: ItemNaFila[], area?: Area): ItemNaFila[] {
  return itens
    .filter((i) => i.estado === 'EM_PREPARO' || i.estado === 'PRONTO')
    .filter((i) => !area || i.area === area)
    .sort((a, b) => {
      // Pronto desce: já não é trabalho, é entrega.
      if (a.estado !== b.estado) return a.estado === 'EM_PREPARO' ? -1 : 1
      const ta = a.enviadoEm?.getTime() ?? 0
      const tb = b.enviadoEm?.getTime() ?? 0
      return ta - tb
    })
}

/** Minutos inteiros desde o envio. Sem envio, não há espera. */
export function minutosDeEspera(enviadoEm: Date | null, agora: Date): number {
  if (!enviadoEm) return 0
  return Math.max(0, Math.floor((agora.getTime() - enviadoEm.getTime()) / 60_000))
}

/**
 * A partir de quantos minutos um pedido está atrasado.
 *
 * Vinte minutos é o que uma mesa aceita sem perguntar. Não é uma regra fiscal
 * nem uma promessa ao cliente: é o momento em que vale a pena o ecrã da cozinha
 * mudar de cor, para alguém olhar antes de o cliente ter de chamar.
 */
export const MINUTOS_ATRASO = 20

export function estaAtrasado(enviadoEm: Date | null, agora: Date): boolean {
  return minutosDeEspera(enviadoEm, agora) >= MINUTOS_ATRASO
}
