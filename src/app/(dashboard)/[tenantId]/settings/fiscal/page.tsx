"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getFiscalCredentials,
  uploadFiscalCredential,
  activateFiscalCredential,
  deleteFiscalCredential,
  getFaturacaoEletronica,
  setFaturacaoEletronica,
  type CredencialResumo,
} from "@/app/actions/fiscal-credential";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldCheck, Upload, Trash2, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { TimbradoSection } from "@/components/fiscal/TimbradoSection";
import { dataFiscalLegivel } from "@/lib/fuso";

const t = {
  pt: {
    title: "Certificado Digital",
    desc: "O certificado da sua empresa assina os documentos fiscais enviados à SET. Ele é cifrado antes de ser gravado e nunca sai daqui.",
    novo: "Carregar certificado",
    arquivo: "Arquivo .p12",
    senha: "Senha do certificado",
    validade: "Válido até",
    inicio: "Válido desde",
    ambiente: "Ambiente",
    teste: "Homologação (teste)",
    producao: "Produção",
    ativar: "Ativar após carregar",
    enviar: "Carregar",
    nenhum: "Nenhum certificado carregado. Sem ele, não é possível emitir documentos eletrônicos.",
    ativo: "Ativo",
    inativo: "Inativo",
    expirado: "Expirado",
    expiraEm: (d: number) => `Expira em ${d} dia${d === 1 ? "" : "s"}`,
    sucesso: "Certificado carregado e cifrado.",
    apagado: "Certificado removido.",
    ativado: "Certificado ativado.",
    confirmar: "Remover este certificado?",
    modoTitulo: "Faturação eletrônica",
    modoDesc:
      "Ligue quando a sua empresa já tiver certificado digital e timbrado para emitir documentos eletrônicos à SET. Desligado, o sistema opera com documentos internos e não cobra nem avisa sobre certificado.",
    modoLigado: "Emitindo documentos eletrônicos à SET.",
    modoDesligado: "Operando sem faturação eletrônica.",
    modoGuardado: "Preferência guardada.",
  },
  es: {
    title: "Certificado Digital",
    desc: "El certificado de su empresa firma los documentos fiscales enviados a la SET. Se cifra antes de guardarse y nunca sale de aquí.",
    novo: "Cargar certificado",
    arquivo: "Archivo .p12",
    senha: "Contraseña del certificado",
    validade: "Válido hasta",
    inicio: "Válido desde",
    ambiente: "Ambiente",
    teste: "Homologación (prueba)",
    producao: "Producción",
    ativar: "Activar después de cargar",
    enviar: "Cargar",
    nenhum: "Ningún certificado cargado. Sin él no es posible emitir documentos electrónicos.",
    ativo: "Activo",
    inativo: "Inactivo",
    expirado: "Vencido",
    expiraEm: (d: number) => `Vence en ${d} día${d === 1 ? "" : "s"}`,
    sucesso: "Certificado cargado y cifrado.",
    apagado: "Certificado eliminado.",
    ativado: "Certificado activado.",
    confirmar: "¿Eliminar este certificado?",
    modoTitulo: "Facturación electrónica",
    modoDesc:
      "Actívela cuando su empresa ya cuente con certificado digital y timbrado para emitir documentos electrónicos a la SET. Apagada, el sistema trabaja con documentos internos y no exige ni avisa sobre el certificado.",
    modoLigado: "Emitiendo documentos electrónicos a la SET.",
    modoDesligado: "Trabajando sin facturación electrónica.",
    modoGuardado: "Preferencia guardada.",
  },
};

export default function FiscalSettingsPage() {
  const { language } = useLanguage();
  const s = t[language === "es" ? "es" : "pt"];

  const [lista, setLista] = useState<CredencialResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [eletronica, setEletronica] = useState(false);
  const [aGuardarModo, setAGuardarModo] = useState(false);

  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [senha, setSenha] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [ambiente, setAmbiente] = useState<"test" | "prod">("test");
  const [ativar, setAtivar] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [credenciais, modo] = await Promise.all([
        getFiscalCredentials(),
        getFaturacaoEletronica(),
      ]);
      setLista(credenciais);
      setEletronica(modo);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ficheiro || !senha) return;

    setEnviando(true);
    try {
      // O ficheiro é lido no navegador e enviado por HTTPS. Nunca passa por
      // disco no servidor: é cifrado em memória e gravado já cifrado.
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        r.readAsDataURL(ficheiro);
      });

      await uploadFiscalCredential({
        certificateBase64: base64,
        password: senha,
        fileName: ficheiro.name,
        validFrom: validFrom || null,
        validUntil: validUntil || null,
        environment: ambiente,
        ativar,
      });

      toast.success(s.sucesso);
      setFicheiro(null);
      setSenha("");
      setValidFrom("");
      setValidUntil("");
      await recarregar();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const alternarModo = async (ativo: boolean) => {
    // Optimista: o interruptor responde já e só reverte se o servidor recusar.
    // A alternativa — esperar pela ida e volta — deixa-o parado no clique, e
    // isto é uma preferência, não uma transação.
    const anterior = eletronica;
    setEletronica(ativo);
    setAGuardarModo(true);
    try {
      await setFaturacaoEletronica(ativo);
      toast.success(s.modoGuardado);
    } catch (e: any) {
      setEletronica(anterior);
      toast.error(e.message);
    } finally {
      setAGuardarModo(false);
    }
  };

  const estado = (c: CredencialResumo) => {
    if (c.diasParaExpirar !== null && c.diasParaExpirar < 0)
      return <Badge variant="destructive">{s.expirado}</Badge>;
    if (c.isActive) return <Badge className="bg-emerald-600 hover:bg-emerald-600">{s.ativo}</Badge>;
    return <Badge variant="secondary">{s.inativo}</Badge>;
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> {s.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{s.desc}</p>
      </div>

      {/* Antes de tudo o resto: a empresa emite eletronicamente ou não? A
          resposta decide se o que vem a seguir é uma obrigação ou um preparativo. */}
      <div className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-6">
        <div className="space-y-1">
          <Label htmlFor="modo-eletronico" className="text-sm font-semibold">
            {s.modoTitulo}
          </Label>
          <p className="text-sm text-muted-foreground max-w-2xl">{s.modoDesc}</p>
          <p className="text-xs font-medium text-muted-foreground pt-1">
            {eletronica ? s.modoLigado : s.modoDesligado}
          </p>
        </div>
        <Switch
          id="modo-eletronico"
          checked={eletronica}
          disabled={carregando || aGuardarModo}
          onCheckedChange={alternarModo}
        />
      </div>

      <form onSubmit={enviar} className="rounded-xl border border-border p-4 space-y-4 bg-card">
        <h2 className="text-sm font-semibold">{s.novo}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cert">{s.arquivo}</Label>
            <Input
              id="cert"
              type="file"
              accept=".p12,.pfx"
              required
              onChange={(e) => setFicheiro(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="senha">{s.senha}</Label>
            <Input
              id="senha"
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="de">{s.inicio}</Label>
            <Input id="de" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ate">{s.validade}</Label>
            <Input id="ate" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{s.ambiente}</Label>
            <Select value={ambiente} onValueChange={(v) => setAmbiente(v as "test" | "prod")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="test">{s.teste}</SelectItem>
                <SelectItem value="prod">{s.producao}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" checked={ativar} onChange={(e) => setAtivar(e.target.checked)} />
            {s.ativar}
          </label>
        </div>

        <Button type="submit" disabled={enviando || !ficheiro || !senha}>
          {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
          {s.enviar}
        </Button>
      </form>

      {carregando ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : lista.length === 0 ? (
        // Sem certificado só é um aviso para quem emite eletronicamente. Para
        // os outros é o estado normal, e um triângulo amarelo a dizê-lo só
        // ensina a ignorar avisos.
        eletronica ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3 text-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <p>{s.nenhum}</p>
          </div>
        ) : null
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{s.arquivo}</TableHead>
              <TableHead>{s.ambiente}</TableHead>
              <TableHead>{s.validade}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  {c.fileName ?? "—"} <span className="ml-2">{estado(c)}</span>
                </TableCell>
                <TableCell>{c.environment === "prod" ? s.producao : s.teste}</TableCell>
                <TableCell>
                  {dataFiscalLegivel(c.validUntil)}
                  {c.diasParaExpirar !== null && c.diasParaExpirar >= 0 && c.diasParaExpirar <= 30 && (
                    <span className="ml-2 text-xs font-semibold text-amber-600">
                      {s.expiraEm(c.diasParaExpirar)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {!c.isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await activateFiscalCredential(c.id);
                          toast.success(s.ativado);
                          await recarregar();
                        } catch (e: any) { toast.error(e.message); }
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm(s.confirmar)) return;
                      try {
                        await deleteFiscalCredential(c.id);
                        toast.success(s.apagado);
                        await recarregar();
                      } catch (e: any) { toast.error(e.message); }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* O certificado assina; o timbrado autoriza. Faltando qualquer um dos
          dois não há emissão eletrónica, por isso vivem no mesmo ecrã. */}
      <div className="border-t pt-8">
        <TimbradoSection />
      </div>
    </div>
  );
}
