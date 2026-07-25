import { getLivestockBatches } from "@/modules/farm/actions/livestock";
import { LivestockBatchSheet } from "@/modules/farm/components/LivestockBatchSheet";
import { LivestockBatchList } from "@/modules/farm/components/LivestockBatchList";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/get-locale";

const HEADER = {
  pt: {
    title: "Rebanho",
    subtitle: "Lotes de gado, pesagem, sanidade e movimentação",
  },
  es: {
    title: "Ganado",
    subtitle: "Lotes de ganado, pesaje, sanidad y movimiento",
  },
} as const;

export default async function RebanhoPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;
  const locale = await getLocale();
  const t = HEADER[locale];

  const batches = await getLivestockBatches();

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
          <p className="text-muted-foreground text-sm">{t.subtitle}</p>
        </div>
        <div className="self-start sm:self-auto">
          <LivestockBatchSheet />
        </div>
      </div>

      <LivestockBatchList batches={batches} tenantId={tenantId} />
    </div>
  );
}
