"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Pencil, Receipt, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { useLanguage } from "@/components/language-provider";
import { abrirComanda } from "@/modules/food/actions/comanda";
import { MesaSheet, type MesaEditavel } from "./MesaSheet";
import type { MesaNoSalao } from "@/modules/food/actions/mesa";

const STRINGS = {
  pt: {
    livre: "Livre",
    reservada: "Reservada",
    inativa: "Fora de serviço",
    abrir: "Abrir conta",
    ver: "Ver comanda",
    lugares: "lugares",
    ha: "há",
    min: "min",
    semMesa: "Balcão e delivery",
    vazio: "Ainda não há mesas. Crie a primeira para começar a abrir contas.",
    erro: "Não foi possível abrir a conta.",
    semZona: "Sem zona",
  },
  es: {
    livre: "Libre",
    reservada: "Reservada",
    inativa: "Fuera de servicio",
    abrir: "Abrir cuenta",
    ver: "Ver comanda",
    lugares: "lugares",
    ha: "hace",
    min: "min",
    semMesa: "Barra y delivery",
    vazio: "Todavía no hay mesas. Cree la primera para empezar a abrir cuentas.",
    erro: "No se pudo abrir la cuenta.",
    semZona: "Sin zona",
  },
} as const;

function minutosDesde(d: Date | string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 60_000));
}

export function SalaoGrelha({
  tenantId,
  mesas,
  semMesa,
}: {
  tenantId: string;
  mesas: MesaNoSalao[];
  semMesa: { id: string; numero: number; tipo: string; total: number; abertaEm: Date }[];
}) {
  const { language } = useLanguage();
  const s = STRINGS[language === "es" ? "es" : "pt"];
  const router = useRouter();
  const [aAbrir, setAAbrir] = useState<string | null>(null);

  async function abrir(mesaId: string) {
    setAAbrir(mesaId);
    try {
      const { id } = await abrirComanda({ tipo: "MESA", mesaId, pessoas: 1 });
      router.push(`/${tenantId}/comandas/${id}`);
    } catch (e: any) {
      toast.error(e?.message || s.erro);
      setAAbrir(null);
    }
  }

  // Agrupadas por zona porque é assim que o salão está na cabeça de quem lá
  // trabalha: primeiro a varanda, depois o interior — não por ordem alfabética
  // de um nome que ninguém decora.
  const zonas = new Map<string, MesaNoSalao[]>();
  for (const m of mesas) {
    const z = m.zona || s.semZona;
    if (!zonas.has(z)) zonas.set(z, []);
    zonas.get(z)!.push(m);
  }

  if (mesas.length === 0 && semMesa.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {s.vazio}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {[...zonas.entries()].map(([zona, doGrupo]) => (
        <section key={zona} className="space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {zona}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {doGrupo.map((m) => {
              const ocupada = !!m.comanda;
              return (
                <div
                  key={m.id}
                  className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors ${
                    ocupada
                      ? "border-primary/50 bg-primary/5"
                      : m.estado === "INATIVA"
                      ? "border-border bg-muted/40 opacity-60"
                      : m.estado === "RESERVADA"
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold truncate">{m.nome}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" /> {m.lugares} {s.lugares}
                      </p>
                    </div>
                    <MesaSheet
                      tenantId={tenantId}
                      mesa={m as MesaEditavel}
                      trigger={
                        <button
                          type="button"
                          aria-label={m.nome}
                          className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      }
                    />
                  </div>

                  {ocupada ? (
                    <>
                      <div>
                        <p className="text-lg font-extrabold tracking-tight">
                          {formatCurrency(m.comanda!.total)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          #{m.comanda!.numero} · {s.ha} {minutosDesde(m.comanda!.abertaEm)} {s.min}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="w-full gap-1.5">
                        <Link href={`/${tenantId}/comandas/${m.comanda!.id}`}>
                          <Receipt className="w-3.5 h-3.5" /> {s.ver}
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {m.estado === "INATIVA" ? s.inativa : m.estado === "RESERVADA" ? s.reservada : s.livre}
                      </p>
                      <Button
                        size="sm"
                        className="w-full gap-1.5"
                        disabled={m.estado === "INATIVA" || aAbrir === m.id}
                        onClick={() => abrir(m.id)}
                      >
                        {aAbrir === m.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {s.abrir}
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {semMesa.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {s.semMesa}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {semMesa.map((c) => (
              <Link
                key={c.id}
                href={`/${tenantId}/comandas/${c.id}`}
                className="rounded-xl border border-primary/50 bg-primary/5 p-4 flex flex-col gap-1 hover:bg-primary/10 transition-colors"
              >
                <p className="font-bold">#{c.numero}</p>
                <p className="text-lg font-extrabold tracking-tight">{formatCurrency(c.total)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {c.tipo} · {s.ha} {minutosDesde(c.abertaEm)} {s.min}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
