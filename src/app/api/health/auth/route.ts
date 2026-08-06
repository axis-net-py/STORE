import { NextResponse } from "next/server";

/**
 * Saúde da autenticação — sem sessão, porque o problema que diagnostica é
 * precisamente não se conseguir entrar.
 *
 * O `/api/diag` exige sessão SOVEREIGN, o que só ajuda quem já entrou. Quando
 * o NextAuth arranca mal — falta o segredo, falta a base — TODAS as rotas de
 * `/api/auth` respondem com uma página de erro em HTML. O cliente tenta lê-la
 * como JSON, rebenta, e o formulário mostra "Erro ao fazer login" sem mais
 * nada. Fica-se a olhar para um ecrã que não distingue "senha errada" de
 * "servidor mal configurado", que são coisas que se resolvem em sítios
 * diferentes.
 *
 * NÃO DEVOLVE SEGREDOS. Só diz se cada variável está definida, e o NEXTAUTH_URL
 * — que é um endereço público, e quase sempre a variável errada quando os
 * destinos de login e logout vão parar ao deploy errado. Dos erros da base sai
 * o nome e o código, nunca a mensagem: essas trazem host e utilizador.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Base = { liga: boolean; erro?: string };

export async function GET() {
  const temSegredo = !!(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET);
  const temBase = !!process.env.DATABASE_URL;

  let base: Base = { liga: false, erro: "DATABASE_URL não definida" };
  if (temBase) {
    try {
      // Importado aqui dentro de propósito: se o cliente do Prisma rebentar a
      // inicializar, o erro é apanhado e devolvido — em vez de levar consigo a
      // própria rota que existe para o reportar.
      const { default: prisma } = await import("@/lib/prisma");
      await prisma.$queryRaw`SELECT 1`;
      base = { liga: true };
    } catch (e: any) {
      base = { liga: false, erro: e?.code || e?.name || "erro desconhecido" };
    }
  }

  let nextauthUrl: string | null = null;
  if (process.env.NEXTAUTH_URL) {
    try {
      nextauthUrl = new URL(process.env.NEXTAUTH_URL).origin;
    } catch {
      nextauthUrl = "definida, mas não é um URL válido";
    }
  }

  const ok = temSegredo && base.liga;

  return NextResponse.json(
    {
      ok,
      verificadoEm: new Date().toISOString(),
      nextauthSecret: temSegredo ? "definida" : "EM FALTA",
      databaseUrl: temBase ? "definida" : "EM FALTA",
      base,
      nextauthUrl,
    },
    { status: ok ? 200 : 503 }
  );
}
