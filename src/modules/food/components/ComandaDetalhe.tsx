"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send, Trash2, Check, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { useLanguage } from "@/components/language-provider";
import {
  lancarItem, enviarParaPreparo, mudarEstadoItem, fecharComanda,
} from "@/modules/food/actions/comanda";
import type { ComandaCompleta } from "@/modules/food/actions/comanda";
import type { ItemDoCardapio } from "@/modules/food/actions/cardapio";

const STRINGS = {
  pt: {
    cardapio: "Cardápio",
    procurar: "Procurar item...",
    esgotado: "Esgotado",
    conta: "Conta",
    vazia: "Nada lançado ainda. Escolha do cardápio ao lado.",
    subtotal: "Subtotal",
    servico: "Serviço",
    desconto: "Desconto",
    total: "Total",
    porPessoa: "Por pessoa",
    pessoas: "Pessoas",
    enviar: "Enviar à cozinha",
    fechar: "Fechar conta",
    obs: "Observação",
    obsDica: "sem cebola, ao ponto…",
    estados: {
      LANCADO: "Por enviar",
      EM_PREPARO: "Em preparo",
      PRONTO: "Pronto",
      ENTREGUE: "Entregue",
      CANCELADO: "Cancelado",
    },
    entregar: "Entregar",
    cancelar: "Cancelar item",
    enviados: "item(ns) enviados.",
    fechada: "Conta fechada e venda emitida.",
    erro: "Não foi possível concluir.",
    fechadaEm: "Fechada",
  },
  es: {
    cardapio: "Carta",
    procurar: "Buscar ítem...",
    esgotado: "Agotado",
    conta: "Cuenta",
    vazia: "Nada cargado todavía. Elija de la carta al lado.",
    subtotal: "Subtotal",
    servico: "Servicio",
    desconto: "Descuento",
    total: "Total",
    porPessoa: "Por persona",
    pessoas: "Personas",
    enviar: "Enviar a cocina",
    fechar: "Cerrar cuenta",
    obs: "Observación",
    obsDica: "sin cebolla, a punto…",
    estados: {
      LANCADO: "Por enviar",
      EM_PREPARO: "En preparación",
      PRONTO: "Listo",
      ENTREGUE: "Entregado",
      CANCELADO: "Cancelado",
    },
    entregar: "Entregar",
    cancelar: "Cancelar ítem",
    enviados: "ítem(s) enviados.",
    fechada: "Cuenta cerrada y venta emitida.",
    erro: "No se pudo completar.",
    fechadaEm: "Cerrada",
  },
} as const;

export function ComandaDetalhe({
  tenantId,
  comanda,
  cardapio,
}: {
  tenantId: string;
  comanda: ComandaCompleta;
  cardapio: ItemDoCardapio[];
}) {
  const { language } = useLanguage();
  const s = STRINGS[language === "es" ? "es" : "pt"];
  const router = useRouter();

  const [busca, setBusca] = useState("");
  const [obs, setObs] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [servicoPct, setServicoPct] = useState(String(comanda.servicoPct || 0));
  const [desconto, setDesconto] = useState(String(comanda.desconto || 0));

  const aberta = comanda.estado === "ABERTA";
  const porEnviar = comanda.itens.filter((i) => i.estado === "LANCADO").length;

  const filtrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return cardapio.filter((i) => !q || i.nome.toLowerCase().includes(q));
  }, [cardapio, busca]);

  const seccoes = useMemo(() => {
    const m = new Map<string, ItemDoCardapio[]>();
    for (const i of filtrado) {
      if (!m.has(i.seccao)) m.set(i.seccao, []);
      m.get(i.seccao)!.push(i);
    }
    return [...m.entries()];
  }, [filtrado]);

  async function correr(fn: () => Promise<unknown>, sucesso?: string) {
    setOcupado(true);
    try {
      await fn();
      if (sucesso) toast.success(sucesso);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || s.erro);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 md:gap-6 items-start">
      {/* Cardápio */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={s.procurar}
            className="h-9"
          />
        </div>

        {aberta && (
          <div className="space-y-1.5">
            <Label htmlFor="obs" className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {s.obs}
            </Label>
            {/* A observação aplica-se ao próximo item lançado. É assim que se
                pede na vida real — diz-se o prato e a seguir "sem cebola". */}
            <Input
              id="obs"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder={s.obsDica}
              className="h-9"
            />
          </div>
        )}

        <div className="space-y-5">
          {seccoes.map(([seccao, itens]) => (
            <div key={seccao} className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-primary">
                {seccao}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {itens.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    disabled={!aberta || !i.disponivel || ocupado}
                    onClick={() =>
                      correr(async () => {
                        await lancarItem(comanda.id, {
                          productId: i.produtoId,
                          quantidade: 1,
                          observacao: obs,
                        });
                        setObs("");
                      })
                    }
                    className="rounded-lg border border-border bg-background p-3 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-background"
                  >
                    <p className="text-sm font-semibold leading-tight">{i.nome}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {i.disponivel ? formatCurrency(i.preco) : s.esgotado}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conta */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4 lg:sticky lg:top-4">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {s.conta}
        </h2>

        {comanda.itens.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{s.vazia}</p>
        ) : (
          <ul className="divide-y divide-border">
            {comanda.itens.map((i) => (
              <li key={i.id} className="py-2.5 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      i.estado === "CANCELADO" ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {i.quantidade}× {i.nome}
                  </p>
                  {i.observacao && (
                    <p className="text-[11px] text-muted-foreground italic">{i.observacao}</p>
                  )}
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.estados[i.estado]}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">
                    {formatCurrency(i.quantidade * i.precoUnit)}
                  </p>
                  {aberta && i.estado === "PRONTO" && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => correr(() => mudarEstadoItem(i.id, "ENTREGUE"))}
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      <Check className="w-3 h-3" /> {s.entregar}
                    </button>
                  )}
                  {aberta && (i.estado === "LANCADO" || i.estado === "EM_PREPARO") && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => correr(() => mudarEstadoItem(i.id, "CANCELADO"))}
                      className="text-[11px] text-destructive hover:underline inline-flex items-center gap-0.5"
                    >
                      <Trash2 className="w-3 h-3" /> {s.cancelar}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-1.5 pt-2 border-t border-border text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>{s.subtotal}</span>
            <span>{formatCurrency(comanda.totais.subtotal)}</span>
          </div>
          {comanda.totais.servico > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{s.servico}</span>
              <span>{formatCurrency(comanda.totais.servico)}</span>
            </div>
          )}
          {comanda.totais.desconto > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{s.desconto}</span>
              <span>−{formatCurrency(comanda.totais.desconto)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-extrabold pt-1">
            <span>{s.total}</span>
            <span>{formatCurrency(comanda.totais.total)}</span>
          </div>
          {comanda.pessoas > 1 && (
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="w-3 h-3" /> {s.porPessoa} ({comanda.pessoas})
              </span>
              {/* As partes podem diferir num guarani — a divisão bate certo ao
                  cêntimo e a diferença fica visível em vez de escondida. */}
              <span>{comanda.porPessoa.map((p) => formatCurrency(p)).join(" · ")}</span>
            </div>
          )}
        </div>

        {aberta ? (
          <div className="space-y-3 pt-2">
            <Button
              className="w-full gap-2"
              disabled={ocupado || porEnviar === 0}
              onClick={() =>
                correr(async () => {
                  const r = await enviarParaPreparo(comanda.id);
                  toast.success(`${r?.enviados ?? 0} ${s.enviados}`);
                })
              }
            >
              {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {s.enviar} {porEnviar > 0 && `(${porEnviar})`}
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="servico" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {s.servico} %
                </Label>
                <Input
                  id="servico"
                  type="number"
                  min={0}
                  max={30}
                  value={servicoPct}
                  onChange={(e) => setServicoPct(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="desconto" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {s.desconto}
                </Label>
                <Input
                  id="desconto"
                  type="number"
                  min={0}
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              disabled={ocupado || comanda.itens.length === 0}
              onClick={() =>
                correr(async () => {
                  await fecharComanda(comanda.id, { servicoPct, desconto });
                  toast.success(s.fechada);
                  router.push(`/${tenantId}/salao`);
                })
              }
            >
              {s.fechar}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center pt-2">
            {s.fechadaEm}{" "}
            {comanda.fechadaEm ? new Date(comanda.fechadaEm).toLocaleString() : ""}
          </p>
        )}
      </div>
    </div>
  );
}
