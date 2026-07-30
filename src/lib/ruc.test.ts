// Rodar: npm test
//
// Dígito verificador do RUC paraguaio (módulo 11).
//
// Antes desta auditoria qualquer texto era aceite como RUC. Um número com erro
// de digitação é rejeitado pela SET — e, no pior caso, corresponde a OUTRO
// contribuinte, pondo a contraparte errada num documento fiscal.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { digitoVerificador, validarRuc, formatarRuc } from './ruc.ts'

// ─── O algoritmo ────────────────────────────────────────────────────────────

test('calcula o dígito por módulo 11, da direita para a esquerda', () => {
  // 80012345: 5×2 + 4×3 + 3×4 + 2×5 + 1×6 + 0×7 + 0×2 + 8×3 = 74
  // 74 % 11 = 8 → 11 - 8 = 3
  assert.equal(digitoVerificador('80012345'), 3)
})

test('resto 0 ou 1 dá dígito 0', () => {
  // Propriedade do algoritmo: nunca produz 10 nem 11.
  for (let n = 1; n <= 500; n++) {
    const dv = digitoVerificador(String(n))!
    assert.ok(dv >= 0 && dv <= 9, `base ${n} deu dígito ${dv}`)
  }
})

test('um RUC construído com o próprio dígito é sempre válido', () => {
  // Verificação cruzada: gerar e validar têm de concordar.
  for (const base of ['1', '80', '4321', '1234567', '80012345', '12345678']) {
    const dv = digitoVerificador(base)!
    const r = validarRuc(`${base}-${dv}`)
    assert.equal(r.valido, true, `${base}-${dv} devia ser válido`)
  }
})

// ─── Validação ──────────────────────────────────────────────────────────────

test('recusa dígito verificador errado', () => {
  const r = validarRuc('80012345-1') // o correto é 3
  assert.equal(r.valido, false)
  assert.match(r.motivo!, /verificador/i)
  assert.match(r.motivo!, /3/, 'a mensagem deve dizer qual era o esperado')
})

test('aceita com e sem hífen, com pontos, com espaços', () => {
  for (const forma of ['80012345-3', '800123453', '80.012.345-3', ' 80012345-3 ']) {
    assert.equal(validarRuc(forma).valido, true, forma)
  }
})

test('devolve sempre a forma canónica para gravar', () => {
  assert.equal(formatarRuc('80.012.345-3'), '80012345-3')
  assert.equal(formatarRuc('800123453'), '80012345-3')
})

test('recusa vazio, nulo e texto', () => {
  for (const mau of ['', '   ', null, undefined, 'abc', '--']) {
    const r = validarRuc(mau as any)
    assert.equal(r.valido, false, String(mau))
  }
})

test('recusa comprimentos impossíveis', () => {
  assert.equal(validarRuc('1').valido, false)
  assert.equal(validarRuc('1234567890123').valido, false)
})

test('o RUC de demonstração 80012345-1 é inválido — e sempre foi', () => {
  // Fica registado: o tenant de demonstração usa um número que a SET
  // rejeitaria. Não é um bug, é um marcador de posição — mas convém que o
  // sistema o diga em vez de o aceitar em silêncio.
  assert.equal(validarRuc('80012345-1').valido, false)
})

test('formatarRuc devolve null em vez de lançar', () => {
  assert.equal(formatarRuc('inválido'), null)
  assert.equal(formatarRuc(null), null)
})

// ─── Integração com os schemas de cadastro ──────────────────────────────────

test('CustomerSchema recusa RUC com dígito errado', async () => {
  const { CustomerSchema } = await import('./schemas/index.ts')
  const r = CustomerSchema.safeParse({
    name: 'Ferretería del Sur', documentType: 'RUC', document: '80012345-1',
  })
  assert.equal(r.success, false)
  assert.match(r.error!.issues[0].message, /RUC inválido/)
})

test('CustomerSchema aceita RUC correto', async () => {
  const { CustomerSchema } = await import('./schemas/index.ts')
  const r = CustomerSchema.safeParse({
    name: 'Ferretería del Sur', documentType: 'RUC', document: '80012345-3',
  })
  assert.equal(r.success, true)
})

test('outros tipos de documento não passam pela regra do RUC', async () => {
  const { CustomerSchema } = await import('./schemas/index.ts')
  for (const tipo of ['CI', 'CPF', 'CNPJ', 'OTHER']) {
    const r = CustomerSchema.safeParse({ name: 'Juan Perez', documentType: tipo, document: '1234567' })
    assert.equal(r.success, true, tipo)
  }
})

test('sem documento não há nada a validar', async () => {
  const { CustomerSchema } = await import('./schemas/index.ts')
  assert.equal(CustomerSchema.safeParse({ name: 'Consumidor Final' }).success, true)
})
