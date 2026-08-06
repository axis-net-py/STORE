import { test } from 'node:test'
import assert from 'node:assert/strict'
import { alertasDoDia, resumoSemModelo, chaveDoDia } from './briefing.ts'

test('dia sem nada a assinalar não inventa alertas', () => {
  assert.deepEqual(alertasDoDia({}), [])
  assert.match(resumoSemModelo([]), /Nada a assinalar/)
})

test('o crítico vem antes do que é só informativo', () => {
  const as = alertasDoDia({
    vendasOntem: 500000,
    recebimentosVencidos: { quantidade: 2, total: 1_200_000 },
    estoqueAbaixoMinimo: { quantidade: 1, exemplos: ['Teclado'] },
  })
  assert.deepEqual(as.map((a) => a.gravidade), ['critico', 'atencao', 'informativo'])
})

test('certificado expirado é crítico e diz há quantos dias', () => {
  const [a] = alertasDoDia({ diasCertificado: -3 })
  assert.equal(a.tipo, 'certificado-expirado')
  assert.equal(a.gravidade, 'critico')
  assert.match(a.texto, /há 3 dias/)
})

test('certificado a expirar sobe de atenção para crítico na última semana', () => {
  assert.equal(alertasDoDia({ diasCertificado: 20 })[0].gravidade, 'atencao')
  assert.equal(alertasDoDia({ diasCertificado: 5 })[0].gravidade, 'critico')
  // Fora da janela de 30 dias não gera linha nenhuma.
  assert.deepEqual(alertasDoDia({ diasCertificado: 90 }), [])
})

test('sem certificado ganha ao aviso de expiração, e não se repetem', () => {
  const as = alertasDoDia({ semCertificado: true, diasCertificado: 10 })
  assert.equal(as.length, 1)
  assert.equal(as[0].tipo, 'certificado-ausente')
})

test('singular e plural são tratados', () => {
  assert.match(alertasDoDia({ recebimentosVencidos: { quantidade: 1, total: 100 } })[0].texto, /1 fatura vencida/)
  assert.match(alertasDoDia({ recebimentosVencidos: { quantidade: 4, total: 100 } })[0].texto, /4 faturas vencidas/)
  assert.match(alertasDoDia({ consultasHoje: 1 })[0].texto, /1 consulta marcada/)
  assert.match(alertasDoDia({ consultasHoje: 9 })[0].texto, /9 consultas marcadas/)
})

test('valores saem formatados como guarani, sem casas decimais', () => {
  const [a] = alertasDoDia({ recebimentosVencidos: { quantidade: 1, total: 1234567.89 } })
  assert.match(a.texto, /1\.234\.568 Gs/)
})

test('o estoque baixo nomeia exemplos e indica que há mais', () => {
  const [a] = alertasDoDia({
    estoqueAbaixoMinimo: { quantidade: 7, exemplos: ['Cabo', 'Mouse', 'SSD', 'Fone'] },
  })
  assert.match(a.texto, /Cabo, Mouse, SSD/)
  assert.doesNotMatch(a.texto, /Fone/)   // só os três primeiros
  assert.match(a.texto, /e outros/)
})

test('zero não gera alerta em nenhum dos contadores', () => {
  assert.deepEqual(alertasDoDia({
    recebimentosVencidos: { quantidade: 0, total: 0 },
    vencemHoje: { quantidade: 0, total: 0 },
    estoqueAbaixoMinimo: { quantidade: 0, exemplos: [] },
    consultasHoje: 0,
    vendasOntem: 0,
  }), [])
})

test('o resumo de recurso conta os críticos', () => {
  const as = alertasDoDia({
    semCertificado: true,
    recebimentosVencidos: { quantidade: 1, total: 10 },
  })
  assert.match(resumoSemModelo(as), /2 pontos críticos/)
})

test('a chave do dia usa o fuso do Paraguai, não o do servidor', () => {
  // O Paraguai está em UTC-3 o ano inteiro desde que aboliu o horário de
  // verão, por isso a viragem do dia dá-se às 03:00 UTC. Às 02:00 UTC ainda
  // é a véspera em Assunção — e um briefing carimbado com o dia do servidor
  // apareceria repetido de madrugada, ou saltaria um dia.
  assert.equal(chaveDoDia(new Date('2026-08-02T02:00:00Z')), '2026-08-01')
  assert.equal(chaveDoDia(new Date('2026-08-02T03:00:00Z')), '2026-08-02')
  assert.equal(chaveDoDia(new Date('2026-08-02T12:00:00Z')), '2026-08-02')
})
