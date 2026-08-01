/**
 * Assinatura digital XMLDSig dos documentos eletrónicos.
 *
 * Isto é o que dá valor legal ao documento. Até 2026-07-30 a função que dizia
 * assinar fazia `return xml` — abria o .p12, extraía a chave privada, deitava-a
 * fora e mandava o documento por assinar para a SET.
 *
 * O que a norma exige, e o que aqui está:
 *
 *   1. canonicalização exclusiva (C14N) do que vai ser assinado
 *   2. digest SHA-256 do resultado
 *   3. assinatura RSA-SHA256 do digest com a chave privada do certificado
 *   4. elemento Signature com SignedInfo, SignatureValue e o certificado
 *      público em KeyInfo/X509Data, para a SET poder verificar
 *
 * A referência aponta para o elemento `DE` pelo seu atributo `Id`, que é o CDC
 * (ver src/lib/cdc.ts). É por isso que o CDC tem de ser calculado ANTES de
 * assinar: a assinatura cobre um documento que já sabe quem é.
 *
 * A transformada `enveloped-signature` existe porque a assinatura vai ficar
 * dentro do próprio elemento que assina — sem ela, o verificador tentaria
 * validar um digest que inclui a assinatura, o que nunca fecha.
 *
 * HOMOLOGAÇÃO PENDENTE: a implementação segue a norma XMLDSig, mas não foi
 * confrontada com o ambiente de teste da SET. Antes de emitir para um cliente
 * real é preciso submeter um documento em homologação e confirmar que a
 * assinatura é aceite.
 */

import forge from "node-forge";
import { SignedXml } from "xml-crypto";

export class CertificadoInvalido extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "CertificadoInvalido";
  }
}

export type ChavesDoCertificado = {
  /** Chave privada em PEM. NUNCA registar em log nem gravar em disco. */
  chavePrivadaPem: string;
  /** Certificado público em PEM. */
  certificadoPem: string;
  /** O mesmo certificado em base64 DER, como vai dentro de X509Certificate. */
  certificadoBase64: string;
};

/**
 * Abre o .p12 e tira de lá a chave privada e o certificado.
 *
 * Tudo em memória: a chave privada não passa por disco nem por log. Um erro
 * aqui nunca inclui o conteúdo do certificado na mensagem — a palavra-passe
 * errada e um ficheiro corrompido dão a mesma mensagem genérica de propósito.
 */
export function abrirCertificado(p12Base64: string, senha: string): ChavesDoCertificado {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const der = forge.util.decode64(p12Base64);
    const asn1 = forge.asn1.fromDer(der);
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
  } catch {
    throw new CertificadoInvalido(
      "Não foi possível abrir o certificado digital. Verifique o arquivo e a senha."
    );
  }

  let chave: forge.pki.PrivateKey | null = null;
  let cert: forge.pki.Certificate | null = null;

  for (const conteudo of p12.safeContents) {
    for (const bag of conteudo.safeBags) {
      if (
        (bag.type === forge.pki.oids.pkcs8ShroudedKeyBag ||
          bag.type === forge.pki.oids.keyBag) &&
        bag.key
      ) {
        chave = bag.key;
      }
      if (bag.type === forge.pki.oids.certBag && bag.cert) {
        // Um .p12 traz muitas vezes a cadeia inteira. O certificado do titular
        // é o que tem par com a chave privada; na prática é o primeiro que traz
        // extensões de assinatura. Ficamos com o primeiro e, se aparecer um com
        // basicConstraints CA, esse é da autoridade e não serve.
        const ehCA = bag.cert.getExtension("basicConstraints") as any;
        if (!ehCA?.cA) cert = cert ?? bag.cert;
      }
    }
  }

  if (!chave || !cert) {
    throw new CertificadoInvalido(
      "O certificado digital não contém uma chave privada utilizável."
    );
  }

  const certificadoPem = forge.pki.certificateToPem(cert);

  return {
    chavePrivadaPem: forge.pki.privateKeyToPem(chave as forge.pki.rsa.PrivateKey),
    certificadoPem,
    certificadoBase64: certificadoPem
      .replace(/-----(BEGIN|END) CERTIFICATE-----/g, "")
      .replace(/\s+/g, ""),
  };
}

/** O certificado ainda é válido nesta data? */
export function certificadoVigente(p12Base64: string, senha: string, quando = new Date()): boolean {
  const der = forge.util.decode64(p12Base64);
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), senha);
  for (const conteudo of p12.safeContents) {
    for (const bag of conteudo.safeBags) {
      if (bag.type === forge.pki.oids.certBag && bag.cert) {
        const { notBefore, notAfter } = bag.cert.validity;
        return quando >= notBefore && quando <= notAfter;
      }
    }
  }
  return false;
}

/**
 * Assina o elemento identificado por `idElemento` dentro do XML.
 *
 * @param idElemento  o valor do atributo Id — para nós, o CDC.
 */
export function assinarXML(
  xml: string,
  idElemento: string,
  chaves: ChavesDoCertificado
): string {
  if (!idElemento) {
    throw new CertificadoInvalido(
      "Não é possível assinar um documento sem CDC: a assinatura tem de referenciar o documento."
    );
  }
  if (!xml.includes(`Id="${idElemento}"`)) {
    throw new CertificadoInvalido(
      `O documento não tem nenhum elemento com Id="${idElemento}" para assinar.`
    );
  }

  const sig = new SignedXml({
    privateKey: chaves.chavePrivadaPem,
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
  });

  sig.addReference({
    xpath: `//*[@Id='${idElemento}']`,
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    uri: `#${idElemento}`,
    isEmptyUri: false,
  });

  // O certificado público vai dentro da assinatura: sem ele, quem recebe não
  // tem com que verificar.
  sig.getKeyInfoContent = () =>
    `<X509Data><X509Certificate>${chaves.certificadoBase64}</X509Certificate></X509Data>`;

  // A assinatura fica DENTRO do elemento assinado, como manda o modelo
  // enveloped: é o documento que carrega a sua própria assinatura.
  sig.computeSignature(xml, {
    location: { reference: `//*[@Id='${idElemento}']`, action: "append" },
  });

  return sig.getSignedXml();
}

/**
 * Verifica uma assinatura. Usado nos testes e para diagnóstico.
 *
 * Confirma que o documento não foi alterado depois de assinado e que a
 * assinatura foi feita com a chave do certificado que vem dentro dela.
 */
export function verificarAssinatura(xmlAssinado: string, certificadoPem: string): boolean {
  const m = xmlAssinado.match(/<(?:\w+:)?Signature[\s\S]*?<\/(?:\w+:)?Signature>/);
  if (!m) return false;

  const sig = new SignedXml({ publicCert: certificadoPem });
  sig.loadSignature(m[0]);
  return sig.checkSignature(xmlAssinado);
}
