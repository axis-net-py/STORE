import { createHash, randomBytes } from "crypto";

/**
 * Primitivas do token de configuração de password.
 *
 * Módulo sem dependências de propósito: gerar e verificar um token não precisa
 * de base de dados, e assim pode ser testado isoladamente.
 */

/** 72 horas: tempo para o cliente abrir a mensagem, sem ficar válido para sempre. */
export const VALIDADE_TOKEN_HORAS = 72;

/** Token em claro. Existe uma só vez; na base guarda-se apenas o hash. */
export function gerarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function expiraEm(agora = new Date()): Date {
  return new Date(agora.getTime() + VALIDADE_TOKEN_HORAS * 3_600_000);
}
