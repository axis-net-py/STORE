import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import forge from 'node-forge'
import {
  abrirCertificado,
  assinarXML,
  verificarAssinatura,
  certificadoVigente,
  CertificadoInvalido,
  type ChavesDoCertificado,
} from './assinatura.ts'

/**
 * Gera um .p12 auto-assinado para os testes.
 *
 * Um certificado a sério da SET não pode viver no repositório, e não é preciso:
 * o que se testa aqui é a MECÂNICA da assinatura — canonicalização, digest,
 * assinatura RSA e verificação. Isso é igual com qualquer certificado.
 *
 * O que este teste NÃO cobre é a aceitação pela SET. Isso só se sabe em
 * homologação.
 */
function gerarP12(senha: string): string {
  const par = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = par.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date('2026-01-01')
  cert.validity.notAfter = new Date('2027-01-01')

  const attrs = [{ name: 'commonName', value: 'AXIS TESTE' }]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.sign(par.privateKey, forge.md.sha256.create())

  const p12 = forge.pkcs12.toPkcs12Asn1(par.privateKey, [cert], senha, {
    algorithm: '3des',
  })
  return forge.util.encode64(forge.asn1.toDer(p12).getBytes())
}

const SENHA = 'segredo-de-teste'
let p12Base64: string
let chaves: ChavesDoCertificado

const CDC = '01800123456001001000004222026073011234567891'

function xmlDe(cdc = CDC): string {
  return (
    `<rDE xmlns="http://ekuatia.set.gov.py/sifen/xsd">` +
    `<DE Id="${cdc}">` +
    `<gOpeDE><iTipDE>1</iTipDE></gOpeDE>` +
    `<gTotSub><dTotOpe>1100000</dTotOpe></gTotSub>` +
    `</DE>` +
    `</rDE>`
  )
}

before(() => {
  p12Base64 = gerarP12(SENHA)
  chaves = abrirCertificado(p12Base64, SENHA)
})

// ─── Abrir o certificado ────────────────────────────────────

test('extrai a chave privada e o certificado do .p12', () => {
  assert.match(chaves.chavePrivadaPem, /^-----BEGIN (RSA )?PRIVATE KEY-----/)
  assert.match(chaves.certificadoPem, /^-----BEGIN CERTIFICATE-----/)
  assert.match(chaves.certificadoBase64, /^[A-Za-z0-9+/=]+$/)
})

test('senha errada dá uma mensagem que não distingue senha de ficheiro corrompido', () => {
  // Distinguir os dois casos diria a quem tenta adivinhar se a senha é o que
  // falta ou não.
  assert.throws(() => abrirCertificado(p12Base64, 'errada'), CertificadoInvalido)
  assert.throws(() => abrirCertificado('não é um p12', SENHA), CertificadoInvalido)
})

test('a mensagem de erro não inclui o conteúdo do certificado', () => {
  try {
    abrirCertificado(p12Base64, 'errada')
    assert.fail('devia ter lançado')
  } catch (e) {
    assert.ok(!(e as Error).message.includes(p12Base64.slice(0, 40)))
  }
})

test('reconhece a vigência do certificado', () => {
  assert.ok(certificadoVigente(p12Base64, SENHA, new Date('2026-06-01')))
  assert.ok(!certificadoVigente(p12Base64, SENHA, new Date('2028-01-01')))
})

// ─── Assinar ────────────────────────────────────────────────

test('o documento assinado contém uma assinatura', () => {
  const assinado = assinarXML(xmlDe(), CDC, chaves)
  assert.match(assinado, /<(\w+:)?Signature/)
  assert.match(assinado, /SignatureValue/)
})

test('a assinatura usa SHA-256, não SHA-1', () => {
  const assinado = assinarXML(xmlDe(), CDC, chaves)
  assert.match(assinado, /xmldsig-more#rsa-sha256/)
  assert.match(assinado, /xmlenc#sha256/)
  assert.ok(!/rsa-sha1/.test(assinado), 'SHA-1 não é aceite para documentos fiscais')
})

test('a assinatura usa canonicalização exclusiva', () => {
  assert.match(assinarXML(xmlDe(), CDC, chaves), /xml-exc-c14n/)
})

test('a assinatura referencia o documento pelo CDC', () => {
  const assinado = assinarXML(xmlDe(), CDC, chaves)
  assert.match(assinado, new RegExp(`URI="#${CDC}"`))
})

test('o certificado público vai dentro da assinatura, para a SET poder verificar', () => {
  const assinado = assinarXML(xmlDe(), CDC, chaves)
  assert.match(assinado, /X509Certificate/)
  assert.ok(assinado.includes(chaves.certificadoBase64))
})

// ─── Verificar ──────────────────────────────────────────────

test('a assinatura produzida verifica', () => {
  const assinado = assinarXML(xmlDe(), CDC, chaves)
  assert.ok(verificarAssinatura(assinado, chaves.certificadoPem))
})

test('alterar o valor de um documento assinado invalida a assinatura', () => {
  // É isto que a assinatura serve para impedir: mudar o total depois de a SET
  // ter recebido o documento.
  const assinado = assinarXML(xmlDe(), CDC, chaves)
  const adulterado = assinado.replace('1100000', '1000')
  assert.ok(!verificarAssinatura(adulterado, chaves.certificadoPem))
})

test('um documento sem assinatura não passa na verificação', () => {
  assert.ok(!verificarAssinatura(xmlDe(), chaves.certificadoPem))
})

// ─── O que tem de recusar ───────────────────────────────────

test('recusa assinar sem CDC', () => {
  assert.throws(() => assinarXML(xmlDe(), '', chaves), CertificadoInvalido)
})

test('recusa assinar quando o Id não existe no documento', () => {
  assert.throws(() => assinarXML(xmlDe(), '99999999999999999999999999999999999999999999', chaves), {
    name: 'CertificadoInvalido',
    message: /não tem nenhum elemento com Id/,
  })
})
