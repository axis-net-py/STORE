import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/get-locale";
import { PageHeader } from "@/components/ui/page-header";
import { getComanda } from "@/modules/food/actions/comanda";
import { getCardapio } from "@/modules/food/actions/cardapio";
import { ComandaDetalhe } from "@/modules/food/components/ComandaDetalhe";

const HEADER = {
  pt: { comanda: "Comanda", mesa: "Mesa", balcao: "Balcão", delivery: "Delivery" },
  es: { comanda: "Comanda", mesa: "Mesa", balcao: "Barra", delivery: "Delivery" },
} as const;

export default async function ComandaPage({
  params,
}: {
  params: Promise<{ tenantId: string; id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;

  const { id } = await params;
  const [comanda, cardapio] = await Promise.all([getComanda(id), getCardapio()]);
  const t = HEADER[await getLocale()];

  const onde =
    comanda.tipo === "MESA"
      ? `${t.mesa} ${comanda.mesa?.nome ?? ""}`
      : comanda.tipo === "BALCAO"
      ? t.balcao
      : t.delivery;

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={`${t.comanda} #${comanda.numero}`}
        subtitle={`${onde}${comanda.cliente ? ` · ${comanda.cliente.name}` : ""}`}
      />

      <ComandaDetalhe tenantId={tenantId} comanda={comanda} cardapio={cardapio} />
    </div>
  );
}
