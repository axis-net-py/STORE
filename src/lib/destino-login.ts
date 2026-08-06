/**
 * Para onde o NextAuth pode mandar alguém depois de entrar ou sair.
 *
 * Módulo puro para poder ser testado: a regra vive aqui e o callback `redirect`
 * do `src/auth.ts` limita-se a chamá-la. Duas exigências ao mesmo tempo, e é
 * fácil cumprir uma esquecendo a outra:
 *
 *   1. Nunca sair da aplicação. Um `callbackUrl` é um parâmetro de URL, e
 *      qualquer pessoa pode escrever lá o que quiser. Mandar um utilizador com
 *      sessão aberta para outro sítio é como isto se torna um problema.
 *
 *   2. Devolver sempre um URL ABSOLUTO. O `signIn` do next-auth v4 faz
 *      `new URL(destino)` sem base, e `new URL("/")` atira `TypeError:
 *      Failed to construct 'URL': Invalid URL`. Isso acontecia DEPOIS de a
 *      autenticação ter corrido bem: a sessão abria e o formulário dizia
 *      "Erro ao fazer login". Cumprir só a primeira exigência, devolvendo
 *      caminhos relativos, trancava toda a gente à porta.
 */
export function destinoPermitido(url: string, baseUrl: string): string {
  // Caminho relativo: é nosso por construção, só lhe falta a origem.
  if (url.startsWith("/")) return `${baseUrl}${url}`;

  try {
    if (new URL(url).origin === baseUrl) return url;
  } catch {
    // Ilegível como URL — trata-se como veio de fora.
  }

  return baseUrl;
}
