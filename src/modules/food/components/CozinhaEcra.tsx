"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Clock, Flame } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { mudarEstadoItem } from "@/modules/food/actions/comanda";
import { MINUTOS_ATRASO, type Area } from "@/modules/food/lib/comanda";
import type { ItemNaCozinha } from "@/modules/food/actions/cardapio";

const STRINGS = {
  pt: {
    todas: "Tudo",
    vazio: "Nada em preparo. A cozinha está em dia.",
    pronto: "Pronto",
    entregar: "Entregar",
    mesa: "Mesa",
    comanda: "Comanda",
    min: "min",
    erro: "Não foi possível atualizar o item.",
    areas: { COZINHA: "Cozinha", BAR: "Bar", CHAPA: "Chapa", SEM_PREPARO: "Sem preparo" },
  },
  es: {
    todas: "Todo",
    vazio: "Nada en preparación. La cocina está al día.",
    pronto: "Listo",
    entregar: "Entregar",
    mesa: "Mesa",
    comanda: "Comanda",
    min: "min",
    erro: "No se pudo actualizar el ítem.",
    areas: { COZINHA: "Cocina", BAR: "Barra", CHAPA: "Plancha", SEM_PREPARO: "Sin preparación" },
  },
} as const;

const AREAS: Area[] = ["COZINHA", "CHAPA", "BAR"];

export function CozinhaEcra({ itens, area }: { itens: ItemNaCozinha[]; area?: Area }) {
  const { language } = useLanguage();
  const s = STRINGS[language === "es" ? "es" : "pt"];
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);

  /**
   * A cozinha não carrega em F5.
   *
   * Este ecrã fica pendurado numa parede e ninguém lhe toca durante o serviço.
   * Sem isto, um pedido novo só apareceria quando alguém se lembrasse de
   * recarregar — que é exatamente quando já é tarde. Trinta segundos é curto o
   * suficiente para o pedido chegar antes de o cliente perguntar, e longo o
   * suficiente para não pesar num turno inteiro.
   */
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [router]);

  async function avancar(item: ItemNaCozinha) {
    setOcupado(item.id);
    try {
      await mudarEstadoItem(item.id, item.estado === "EM_PREPARO" ? "PRONTO" : "ENTREGUE");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || s.erro);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <FiltroArea href="?" ativo={!area} rotulo={s.todas} />
        {AREAS.map((a) => (
          <FiltroArea key={a} href={`?area=${a}`} ativo={area === a} rotulo={s.areas[a]} />
        ))}
      </div>

      {itens.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {s.vazio}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {itens.map((i) => {
            const atrasado = i.espera >= MINUTOS_ATRASO;
            const pronto = i.estado === "PRONTO";
            return (
              <div
                key={i.id}
                className={`rounded-xl border p-4 flex flex-col gap-3 ${
                  pronto
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : atrasado
                    ? "border-destructive/50 bg-destructive/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-bold leading-tight">
                      {i.quantidade}× {i.nome}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {i.comanda.mesa ? `${s.mesa} ${i.comanda.mesa}` : `${s.comanda} #${i.comanda.numero}`}
                      {" · "}
                      {s.areas[i.area]}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-bold tabular-nums inline-flex items-center gap-1 shrink-0 ${
                      atrasado && !pronto ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {i.espera} {s.min}
                  </span>
                </div>

                {i.observacao && (
                  <p className="text-sm font-medium italic text-amber-700 dark:text-amber-500">
                    {i.observacao}
                  </p>
                )}

                <button
                  type="button"
                  disabled={ocupado === i.id}
                  onClick={() => avancar(i)}
                  className={`mt-auto w-full h-10 rounded-lg font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                    pronto
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {pronto ? <Check className="w-4 h-4" /> : <Flame className="w-4 h-4" />}
                  {pronto ? s.entregar : s.pronto}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FiltroArea({ href, ativo, rotulo }: { href: string; ativo: boolean; rotulo: string }) {
  return (
    <a
      href={href}
      className={`px-3 h-8 inline-flex items-center rounded-lg text-xs font-semibold border transition-colors ${
        ativo
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {rotulo}
    </a>
  );
}
