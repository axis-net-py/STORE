import { getLocale } from "@/lib/get-locale";
import { PageHeader } from "@/components/ui/page-header";
import { getCardapio, getProdutosForaDoCardapio } from "@/modules/food/actions/cardapio";
import { CardapioLista } from "@/modules/food/components/CardapioLista";

const HEADER = {
  pt: {
    title: "Cardápio",
    subtitle: "O que a casa serve, por secção, e onde cada coisa se prepara",
  },
  es: {
    title: "Carta",
    subtitle: "Lo que sirve la casa, por sección, y dónde se prepara cada cosa",
  },
} as const;

export default async function CardapioPage() {
  const [itens, disponiveis] = await Promise.all([
    getCardapio(),
    getProdutosForaDoCardapio(),
  ]);
  const t = HEADER[await getLocale()];

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <CardapioLista itens={itens} disponiveis={disponiveis} />
    </div>
  );
}
