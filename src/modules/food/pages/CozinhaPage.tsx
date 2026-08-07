import { getLocale } from "@/lib/get-locale";
import { PageHeader } from "@/components/ui/page-header";
import { getCozinha } from "@/modules/food/actions/cardapio";
import { CozinhaEcra } from "@/modules/food/components/CozinhaEcra";
import { AREAS } from "@/modules/food/schemas";
import type { Area } from "@/modules/food/lib/comanda";

// Sem cache: este ecrã é o estado do serviço agora. Uma versão de há um minuto
// é pior do que não ter ecrã nenhum, porque parece atual.
export const dynamic = "force-dynamic";

const HEADER = {
  pt: { title: "Cozinha", subtitle: "O que está a ser feito, por ordem de espera" },
  es: { title: "Cocina", subtitle: "Lo que se está preparando, por orden de espera" },
} as const;

export default async function CozinhaPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const { area } = await searchParams;
  const filtro = AREAS.includes(area as never) ? (area as Area) : undefined;

  const itens = await getCozinha(filtro);
  const t = HEADER[await getLocale()];

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <CozinhaEcra itens={itens} area={filtro} />
    </div>
  );
}
