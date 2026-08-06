/**
 * Limites de uso do assistente.
 *
 * Módulo puro, sem dependências: é política e tem de poder ser testada sem
 * rede nem base de dados.
 *
 * O `/api/ai` chama um modelo pago a cada pedido e aceita um ficheiro em
 * base64 no corpo. Até aqui não tinha limite nenhum: qualquer sessão válida
 * — ou uma cookie roubada — podia emitir pedidos em cadeia e a fatura era
 * nossa. O login já era protegido contra força bruta; o endereço que custa
 * dinheiro não era.
 *
 * Dois tetos, por razões diferentes:
 *
 * - **Pedidos por janela**: trava o abuso e os enganos (um botão em ciclo,
 *   um script de teste esquecido a correr).
 * - **Tamanho do anexo**: uma fotografia de fatura ronda 1–4 MB; 10 MB é
 *   folgado para o caso legítimo e continua a recusar quem tenta empurrar um
 *   vídeo. Vale a pena recusar cedo, antes de gastar a chamada ao modelo.
 */

/** Pedidos por utilizador em cada janela. */
export const LIMITE_PEDIDOS = 30;

/** Janela do limite, em milissegundos. */
export const JANELA_MS = 5 * 60 * 1000;

/**
 * Tamanho máximo do anexo já descodificado.
 *
 * Uma fotografia de telemóvel raramente passa dos 5 MB; o limite da própria
 * Gemini para `inlineData` anda pelos 20 MB de pedido. 10 MB deixa o caso
 * real passar e corta o resto.
 */
export const LIMITE_ANEXO_BYTES = 10 * 1024 * 1024;

/**
 * Tamanho real de um base64, sem o descodificar.
 *
 * Descodificar para medir seria alocar o dobro da memória do ataque que se
 * quer travar. Cada 4 caracteres representam 3 bytes, menos o preenchimento.
 */
export function bytesDeBase64(b64: string): number {
  const limpo = b64.replace(/^data:[^;]*;base64,/, "");
  const preenchimento = limpo.endsWith("==") ? 2 : limpo.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((limpo.length * 3) / 4) - preenchimento);
}

export function anexoDemasiadoGrande(b64: string | null | undefined): boolean {
  if (!b64) return false;
  return bytesDeBase64(b64) > LIMITE_ANEXO_BYTES;
}

/** Tipos de anexo aceites. Um PDF ou uma imagem — mais nada. */
export const MIMES_ACEITES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export function mimeAceite(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return (MIMES_ACEITES as readonly string[]).includes(mime.split(";")[0].trim().toLowerCase());
}

/**
 * Janela deslizante, em memória.
 *
 * Em serverless a memória é por instância, portanto o teto real é mais frouxo
 * do que o declarado — a mesma limitação que o limitador do login assume. Não
 * serve contra um adversário distribuído; serve contra o que acontece de
 * facto: um ciclo enganado e o abuso trivial de uma sessão.
 */
const registos = new Map<string, number[]>();

export function excedeuLimite(chave: string, agora = Date.now()): boolean {
  const marcas = (registos.get(chave) ?? []).filter((t) => agora - t < JANELA_MS);
  registos.set(chave, marcas);
  return marcas.length >= LIMITE_PEDIDOS;
}

export function registarPedido(chave: string, agora = Date.now()): void {
  const marcas = (registos.get(chave) ?? []).filter((t) => agora - t < JANELA_MS);
  marcas.push(agora);
  registos.set(chave, marcas);
}

/** Só para testes: esvazia o registo entre casos. */
export function limparRegistos(): void {
  registos.clear();
}
