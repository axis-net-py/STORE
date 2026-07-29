// Rodar: npm test
//
// O token de configuração é a ÚNICA autorização de quem ainda não tem sessão.
// Estes testes cobrem a parte pura: derivação de slug e hash do token.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { hashToken, VALIDADE_TOKEN_HORAS, gerarToken, expiraEm } from './setup-token.ts'
import { slugDeNome, slugDisponivel } from './tenant-host.ts'

test('o hash do token é SHA-256 do valor em claro', () => {
  const token = 'um-token-qualquer'
  const esperado = createHash('sha256').update(token).digest('hex')
  assert.equal(hashToken(token), esperado)
})

test('o hash não permite recuperar o token', () => {
  const token = 'segredo-do-cliente'
  const h = hashToken(token)
  assert.ok(!h.includes(token))
  assert.equal(h.length, 64, 'SHA-256 em hex tem 64 caracteres')
})

test('tokens diferentes dão hashes diferentes', () => {
  assert.notEqual(hashToken('a'), hashToken('b'))
})

test('o mesmo token dá sempre o mesmo hash — é procurável na base', () => {
  assert.equal(hashToken('estável'), hashToken('estável'))
})

test('cada token gerado é diferente e suficientemente longo', () => {
  const tokens = new Set(Array.from({ length: 200 }, () => gerarToken()))
  assert.equal(tokens.size, 200, 'não pode haver repetições')
  for (const t of tokens) {
    // 32 bytes em base64url dão 43 caracteres: espaço de busca inviável.
    assert.ok(t.length >= 40, `token curto: ${t}`)
    assert.match(t, /^[A-Za-z0-9_-]+$/, 'tem de ser seguro num URL')
  }
})

test('a expiração é calculada a partir do momento dado', () => {
  const agora = new Date('2026-07-28T10:00:00Z')
  const e = expiraEm(agora)
  assert.equal(e.getTime() - agora.getTime(), VALIDADE_TOKEN_HORAS * 3_600_000)
  assert.ok(e > agora)
})

test('a validade do link é de dias, não de minutos nem de meses', () => {
  // 72 horas: tempo para o cliente abrir o email/mensagem sem que o link
  // fique válido indefinidamente.
  assert.equal(VALIDADE_TOKEN_HORAS, 72)
  assert.ok(VALIDADE_TOKEN_HORAS >= 24 && VALIDADE_TOKEN_HORAS <= 168)
})

// ─── Slug do cliente ────────────────────────────────────────────────────────

test('nomes reais de clientes produzem slugs utilizáveis', () => {
  const casos: Array<[string, string]> = [
    ['Smart Buy', 'smart-buy'],
    ['Ferretería del Sur', 'ferreteria-del-sur'],
    ['Estancia São João', 'estancia-sao-joao'],
    ['Clínica Santa María', 'clinica-santa-maria'],
  ]
  for (const [nome, esperado] of casos) {
    assert.equal(slugDeNome(nome), esperado, nome)
    assert.equal(slugDisponivel(slugDeNome(nome)), true, nome)
  }
})

test('um nome que derive para slug reservado não fica disponível', () => {
  // "Admin" viraria "admin", que é subdomínio do sistema.
  assert.equal(slugDeNome('Admin'), 'admin')
  assert.equal(slugDisponivel('admin'), false)
})
