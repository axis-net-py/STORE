import NextAuth, { type NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "@/lib/prisma";
import { isRateLimited, recordFailedAttempt, clearAttempts } from "@/lib/rate-limit";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const rateKey = `login:${credentials.email.toLowerCase()}`;
        if (isRateLimited(rateKey)) {
          throw new Error("Muitas tentativas de login. Aguarde 15 minutos e tente novamente.");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { tenant: { select: { name: true } } },
        });

        if (!user || !user.password) {
          recordFailedAttempt(rateKey);
          return null;
        }

        const isValidPassword = await compare(
          credentials.password,
          user.password
        );

        if (!isValidPassword) {
          recordFailedAttempt(rateKey);
          return null;
        }

        clearAttempts(rateKey);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenantName: user.tenant?.name || "",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.tenantId = (user as any).tenantId;
        token.tenantName = (user as any).tenantName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).tenantId = token.tenantId;
        (session.user as any).tenantName = token.tenantName;
      }
      return session;
    },
  },
  // Em produção o segredo DEVE vir do ambiente; um segredo hardcoded permitiria forjar sessões JWT
  secret:
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV !== "production" ? "axis-store-dev-only-secret" : undefined),
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
export const auth = () => getServerSession(authOptions);
export const signIn = () => import("next-auth/react").then((m) => m.signIn);
export const signOut = () => import("next-auth/react").then((m) => m.signOut);
