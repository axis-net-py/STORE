// Rodar: npm test
//
// O repositório FARM nunca teve validação de input: 0 de 15 ficheiros de
// actions. Estes testes fixam o que os schemas passam a rejeitar.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  HarvestSchema, HarvestPartialSchema, PlotSchema, SoilAnalysisSchema,
  SiloMovementSchema, ContractSchema, LivestockEventSchema, VehicleLogSchema,
  CertificationSchema, EmployeeSchema,
} from './schemas.ts'

test('safra: aceita dados válidos', () => {
  const r = HarvestSchema.safeParse({
    name: 'Soja 2026', cropType: 'Soja',
    startDate: '2026-09-01', endDate: '2027-02-28',
  })
  assert.equal(r.success, true)
})

test('safra: recusa fim anterior ao início', () => {
  const r = HarvestSchema.safeParse({
    name: 'Soja 2026', cropType: 'Soja',
    startDate: '2027-02-28', endDate: '2026-09-01',
  })
  assert.equal(r.success, false)
  assert.match(r.error!.issues[0].message, /anterior/)
})

test('safra: nome demasiado curto é recusado', () => {
  const r = HarvestSchema.safeParse({
    name: 'S', cropType: 'Soja', startDate: '2026-09-01', endDate: '2027-02-28',
  })
  assert.equal(r.success, false)
})

test('safra parcial: aceita só um campo, para atualização', () => {
  assert.equal(HarvestPartialSchema.safeParse({ cropType: 'Milho' }).success, true)
  assert.equal(HarvestPartialSchema.safeParse({}).success, true)
})

test('talhão: área tem de ser positiva', () => {
  assert.equal(PlotSchema.safeParse({ name: 'Talhão A', area: 12.5 }).success, true)
  assert.equal(PlotSchema.safeParse({ name: 'Talhão A', area: 0 }).success, false)
  assert.equal(PlotSchema.safeParse({ name: 'Talhão A', area: -3 }).success, false)
})

test('talhão: unidade fora da lista é recusada', () => {
  assert.equal(PlotSchema.safeParse({ name: 'Talhão A', area: 1, unit: 'HECTARE' }).success, true)
  assert.equal(PlotSchema.safeParse({ name: 'Talhão A', area: 1, unit: 'ALQUEIRE' }).success, true)
  assert.equal(PlotSchema.safeParse({ name: 'Talhão A', area: 1, unit: 'ACRE' }).success, false)
})

test('números chegam como texto do formulário e são convertidos', () => {
  const r = PlotSchema.safeParse({ name: 'Talhão A', area: '12.5' })
  assert.equal(r.success, true)
  assert.equal(r.data!.area, 12.5)
  assert.equal(typeof r.data!.area, 'number')
})

test('análise de solo: pH fora da escala 0-14 é erro de digitação', () => {
  const base = { plotId: 'p1', date: '2026-07-01' }
  assert.equal(SoilAnalysisSchema.safeParse({ ...base, ph: 6.5 }).success, true)
  assert.equal(SoilAnalysisSchema.safeParse({ ...base, ph: 65 }).success, false)
  assert.equal(SoilAnalysisSchema.safeParse({ ...base, ph: -1 }).success, false)
})

test('análise de solo: talhão é obrigatório', () => {
  assert.equal(SoilAnalysisSchema.safeParse({ plotId: '', date: '2026-07-01' }).success, false)
})

test('movimento de silo: humidade não passa de 100%', () => {
  const base = { siloId: 's1', type: 'IN', quantity: 10, date: '2026-07-01' }
  assert.equal(SiloMovementSchema.safeParse({ ...base, moisture: 14 }).success, true)
  assert.equal(SiloMovementSchema.safeParse({ ...base, moisture: 140 }).success, false)
})

test('movimento de silo: tipo tem de ser IN ou OUT', () => {
  const base = { siloId: 's1', quantity: 10, date: '2026-07-01' }
  assert.equal(SiloMovementSchema.safeParse({ ...base, type: 'OUT' }).success, true)
  assert.equal(SiloMovementSchema.safeParse({ ...base, type: 'ENTRADA' }).success, false)
})

test('contrato: quantidade positiva, preço não negativo', () => {
  const base = { contractNumber: 'C-1', siloName: 'Silo 1', grainType: 'Soja' }
  assert.equal(ContractSchema.safeParse({ ...base, quantity: 100, pricePerUnit: 0 }).success, true)
  assert.equal(ContractSchema.safeParse({ ...base, quantity: 0, pricePerUnit: 10 }).success, false)
  assert.equal(ContractSchema.safeParse({ ...base, quantity: 100, pricePerUnit: -1 }).success, false)
})

test('evento de rebanho: tipo restrito aos do enum', () => {
  const base = { batchId: 'b1', date: '2026-07-01' }
  for (const t of ['WEIGHING', 'HEALTH', 'MOVEMENT']) {
    assert.equal(LivestockEventSchema.safeParse({ ...base, type: t }).success, true, t)
  }
  assert.equal(LivestockEventSchema.safeParse({ ...base, type: 'PESAGEM' }).success, false)
})

test('registo de veículo: custos não podem ser negativos', () => {
  const base = { vehicleId: 'v1', type: 'FUEL', date: '2026-07-01' }
  assert.equal(VehicleLogSchema.safeParse({ ...base, fuelCost: 250000 }).success, true)
  assert.equal(VehicleLogSchema.safeParse({ ...base, fuelCost: -5 }).success, false)
  assert.equal(VehicleLogSchema.safeParse({ ...base, maintenanceCost: -1 }).success, false)
})

test('certificação: validade não pode preceder a emissão', () => {
  assert.equal(CertificationSchema.safeParse({
    name: 'Orgânico', issueDate: '2026-01-01', expiryDate: '2027-01-01',
  }).success, true)
  assert.equal(CertificationSchema.safeParse({
    name: 'Orgânico', issueDate: '2027-01-01', expiryDate: '2026-01-01',
  }).success, false)
})

test('certificação: sem datas continua válida', () => {
  assert.equal(CertificationSchema.safeParse({ name: 'Orgânico' }).success, true)
})

test('funcionário: estado fora da lista é recusado', () => {
  assert.equal(EmployeeSchema.safeParse({ name: 'Ana Rodríguez', role: 'Tratorista', status: 'ACTIVE' }).success, true)
  assert.equal(EmployeeSchema.safeParse({ name: 'Ana Rodríguez', role: 'Tratorista', status: 'FERIAS' }).success, false)
})

test('texto excessivo é recusado — protege a base de dados', () => {
  const enorme = 'x'.repeat(5000)
  assert.equal(EmployeeSchema.safeParse({ name: enorme, role: 'Tratorista' }).success, false)
  assert.equal(SoilAnalysisSchema.safeParse({
    plotId: 'p1', date: '2026-07-01', notes: enorme,
  }).success, false)
})
