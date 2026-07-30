import { z } from 'zod'
// Caminho relativo com extensão: assim o módulo resolve tanto no bundler do
// Next como no runner nativo do Node, que não conhece os aliases do tsconfig.
import { validarRuc } from '../ruc.ts'

/**
 * Força mínima de password. Vive aqui, e não dentro de uma action, porque é
 * usada em dois sítios: mudar a senha e definir a primeira pelo link de
 * configuração. Duplicá-la deixaria os dois caminhos divergirem.
 */
export const PasswordSchema = z
  .string()
  .min(8, 'A senha deve ter no mínimo 8 caracteres')
  .regex(/[a-zA-Z]/, 'A senha deve conter letras')
  .regex(/[0-9]/, 'A senha deve conter números')

const optionalEmail = z
  .string()
  .email('E-mail inválido')
  .optional()
  .or(z.literal(''))
  .transform(v => v || undefined)

const CustomerBase = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  document: z.string().max(30).optional(),
  documentType: z.enum(['RUC', 'CI', 'CPF', 'CNPJ', 'OTHER']).optional(),
  email: optionalEmail,
  phone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  country: z.string().length(2).default('PY'),
  category: z.enum(['fisica', 'juridica']).default('fisica'),
  isActive: z.boolean().default(true),
})

export const ProductSchema = z.object({
  sku: z.string().min(1, 'SKU obrigatório').max(50),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  price: z
    .union([z.number(), z.string()])
    .transform(v => Number(v))
    .pipe(z.number().nonnegative('Preço não pode ser negativo')),
  cost: z
    .union([z.number(), z.string()])
    .transform(v => Number(v ?? 0))
    .pipe(z.number().nonnegative('Custo não pode ser negativo'))
    .default(0),
  unit: z.string().max(20).default('un'),
  currentStock: z.number().default(0),
  minStock: z.number().nonnegative().default(0),
  isActive: z.boolean().default(true),
  tags: z.string().max(500).optional(),
  isService: z.boolean().default(false),
  currency: z.enum(['PYG', 'USD', 'BRL']).default('PYG'),
  // Existe no model desde sempre e faltava aqui: sem isto, criar um produto
  // por esta via perdia a taxa de IVA e caía no default do Postgres.
  taxType: z.enum(['IVA_10', 'IVA_5', 'EXENTO']).default('IVA_10'),
})

const SupplierBase = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  businessName: z.string().max(200).optional(),
  document: z.string().max(30).optional(),
  documentType: z.enum(['RUC', 'CI', 'CPF', 'CNPJ', 'OTHER']).optional(),
  email: optionalEmail,
  phone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  country: z.string().length(2).default('PY'),
  category: z.enum(['fisica', 'juridica']).default('fisica'),
  paymentTerms: z.string().max(100).optional(),
  isActive: z.boolean().default(true),
})

// Use z.input: the form supplies pre-parse data, where .default() fields are optional.
// (z.infer/z.output would mark defaulted fields as required, breaking the form callers.)
export type CustomerFormData = z.input<typeof CustomerSchema>
export type ProductFormData = z.input<typeof ProductSchema>
export type SupplierFormData = z.input<typeof SupplierSchema>

/**
 * Quando o documento é declarado como RUC, o dígito verificador tem de bater.
 * Um RUC com erro de digitação é rejeitado pela SET e, no pior caso,
 * corresponde a OUTRO contribuinte — a contraparte errada num documento
 * fiscal. Os outros tipos (CI, CPF, CNPJ) não são validados aqui.
 */
function exigeRucValido<S extends z.ZodTypeAny>(base: S) {
  return base.refine(
    (d: any) => d.documentType !== 'RUC' || !d.document || validarRuc(d.document).valido,
    { message: 'RUC inválido: o dígito verificador não confere.', path: ['document'] }
  )
}

export const CustomerSchema = exigeRucValido(CustomerBase)
export const SupplierSchema = exigeRucValido(SupplierBase)

/** Versões sem a regra cruzada, para atualizações parciais. */
export const CustomerPartialSchema = CustomerBase.partial()
export const SupplierPartialSchema = SupplierBase.partial()
