import { z } from 'zod'

const optionalEmail = z
  .string()
  .email('E-mail inválido')
  .optional()
  .or(z.literal(''))
  .transform(v => v || undefined)

export const CustomerSchema = z.object({
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
})

export const SupplierSchema = z.object({
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
