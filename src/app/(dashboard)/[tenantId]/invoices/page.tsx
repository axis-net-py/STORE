import { getInvoices } from "@/app/actions/invoice";
import { CommercialInvoiceSheet } from "@/components/CommercialInvoiceSheet";
import { AIInvoiceImporter } from "@/components/AIInvoiceImporter";
import { InvoiceList } from "@/components/InvoiceList";
import { PageHeader } from "@/components/ui/page-header";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

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

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <AIInvoiceImporter />
            <CommercialInvoiceSheet tenantId={tenantId} />
          </>
        }
      />

      <InvoiceList invoices={invoices} tenantId={tenantId} />
    </div>
  );
}
