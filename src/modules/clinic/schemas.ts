import { z } from 'zod'

/**
 * Schemas de validação do módulo clinic.
 *
 * Extraídos de lib/schemas/index.ts do CLINIC: validam entidades do módulo
 * e por isso vivem no módulo, não no núcleo (spec Projeto 1, §2.2).
 */

export const ProfessionalSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  specialty: z.string().max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida').default('#3e5c50'),
  workingHours: z.record(z.string(), z.array(z.tuple([z.string(), z.string()]))).optional(),
  active: z.boolean().default(true),
})

export const ServiceSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  durationMin: z
    .union([z.number(), z.string()])
    .transform(v => Number(v))
    .pipe(z.number().int().positive('Duração deve ser positiva')),
  price: z
    .union([z.number(), z.string()])
    .transform(v => Number(v))
    .pipe(z.number().nonnegative('Preço não pode ser negativo')),
  active: z.boolean().default(true),
})

export const AppointmentSchema = z.object({
  patientId: z.string().min(1, 'Paciente obrigatório'),
  professionalId: z.string().min(1, 'Profissional obrigatório'),
  serviceId: z.string().min(1, 'Serviço obrigatório'),
  startsAt: z
    .string()
    .min(1, 'Data/hora obrigatória')
    .transform(v => new Date(v))
    .pipe(z.date()),
})

export const CompleteAppointmentSchema = z.object({
  clinicalNotes: z.string().max(10000).optional(),
  chargedAmount: z
    .union([z.number(), z.string()])
    .optional()
    .transform(v => (v === undefined || v === '' ? undefined : Number(v)))
    .pipe(z.number().nonnegative('Valor não pode ser negativo').optional()),
})

// Use z.input: the form supplies pre-parse data, where .default() fields are optional.
// (z.infer/z.output would mark defaulted fields as required, breaking the form callers.)
export type ProfessionalFormData = z.input<typeof ProfessionalSchema>
export type ServiceFormData = z.input<typeof ServiceSchema>
export type AppointmentFormData = z.input<typeof AppointmentSchema>
export type CompleteAppointmentFormData = z.input<typeof CompleteAppointmentSchema>
