"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { useLanguage } from "@/components/language-provider";
import {
  adicionarAoCardapio, alternarDisponibilidade, removerDoCardapio,
} from "@/modules/food/actions/cardapio";
import type { ItemDoCardapio } from "@/modules/food/actions/cardapio";
import { AREAS } from "@/modules/food/schemas";

const STRINGS = {
  pt: {
    adicionar: "Pôr no cardápio",
    titulo: "Pôr um produto no cardápio",
    sub: "O produto já existe no catálogo. Aqui só se diz onde aparece no menu e onde se prepara.",
    produto: "Produto",
    escolher: "Escolha o produto",
    seccao: "Secção",
    seccaoDica: "Ex: Entradas, Pratos, Bebidas",
    ordem: "Ordem",
    area: "Prepara-se em",
    areaNota:
      "Itens preparados não descontam estoque — o que se consome são os ingredientes. \"Não se prepara\" (garrafas, embalados) desconta.",
    disponivel: "Disponível hoje",
    guardar: "Guardar",
    esgotado: "Esgotado",
    remover: "Tirar do cardápio",
    confirmar: "Tirar este item do cardápio? O produto e o histórico de vendas mantêm-se.",
    vazio: "O cardápio está vazio. Ponha os produtos que a casa serve.",
    semProdutos: "Todos os produtos ativos já estão no cardápio.",
    guardado: "Cardápio atualizado.",
    erro: "Não foi possível guardar.",
    areas: { COZINHA: "Cozinha", BAR: "Bar", CHAPA: "Chapa", SEM_PREPARO: "Não se prepara" },
  },
  es: {
    adicionar: "Poner en la carta",
    titulo: "Poner un producto en la carta",
    sub: "El producto ya existe en el catálogo. Aquí solo se dice dónde aparece en el menú y dónde se prepara.",
    produto: "Producto",
    escolher: "Elija el producto",
    seccao: "Sección",
    seccaoDica: "Ej: Entradas, Platos, Bebidas",
    ordem: "Orden",
    area: "Se prepara en",
    areaNota:
      "Los ítems preparados no descuentan stock — lo que se consume son los ingredientes. \"No se prepara\" (botellas, envasados) sí descuenta.",
    disponivel: "Disponible hoy",
    guardar: "Guardar",
    esgotado: "Agotado",
    remover: "Sacar de la carta",
    confirmar: "¿Sacar este ítem de la carta? El producto y el historial de ventas se mantienen.",
    vazio: "La carta está vacía. Ponga los productos que sirve la casa.",
    semProdutos: "Todos los productos activos ya están en la carta.",
    guardado: "Carta actualizada.",
    erro: "No se pudo guardar.",
    areas: { COZINHA: "Cocina", BAR: "Barra", CHAPA: "Plancha", SEM_PREPARO: "No se prepara" },
  },
} as const;

type Produto = { id: string; name: string; price: unknown; sku: string };

export function CardapioLista({
  itens,
  disponiveis,
}: {
  itens: ItemDoCardapio[];
  disponiveis: Produto[];
}) {
  const { language } = useLanguage();
  const s = STRINGS[language === "es" ? "es" : "pt"];
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [productId, setProductId] = useState("");
  const [seccao, setSeccao] = useState("");
  const [ordem, setOrdem] = useState("0");
  const [area, setArea] = useState<(typeof AREAS)[number]>("COZINHA");

  // As secções já usadas viram sugestões: sem isto cada empregado escreve
  // "Bebidas", "bebidas" e "Bebida", e o menu parte-se em três.
  const seccoesUsadas = [...new Set(itens.map((i) => i.seccao))];

  async function correr(fn: () => Promise<unknown>) {
    setOcupado(true);
    try {
      await fn();
      toast.success(s.guardado);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || s.erro);
    } finally {
      setOcupado(false);
    }
  }

  const porSeccao = new Map<string, ItemDoCardapio[]>();
  for (const i of itens) {
    if (!porSeccao.has(i.seccao)) porSeccao.set(i.seccao, []);
    porSeccao.get(i.seccao)!.push(i);
  }

  return (
    <div className="space-y-5">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> {s.adicionar}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{s.titulo}</DialogTitle>
            <DialogDescription>{s.sub}</DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await correr(async () => {
                await adicionarAoCardapio({ productId, seccao, ordem, area, disponivel: true });
                setOpen(false);
                setProductId("");
                setSeccao("");
              });
            }}
          >
            <div className="space-y-2">
              <Label>{s.produto}</Label>
              {disponiveis.length === 0 ? (
                <p className="text-sm text-muted-foreground">{s.semProdutos}</p>
              ) : (
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder={s.escolher} /></SelectTrigger>
                  <SelectContent>
                    {disponiveis.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {formatCurrency(Number(p.price))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-[1fr_90px] gap-3">
              <div className="space-y-2">
                <Label htmlFor="seccao">{s.seccao}</Label>
                <Input
                  id="seccao"
                  required
                  list="seccoes-usadas"
                  value={seccao}
                  onChange={(e) => setSeccao(e.target.value)}
                  placeholder={s.seccaoDica}
                />
                <datalist id="seccoes-usadas">
                  {seccoesUsadas.map((x) => <option key={x} value={x} />)}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ordem">{s.ordem}</Label>
                <Input
                  id="ordem"
                  type="number"
                  min={0}
                  value={ordem}
                  onChange={(e) => setOrdem(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{s.area}</Label>
              <Select value={area} onValueChange={(v) => setArea(v as typeof area)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a}>{s.areas[a]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Esta escolha mexe no controlo de estoque do produto. Dizê-lo
                  aqui torna-a uma decisão informada em vez de um efeito que se
                  descobre no dia em que a venda é recusada. */}
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {s.areaNota}
              </p>
            </div>

            <Button type="submit" disabled={ocupado || !productId} className="w-full gap-2">
              {ocupado && <Loader2 className="w-4 h-4 animate-spin" />}
              {s.guardar}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {itens.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {s.vazio}
        </div>
      ) : (
        [...porSeccao.entries()].map(([seccaoNome, doGrupo]) => (
          <section key={seccaoNome} className="space-y-2">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-primary">
              {seccaoNome}
            </h2>
            <ul className="rounded-xl border border-border bg-card divide-y divide-border">
              {doGrupo.map((i) => (
                <li key={i.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${!i.disponivel ? "text-muted-foreground" : ""}`}>
                      {i.nome}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatCurrency(i.preco)} · {s.areas[i.area]}
                      {!i.disponivel && ` · ${s.esgotado}`}
                    </p>
                  </div>

                  <Switch
                    checked={i.disponivel}
                    disabled={ocupado}
                    aria-label={s.disponivel}
                    onCheckedChange={() => correr(() => alternarDisponibilidade(i.id))}
                  />

                  <button
                    type="button"
                    disabled={ocupado}
                    aria-label={s.remover}
                    onClick={() => {
                      if (window.confirm(s.confirmar)) correr(() => removerDoCardapio(i.id));
                    }}
                    className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
