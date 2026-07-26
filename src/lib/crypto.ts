import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

/**
 * Cifra de segredos guardados na base de dados.
 *
 * AES-256-GCM (spec Projeto 2, §6.3). GCM por ser autenticado: se alguém
 * alterar o texto cifrado na base, a decifra FALHA em vez de devolver lixo
 * silenciosamente. Num certificado fiscal, lixo silencioso seria pior.
 *
 * A chave vive apenas em variável de ambiente, nunca em base de dados. É isso
 * que dá sentido ao esquema: comprometer a base rende texto cifrado inútil,
 * porque a chave nunca esteve lá.
 */

const ALGO = "aes-256-gcm";

/**
 * Deriva 32 bytes a partir da variável de ambiente.
 *
 * Aceita a chave em base64/hex de 32 bytes ou uma frase-passe; em qualquer
 * caso passa por SHA-256, o que garante o comprimento exato que o AES-256
 * exige sem impor um formato ao operador.
 */
function chave(nomeVar: string): Buffer {
  const bruta = process.env[nomeVar];
  if (!bruta) {
    throw new Error(
      `${nomeVar} em falta: não é possível cifrar nem decifrar segredos. ` +
        `Defina-a no ambiente (nunca na base de dados).`
    );
  }
  if (bruta.length < 16) {
    throw new Error(`${nomeVar} demasiado curta: use pelo menos 16 caracteres.`);
  }
  return createHash("sha256").update(bruta).digest();
}

export type Cifrado = {
  /** Texto cifrado, em base64. */
  cipher: string;
  /** Vetor de inicialização, em base64. Único por operação. */
  iv: string;
  /** Etiqueta de autenticação do GCM, em base64. */
  tag: string;
};

export function cifrar(texto: string, nomeVar: string): Cifrado {
  // IV novo a cada cifragem: reutilizá-lo em GCM quebra a confidencialidade.
  const iv = randomBytes(12);
  const c = createCipheriv(ALGO, chave(nomeVar), iv);
  const cipher = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return {
    cipher: cipher.toString("base64"),
    iv: iv.toString("base64"),
    tag: c.getAuthTag().toString("base64"),
  };
}

export function decifrar(c: Cifrado, nomeVar: string): string {
  const d = createDecipheriv(ALGO, chave(nomeVar), Buffer.from(c.iv, "base64"));
  d.setAuthTag(Buffer.from(c.tag, "base64"));
  // Se o texto cifrado ou a etiqueta tiverem sido alterados, isto lança.
  return Buffer.concat([d.update(Buffer.from(c.cipher, "base64")), d.final()]).toString("utf8");
}

/**
 * Chaves em uso, separadas de propósito (spec §6.3): comprometer o registo de
 * clientes não dá acesso aos certificados fiscais, e vice-versa.
 */
export const CHAVE_LIGACOES = "CONNECTION_SECRET_KEY";
export const CHAVE_TENANT = "TENANT_SECRET_KEY";
