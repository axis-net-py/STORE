import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolverHost } from "@/lib/tenant-host";

/**
 * Corre em Edge runtime, onde o Prisma não funciona. Por isso faz apenas
 * manipulação de strings: extrai o subdomínio e passa-o adiante num cabeçalho.
 * A tradução de slug para cliente acontece já em Node (spec Projeto 2, §4.3).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const host = request.headers.get("host");
  const resolucao = resolverHost(host);

  /**
   * Propaga o cliente do subdomínio no PEDIDO, para os server components o
   * poderem ler com `headers()`. Definir na resposta não serviria: a resposta
   * vai para o navegador, não para quem corre a seguir no servidor.
   */
  const seguir = () => {
    const cabecalhos = new Headers(request.headers);
    // Apagar sempre primeiro: sem isto, um cabeçalho forjado pelo cliente
    // chegaria intacto e escolheria o tenant por ele.
    cabecalhos.delete("x-tenant-slug");
    if (resolucao.tipo === "tenant") cabecalhos.set("x-tenant-slug", resolucao.slug);
    return NextResponse.next({ request: { headers: cabecalhos } });
  };

  // Rotas públicas
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/portal") ||
    pathname.includes(".") // ficheiros estáticos
  ) {
    return seguir();
  }

  // Rotas de API: a autenticação é feita em cada uma
  if (pathname.startsWith("/api/")) {
    return seguir();
  }

  // NextAuth v4 com estratégia JWT guarda a sessão no cookie
  const sessionToken =
    request.cookies.get("next-auth.session-token")?.value ||
    request.cookies.get("__Secure-next-auth.session-token")?.value;

  if (!sessionToken) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return seguir();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
