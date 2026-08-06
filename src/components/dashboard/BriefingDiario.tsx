import Link from "next/link";
import { AlertTriangle, Info, Sparkles, CircleAlert, ChevronRight } from "lucide-react";
import { getBriefing } from "@/app/actions/briefing";
import type { Gravidade } from "@/lib/briefing";

/**
 * O que merece atenção hoje, no topo do painel.
 *
 * Componente de servidor: os factos vêm da base na própria resposta, sem um
 * segundo pedido do navegador e sem um estado de carregamento a piscar.
 *
 * Não aparece quando não há nada a assinalar. Um cartão permanente a dizer
 * "está tudo bem" treina as pessoas a saltá-lo — e no dia em que disser algo
 * que importa, já ninguém o lê.
 */

const ESTILO: Record<Gravidade, { caixa: string; icone: typeof AlertTriangle; cor: string }> = {
  critico: {
    caixa: "border-destructive/30 bg-destructive/5",
    icone: CircleAlert,
    cor: "text-destructive",
  },
  atencao: {
    caixa: "border-border bg-muted/40",
    icone: AlertTriangle,
    cor: "text-foreground",
  },
  informativo: {
    caixa: "border-border bg-transparent",
    icone: Info,
    cor: "text-muted-foreground",
  },
};

export async function BriefingDiario({ tenantId }: { tenantId: string }) {
  let briefing;
  try {
    briefing = await getBriefing();
  } catch (err) {
    // O briefing é um extra: se falhar, o painel continua a servir para o que
    // serve. Derrubar o dashboard por causa dele seria trocar o essencial
    // pelo acessório.
    console.error("[briefing] Falhou ao montar:", err);
    return null;
  }

  if (briefing.alertas.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Atenção hoje
            </h2>
            {!briefing.redigidoPorIA && (
              /* Dito sem rodeios: o utilizador tem direito a saber quando a
                 leitura é automática e quando o modelo não respondeu. */
              <span className="text-[10px] text-muted-foreground/70">
                resumo automático
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">{briefing.resumo}</p>

          <ul className="mt-3 space-y-1.5">
            {briefing.alertas.map((a) => {
              const e = ESTILO[a.gravidade];
              const Icone = e.icone;
              const conteudo = (
                <>
                  <Icone className={`h-3.5 w-3.5 shrink-0 ${e.cor}`} />
                  <span className="flex-1 text-[13px] leading-snug text-foreground/90">
                    {a.texto}
                  </span>
                  {a.href && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                </>
              );

              return (
                <li key={a.tipo}>
                  {a.href ? (
                    <Link
                      href={`/${tenantId}/${a.href}`}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors hover:border-ring/40 ${e.caixa}`}
                    >
                      {conteudo}
                    </Link>
                  ) : (
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${e.caixa}`}>
                      {conteudo}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
