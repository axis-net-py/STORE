"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getTimbrados,
  createTimbrado,
  setTimbradoAtivo,
  deleteTimbrado,
} from "@/app/actions/timbrado";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Stamp, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { dataFiscalLegivel } from "@/lib/fuso";

/**
 * Cadastro dos timbrados da empresa.
 *
 * Sem timbrado cadastrado não se emite nenhuma fatura eletrónica — e é assim
 * de propósito (ver src/lib/timbrado.ts). Esta secção existe para que isso
 * seja resolúvel pelo utilizador em vez de ser um beco.
 */

const t = {
  pt: {
    title: "Timbrado",
    desc:
      "O timbrado é a autorização da SET para emitir. Tem prazo de validade e um intervalo de numeração, " +
      "e nenhuma fatura eletrônica é emitida fora deles.",
    numero: "Número do timbrado",
    numeroHint: "8 algarismos, como consta na autorização da SET",
    estab: "Estabelecimento",
    ponto: "Ponto de expedição",
    de: "Válido desde",
    ate: "Válido até",
    intervaloDe: "Numeração de",
    intervaloAte: "até",
    adicionar: "Cadastrar timbrado",
    nenhum: "Nenhum timbrado cadastrado. Sem ele não é possível emitir documentos eletrônicos.",
    ativo: "Ativo",
    inativo: "Inativo",
    expirado: "Expirado",
    expiraEm: (d: number) => `Expira em ${d} dia${d === 1 ? "" : "s"}`,
    restantes: (n: number) => `${n.toLocaleString("pt-BR")} documentos restantes`,
    aEsgotar: "A esgotar",
    ativar: "Ativar",
    desativar: "Desativar",
    criado: "Timbrado cadastrado.",
    apagado: "Timbrado removido.",
    confirmar: "Remover este timbrado?",
    validade: "Validade",
    intervalo: "Intervalo",
  },
  es: {
    title: "Timbrado",
    desc:
      "El timbrado es la autorización de la SET para emitir. Tiene plazo de validez y un rango de numeración, " +
      "y ninguna factura electrónica se emite fuera de ellos.",
    numero: "Número de timbrado",
    numeroHint: "8 dígitos, como consta en la autorización de la SET",
    estab: "Establecimiento",
    ponto: "Punto de expedición",
    de: "Válido desde",
    ate: "Válido hasta",
    intervaloDe: "Numeración de",
    intervaloAte: "hasta",
    adicionar: "Registrar timbrado",
    nenhum: "Ningún timbrado registrado. Sin él no es posible emitir documentos electrónicos.",
    ativo: "Activo",
    inativo: "Inactivo",
    expirado: "Vencido",
    expiraEm: (d: number) => `Vence en ${d} día${d === 1 ? "" : "s"}`,
    restantes: (n: number) => `${n.toLocaleString("es-PY")} documentos restantes`,
    aEsgotar: "Por agotarse",
    ativar: "Activar",
    desativar: "Desactivar",
    criado: "Timbrado registrado.",
    apagado: "Timbrado eliminado.",
    confirmar: "¿Eliminar este timbrado?",
    validade: "Vigencia",
    intervalo: "Rango",
  },
};

type Linha = Awaited<ReturnType<typeof getTimbrados>>[number];

export function TimbradoSection() {
  const { language } = useLanguage();
  const s = t[language === "es" ? "es" : "pt"];

  const [lista, setLista] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gravando, setGravando] = useState(false);

  const [numero, setNumero] = useState("");
  const [establishment, setEstablishment] = useState("001");
  const [emissionPoint, setEmissionPoint] = useState("001");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [rangeFrom, setRangeFrom] = useState("1");
  const [rangeTo, setRangeTo] = useState("");

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      setLista(await getTimbrados());
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
    setGravando(true);
    try {
      await createTimbrado({
        numero,
        establishment,
        emissionPoint,
        validFrom,
        validTo: validTo || null,
        rangeFrom: Number(rangeFrom),
        rangeTo: Number(rangeTo),
      });
      toast.success(s.criado);
      setNumero("");
      setValidFrom("");
      setValidTo("");
      setRangeTo("");
      await recarregar();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGravando(false);
    }
  };

  // dataFiscalLegivel e não toLocaleDateString: esta converte para o fuso do
  // navegador, e um timbrado válido até 31/12 aparecia como 30/12. Ver
  // lib/fuso.ts. O formato DD/MM/AAAA é o mesmo em pt-BR e es-PY.
  const dia = dataFiscalLegivel;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Stamp className="h-5 w-5" />
        <h2 className="text-lg font-semibold">{s.title}</h2>
      </div>
      <p className="text-sm text-muted-foreground max-w-2xl">{s.desc}</p>

      <form onSubmit={enviar} className="grid gap-4 md:grid-cols-4 rounded-lg border p-4">
        <div className="md:col-span-2">
          <Label htmlFor="tb-numero">{s.numero}</Label>
          <Input
            id="tb-numero"
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="12345678"
            inputMode="numeric"
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">{s.numeroHint}</p>
        </div>

        <div>
          <Label htmlFor="tb-estab">{s.estab}</Label>
          <Input
            id="tb-estab"
            value={establishment}
            onChange={(e) => setEstablishment(e.target.value.replace(/\D/g, "").slice(0, 3))}
            required
          />
        </div>

        <div>
          <Label htmlFor="tb-ponto">{s.ponto}</Label>
          <Input
            id="tb-ponto"
            value={emissionPoint}
            onChange={(e) => setEmissionPoint(e.target.value.replace(/\D/g, "").slice(0, 3))}
            required
          />
        </div>

        <div>
          <Label htmlFor="tb-de">{s.de}</Label>
          <Input id="tb-de" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
        </div>

        <div>
          <Label htmlFor="tb-ate">{s.ate}</Label>
          <Input id="tb-ate" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
        </div>

        <div>
          <Label htmlFor="tb-rf">{s.intervaloDe}</Label>
          <Input
            id="tb-rf"
            type="number"
            min={1}
            value={rangeFrom}
            onChange={(e) => setRangeFrom(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="tb-rt">{s.intervaloAte}</Label>
          <Input
            id="tb-rt"
            type="number"
            min={1}
            value={rangeTo}
            onChange={(e) => setRangeTo(e.target.value)}
            required
          />
        </div>

        <div className="md:col-span-4">
          <Button type="submit" disabled={gravando}>
            {gravando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Stamp className="mr-2 h-4 w-4" />}
            {s.adicionar}
          </Button>
        </div>
      </form>

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : lista.length === 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{s.nenhum}</span>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{s.numero}</TableHead>
              <TableHead>{s.estab}</TableHead>
              <TableHead>{s.validade}</TableHead>
              <TableHead>{s.intervalo}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((tb) => {
              const expirado = tb.diasAteExpirar !== null && tb.diasAteExpirar < 0;
              const aExpirar = tb.diasAteExpirar !== null && tb.diasAteExpirar >= 0 && tb.diasAteExpirar <= 30;
              const aEsgotar = tb.restantes <= 100;

              return (
                <TableRow key={tb.id}>
                  <TableCell className="font-mono">{tb.numero}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {tb.establishment}-{tb.emissionPoint}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>
                      {dia(tb.validFrom)} → {dia(tb.validTo)}
                    </div>
                    {expirado && (
                      <Badge variant="destructive" className="mt-1">
                        {s.expirado}
                      </Badge>
                    )}
                    {aExpirar && (
                      <Badge variant="outline" className="mt-1">
                        {s.expiraEm(tb.diasAteExpirar!)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="font-mono">
                      {tb.rangeFrom.toLocaleString()} – {tb.rangeTo.toLocaleString()}
                    </div>
                    {aEsgotar && (
                      <Badge variant="outline" className="mt-1">
                        {s.aEsgotar}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Badge variant={tb.isActive ? "default" : "secondary"} className="mr-2">
                      {tb.isActive ? s.ativo : s.inativo}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await setTimbradoAtivo(tb.id, !tb.isActive);
                          await recarregar();
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                    >
                      {tb.isActive ? s.desativar : s.ativar}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm(s.confirmar)) return;
                        try {
                          await deleteTimbrado(tb.id);
                          toast.success(s.apagado);
                          await recarregar();
                        } catch (e: any) {
                          // A ação recusa apagar um timbrado que já autorizou
                          // documentos, e explica porquê. Mostrar a mensagem.
                          toast.error(e.message);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
