"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { verificarLinkSetup, definirPrimeiraSenha } from "@/app/actions/setup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck, XCircle } from "lucide-react";

/**
 * Primeira entrada de um cliente novo.
 *
 * O link chega-lhe pelo canal que já usa connosco. É de uso único e expira,
 * por isso não precisa de canal cifrado — e ninguém do nosso lado chega a
 * conhecer a password que ele escolher (spec Projeto 2, §5.3).
 */
export default function SetupPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [estado, setEstado] = useState<"a-verificar" | "valido" | "invalido">("a-verificar");
  const [motivo, setMotivo] = useState("");
  const [info, setInfo] = useState<{ email: string; empresa: string } | null>(null);

  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [aGravar, setAGravar] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await verificarLinkSetup(token);
      if (r.ok) {
        setInfo({ email: r.email, empresa: r.empresa });
        setEstado("valido");
      } else {
        setMotivo(r.motivo);
        setEstado("invalido");
      }
    })();
  }, [token]);

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha !== confirmacao) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setAGravar(true);
    try {
      await definirPrimeiraSenha(token, senha);
      toast.success("Senha definida. Já pode entrar.");
      router.push("/login");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAGravar(false);
    }
  };

  if (estado === "a-verificar") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (estado === "invalido") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-3">
          <XCircle className="h-10 w-10 mx-auto text-destructive" />
          <h1 className="text-lg font-bold">Link inválido</h1>
          <p className="text-sm text-muted-foreground">{motivo}</p>
          <p className="text-xs text-muted-foreground">
            Contacte quem lhe forneceu o acesso para receber um link novo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submeter} className="w-full max-w-sm space-y-5">
        <div className="text-center space-y-2">
          <ShieldCheck className="h-9 w-9 mx-auto text-primary" />
          <h1 className="text-lg font-bold">Defina a sua senha</h1>
          <p className="text-sm text-muted-foreground">
            {info?.empresa} · {info?.email}
          </p>
          <p className="text-xs text-muted-foreground">
            Escolha uma senha só sua. Ninguém mais a conhecerá.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="senha">Nova senha</Label>
          <Input
            id="senha"
            type="password"
            required
            autoFocus
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="conf">Repita a senha</Label>
          <Input
            id="conf"
            type="password"
            required
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
        </div>

        <Button type="submit" className="w-full" disabled={aGravar || !senha || !confirmacao}>
          {aGravar && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Definir senha e entrar
        </Button>
      </form>
    </div>
  );
}
