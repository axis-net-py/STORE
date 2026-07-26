import { z } from 'zod'

/**
 * Schemas de validação do módulo farm.
 *
 * O repositório FARM nunca teve lib/schemas: 0 de 15 ficheiros de actions
 * validavam input (Projeto 1, Fase 4). Estes schemas fecham essa dívida,
 * seguindo o estilo do núcleo em src/lib/schemas/index.ts.
 *
 * Convenções herdadas do núcleo:
 * - números aceitam string ou number, porque os formulários enviam texto;
 * - datas aceitam Date ou string ISO, pela mesma razão;
 * - mensagens de erro em português, viradas para o utilizador final.
 */

/** Número vindo de formulário: aceita texto, valida depois de converter. */
const numero = (msg = 'Valor inválido') =>
  z.union([z.number(), z.string()]).transform((v) => Number(v)).pipe(z.number({ message: msg }))

const numeroPositivo = (campo: string) =>
  numero(`${campo} inválido`).pipe(z.number().positive(`${campo} tem de ser maior que zero`))

const numeroNaoNegativo = (campo: string) =>
  numero(`${campo} inválido`).pipe(z.number().nonnegative(`${campo} não pode ser negativo`))

/** Data vinda de formulário: aceita Date ou string ISO. */
const data = (msg = 'Data inválida') =>
  z.union([z.date(), z.string()]).transform((v) => new Date(v)).pipe(z.date({ message: msg }))

const texto = (max: number) => z.string().max(max).optional()
const id = (campo: string) => z.string().min(1, `${campo} é obrigatório`)

// ─── Safras e talhões ───────────────────────────────────────────────────────

// Base separada da regra cruzada: `.refine()` devolve um ZodEffects, que não
// suporta `.partial()` — e as funções de atualização recebem dados parciais.
const HarvestBase = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  cropType: z.string().min(1, 'Cultura é obrigatória').max(100),
  startDate: data('Data de início inválida'),
  endDate: data('Data de fim inválida'),
  status: z.enum(['PLANNED', 'ACTIVE', 'HARVESTED', 'CLOSED']).optional(),
})

export const HarvestSchema = HarvestBase.refine((d) => d.endDate >= d.startDate, {
  message: 'A data de fim não pode ser anterior à de início',
  path: ['endDate'],
})

export const PlotSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  area: numeroPositivo('Área'),
  unit: z.enum(['HECTARE', 'ALQUEIRE']).optional(),
  currentCrop: texto(100),
  status: z.enum(['FALLOW', 'PLANTED', 'PREPARING']).optional(),
  harvestId: z.string().optional(),
})

export const SoilAnalysisSchema = z.object({
  plotId: id('Talhão'),
  date: data(),
  // pH tem escala fixa: fora de 0-14 é erro de digitação, não um solo exótico.
  ph: numero('pH inválido').pipe(z.number().min(0, 'pH mínimo é 0').max(14, 'pH máximo é 14')).optional(),
  phosphorus: numeroNaoNegativo('Fósforo').optional(),
  potassium: numeroNaoNegativo('Potássio').optional(),
  organicMatter: numeroNaoNegativo('Matéria orgânica').optional(),
  recommendation: texto(2000),
  notes: texto(2000),
})

export const PlotApplicationSchema = z.object({
  plotId: id('Talhão'),
  productId: id('Produto'),
  quantity: numeroPositivo('Quantidade'),
  date: data(),
  employeeId: z.string().optional(),
  notes: texto(2000),
})

export const IrrigationEventSchema = z.object({
  plotId: id('Talhão'),
  date: data(),
  method: texto(100),
  durationHours: numeroNaoNegativo('Duração').optional(),
  flowRate: numeroNaoNegativo('Vazão').optional(),
  volumeApplied: numeroNaoNegativo('Volume aplicado').optional(),
  employeeId: z.string().optional(),
  notes: texto(2000),
})

// ─── Silos e contratos ──────────────────────────────────────────────────────

export const SiloSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  capacity: numeroPositivo('Capacidade'),
  unit: z.enum(['TON', 'BAG', 'KG']).optional(),
})

export const SiloMovementSchema = z.object({
  siloId: id('Silo'),
  type: z.enum(['IN', 'OUT'], { message: 'Tipo de movimento inválido' }),
  quantity: numeroPositivo('Quantidade'),
  date: data(),
  harvestId: z.string().optional(),
  contractId: z.string().optional(),
  // Humidade do grão em percentagem.
  moisture: numero('Humidade inválida').pipe(z.number().min(0).max(100, 'Humidade máxima é 100%')).optional(),
  qualityGrade: texto(50),
  notes: texto(2000),
})

export const ContractSchema = z.object({
  contractNumber: z.string().min(1, 'Número do contrato é obrigatório').max(100),
  siloName: z.string().min(1, 'Silo é obrigatório').max(200),
  grainType: z.string().min(1, 'Tipo de grão é obrigatório').max(100),
  quantity: numeroPositivo('Quantidade'),
  unit: z.enum(['TON', 'BAG', 'KG']).optional(),
  pricePerUnit: numeroNaoNegativo('Preço por unidade'),
  currency: z.enum(['USD', 'PYG', 'BRL']).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  deliveryDate: data().nullish(),
  notes: texto(2000).nullable(),
  harvestId: z.string().nullish(),
})

// ─── Rebanho ────────────────────────────────────────────────────────────────

export const LivestockBatchSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  category: z.string().min(1, 'Categoria é obrigatória').max(100),
  quantity: numeroNaoNegativo('Quantidade'),
  averageWeight: numeroNaoNegativo('Peso médio').optional(),
  location: texto(200),
  status: z.enum(['ACTIVE', 'SOLD']).optional(),
})

export const LivestockEventSchema = z.object({
  batchId: id('Lote'),
  type: z.enum(['WEIGHING', 'HEALTH', 'MOVEMENT'], { message: 'Tipo de evento inválido' }),
  date: data(),
  weight: numeroNaoNegativo('Peso').optional(),
  location: texto(200),
  description: texto(2000),
  employeeId: z.string().optional(),
  notes: texto(2000),
})

// ─── Frota, funcionários e certificações ────────────────────────────────────

export const VehicleSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  type: z.string().min(1, 'Tipo é obrigatório').max(100),
  plate: texto(20),
  status: z.enum(['OPERATIONAL', 'MAINTENANCE', 'OUT_OF_SERVICE']).optional(),
})

export const VehicleLogSchema = z.object({
  vehicleId: id('Veículo'),
  type: z.enum(['MAINTENANCE', 'FUEL'], { message: 'Tipo de registo inválido' }),
  date: data(),
  odometerOrHours: numeroNaoNegativo('Odómetro/horas').optional(),
  employeeId: z.string().optional(),
  notes: texto(2000),
  liters: numeroNaoNegativo('Litros').optional(),
  fuelCost: numeroNaoNegativo('Custo de combustível').optional(),
  description: texto(2000),
  maintenanceCost: numeroNaoNegativo('Custo de manutenção').optional(),
})

export const EmployeeSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  role: z.string().min(1, 'Função é obrigatória').max(100),
  phone: texto(30),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LEAVE']).optional(),
})

const CertificationBase = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  issuingBody: texto(200),
  certificateNumber: texto(100),
  issueDate: data('Data de emissão inválida').optional(),
  expiryDate: data('Data de validade inválida').optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'PENDING']).optional(),
  scope: texto(500),
  notes: texto(2000),
})

export const CertificationSchema = CertificationBase.refine(
  (d) => !d.issueDate || !d.expiryDate || d.expiryDate >= d.issueDate,
  { message: 'A validade não pode ser anterior à emissão', path: ['expiryDate'] }
)

// ─── Versões parciais, para as funções de atualização ───────────────────────
//
// `update*` recebe Partial<FormData>: valida o que vem, não exige o resto.

export const HarvestPartialSchema = HarvestBase.partial()
export const CertificationPartialSchema = CertificationBase.partial()
export const PlotPartialSchema = PlotSchema.partial()
export const SoilAnalysisPartialSchema = SoilAnalysisSchema.partial()
export const PlotApplicationPartialSchema = PlotApplicationSchema.partial()
export const IrrigationEventPartialSchema = IrrigationEventSchema.partial()
export const SiloPartialSchema = SiloSchema.partial()
export const SiloMovementPartialSchema = SiloMovementSchema.partial()
export const ContractPartialSchema = ContractSchema.partial()
export const LivestockBatchPartialSchema = LivestockBatchSchema.partial()
export const LivestockEventPartialSchema = LivestockEventSchema.partial()
export const VehiclePartialSchema = VehicleSchema.partial()
export const VehicleLogPartialSchema = VehicleLogSchema.partial()
export const EmployeePartialSchema = EmployeeSchema.partial()
