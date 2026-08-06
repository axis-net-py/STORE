"use client";

import { useTranslations } from "next-intl";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import Image from "next/image";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        /**
         * A mensagem do servidor ganha à genérica quando existe.
         *
         * O `authorize` distingue "credenciais erradas" de "demasiadas
         * tentativas — aguarde 15 minutos", mas isto mostrava sempre a
         * primeira. Quem estava em espera lia "senha inválida", concluía que
         * a senha tinha mudado, e tentava outra vez — o que renova o bloqueio.
         *
         * Dizer que há um limite não é dar pistas a ninguém: não revela se a
         * conta existe nem se a senha estava certa. Esconder o motivo só
         * prejudica quem tem direito a entrar.
         */
        const doServidor = result.error !== "CredentialsSignin" ? result.error : null;
        setError(doServidor || t("invalidCredentials"));
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError(t("loginError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label className="text-[11px] uppercase tracking-widest font-bold text-primary">
          {t("email")}
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          className="w-full h-[44px] px-4 rounded-lg bg-background border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[11px] uppercase tracking-widest font-bold text-primary">
          {t("password")}
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full h-[44px] px-4 rounded-lg bg-background border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
        />
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-[44px] bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md active:scale-[0.98]"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? t("signingIn") : t("signIn")}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF9F5] p-4">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4 mb-8">
          {/* O logótipo da empresa, tal como foi entregue. Não é desenhado
              em vetor por nós: é a marca, e a marca é do cliente.
              `priority` porque está acima da dobra e é a primeira coisa que
              se vê — carregá-lo tarde faz o ecrã saltar. */}
          <Image
            src="/axis-emblema.png"
            alt="AXIS"
            width={88}
            height={88}
            priority
          />
          <h1 className="text-2xl font-bold text-primary tracking-tight uppercase tracking-widest">
            AXIS ERP
          </h1>
        </div>

        {/* Login Card */}
        <div className="border border-border rounded-xl p-8 bg-card">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-6 uppercase tracking-wider">
          © {new Date().getFullYear()} AXIS - Soluciones Digitales. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
