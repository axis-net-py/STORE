// Rodar: npm test
//
// Esta função decide QUAL cliente serve cada pedido. Um erro aqui mostra os
// dados de um cliente a outro — a falha mais grave que este sistema pode ter.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolverHost, slugValido, slugDisponivel, slugDeNome, dominiosBase, SLUGS_RESERVADOS,
} from './tenant-host.ts'

const BASES = ['axisstore.com', 'axisfarm.com', 'localhost']

// ─── Resolução de host ──────────────────────────────────────────────────────

test('subdomínio identifica o cliente', () => {
  assert.deepEqual(resolverHost('smartbuy.axisstore.com', BASES), { tipo: 'tenant', slug: 'smartbuy' })
  assert.deepEqual(resolverHost('fazenda-sul.axisfarm.com', BASES), { tipo: 'tenant', slug: 'fazenda-sul' })
})

test('o domínio raiz não tem cliente', () => {
  assert.deepEqual(resolverHost('axisstore.com', BASES), { tipo: 'raiz' })
})

test('www é reservado, não é um cliente chamado www', () => {
  assert.deepEqual(resolverHost('www.axisstore.com', BASES), { tipo: 'reservado', nome: 'www' })
})

test('admin é reservado — é o painel, não um cliente', () => {
  assert.deepEqual(resolverHost('admin.axisstore.com', BASES), { tipo: 'reservado', nome: 'admin' })
})

test('host de deploy do Vercel é raiz, não um cliente', () => {
  // Sem isto, axisretail.vercel.app seria lido como o cliente "axisretail".
  assert.deepEqual(resolverHost('axisretail.vercel.app', BASES), { tipo: 'raiz' })
  assert.deepEqual(resolverHost('axisretail-abc123.vercel.app', BASES), { tipo: 'raiz' })
})

test('domínio não configurado nunca produz cliente', () => {
  assert.deepEqual(resolverHost('smartbuy.dominio-alheio.com', BASES), { tipo: 'raiz' })
})

test('a porta é ignorada — desenvolvimento local funciona', () => {
  assert.deepEqual(resolverHost('smartbuy.localhost:3000', BASES), { tipo: 'tenant', slug: 'smartbuy' })
  assert.deepEqual(resolverHost('localhost:3000', BASES), { tipo: 'raiz' })
})

test('maiúsculas não criam clientes diferentes', () => {
  assert.deepEqual(resolverHost('SmartBuy.AxisStore.com', BASES), { tipo: 'tenant', slug: 'smartbuy' })
})

test('só o primeiro nível conta', () => {
  // "a.b.axisstore.com" não é o cliente "a.b" nem o cliente "b".
  assert.deepEqual(resolverHost('a.b.axisstore.com', BASES), { tipo: 'raiz' })
})

test('host ausente ou vazio não rebenta', () => {
  for (const h of [null, undefined, '', '   ', ':3000']) {
    assert.deepEqual(resolverHost(h as any, BASES), { tipo: 'raiz' }, String(h))
  }
})

test('prefixo com formato inválido não vira cliente', () => {
  for (const h of ['-mau.axisstore.com', 'mau-.axisstore.com', 'ma_u.axisstore.com']) {
    assert.deepEqual(resolverHost(h, BASES), { tipo: 'raiz' }, h)
  }
})

// ─── Slugs ──────────────────────────────────────────────────────────────────

test('slugs reservados não são vendáveis', () => {
  for (const r of ['www', 'api', 'app', 'admin', 'login']) {
    assert.ok(SLUGS_RESERVADOS.has(r), r)
    assert.equal(slugDisponivel(r), false, r)
  }
})

test('formato de slug: minúsculas, dígitos e hífen interno', () => {
  for (const bom of ['smartbuy', 'smart-buy', 'loja123', 'a1']) {
    assert.equal(slugValido(bom), true, bom)
  }
  for (const mau of ['Smart', 'smart_buy', '-smart', 'smart-', 'a', 'smart--buy', 'com ponto.com']) {
    assert.equal(slugValido(mau), false, mau)
  }
})

test('slug derivado do nome do cliente', () => {
  assert.equal(slugDeNome('Smart Buy'), 'smart-buy')
  assert.equal(slugDeNome('Ferretería del Sur'), 'ferreteria-del-sur')
  assert.equal(slugDeNome('AXIS Comércio Geral S.A.'), 'axis-comercio-geral-s-a')
  assert.equal(slugDeNome('  espaços  a  mais  '), 'espacos-a-mais')
})

test('slug derivado é sempre válido como slug', () => {
  for (const nome of ['Smart Buy', 'Ferretería del Sur', 'Cliente 123', 'Ação & Cia']) {
    const s = slugDeNome(nome)
    assert.equal(slugValido(s), true, `${nome} → ${s}`)
  }
})

// ─── Configuração ───────────────────────────────────────────────────────────

test('domínios base vêm do ambiente, com localhost por omissão', () => {
  assert.deepEqual(dominiosBase('axisstore.com, axisfarm.com'), ['axisstore.com', 'axisfarm.com'])
  assert.deepEqual(dominiosBase(undefined), ['localhost'])
  assert.deepEqual(dominiosBase(''), ['localhost'])
})
