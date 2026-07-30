import { getSuppliers } from "@/app/actions/supplier";
import { SupplierSheet } from "@/components/SupplierSheet";
import { SupplierList } from "@/components/SupplierList";
import { PageHeader } from "@/components/ui/page-header";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function SuppliersPage() {
  const t = await getTranslations("pages.suppliers");
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;

  const suppliers = await getSuppliers();

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={<SupplierSheet tenantId={tenantId} />}
      />

      <SupplierList suppliers={suppliers} tenantId={tenantId} />
    </div>
  );
}
