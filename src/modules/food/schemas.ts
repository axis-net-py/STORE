import { z } from 'zod'

/**
 * Schemas de validação do módulo food.
 *
 * Vivem no módulo, não no núcleo (spec Projeto 1, §2.2). Os campos numéricos
 * aceitam string porque vêm de `<input>` — converter no schema poupa a cada
 * chamador lembrar-se de o fazer, e esquecer-se uma vez basta para gravar
 * "12" como texto onde devia estar um número.
 */

const numero = (mensagem: string) =>
  z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .pipe(z.number().nonnegative(mensagem))

export const AREAS = ['COZINHA', 'BAR', 'CHAPA', 'SEM_PREPARO'] as const

export const MesaSchema = z.object({
  nome: z.string().min(1, 'A mesa precisa de um nome').max(40),
  zona: z.string().max(60).optional().or(z.literal('')),
  lugares: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .pipe(z.number().int().min(1, 'Uma mesa tem pelo menos um lugar').max(60)),
  estado: z.enum(['LIVRE', 'RESERVADA', 'INATIVA']).default('LIVRE'),
})

export const AbrirComandaSchema = z
  .object({
    tipo: z.enum(['MESA', 'BALCAO', 'DELIVERY']).default('MESA'),
    mesaId: z.string().optional().or(z.literal('')),
    customerId: z.string().optional().or(z.literal('')),
    pessoas: z
      .union([z.number(), z.string()])
      .transform((v) => Number(v || 1))
      .pipe(z.number().int().min(1).max(60)),
    notas: z.string().max(500).optional().or(z.literal('')),
  })
  // Uma comanda de mesa sem mesa é uma conta que ninguém sabe onde está.
  .refine((d) => d.tipo !== 'MESA' || !!d.mesaId, {
    message: 'Escolha a mesa',
    path: ['mesaId'],
  })

export const LancarItemSchema = z.object({
  productId: z.string().min(1, 'Escolha o item'),
  quantidade: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .pipe(z.number().positive('A quantidade tem de ser maior que zero')),
  observacao: z.string().max(200).optional().or(z.literal('')),
})

export const FecharComandaSchema = z.object({
  servicoPct: numero('O serviço não pode ser negativo').pipe(
    z.number().max(30, 'Serviço acima de 30% não passa por engano')
  ),
  desconto: numero('O desconto não pode ser negativo'),
})

export const MenuItemSchema = z.object({
  productId: z.string().min(1, 'Escolha o produto'),
  seccao: z.string().min(1, 'A secção do cardápio é obrigatória').max(60),
  ordem: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v || 0))
    .pipe(z.number().int().min(0).max(999)),
  area: z.enum(AREAS).default('COZINHA'),
  disponivel: z.boolean().default(true),
})

export type MesaFormData = z.input<typeof MesaSchema>
export type AbrirComandaFormData = z.input<typeof AbrirComandaSchema>
export type LancarItemFormData = z.input<typeof LancarItemSchema>
export type FecharComandaFormData = z.input<typeof FecharComandaSchema>
export type MenuItemFormData = z.input<typeof MenuItemSchema>
