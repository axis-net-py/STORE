import { getInvoices } from "@/app/actions/invoice";
import { CommercialInvoiceSheet } from "@/components/CommercialInvoiceSheet";
import { AIInvoiceImporter } from "@/components/AIInvoiceImporter";
import { InvoiceList } from "@/components/InvoiceList";
import { PageHeader } from "@/components/ui/page-header";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const t = await getTranslations("pages.invoices");
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;

  const { tenantId: paramTenantId } = await params;
  const resolvedTenantId = paramTenantId || tenantId;
  const invoices = await getInvoices();

  // Lido aqui e não dentro do formulário: a preferência é da empresa, não da
  // pessoa, e ler-se por acção obrigaria quem lança vendas a ter permissão
  // sobre as configurações fiscais.
  const empresa = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { electronicInvoicing: true },
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <AIInvoiceImporter />
            <CommercialInvoiceSheet
              tenantId={tenantId}
              faturacaoEletronica={!!empresa?.electronicInvoicing}
            />
          </>
        }
      />

      <InvoiceList invoices={invoices} tenantId={tenantId} />
    </div>
  );
}
