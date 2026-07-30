import { getCustomers } from "@/app/actions/customer";
import { CustomerSheet } from "@/components/CustomerSheet";
import { CustomerList } from "@/components/CustomerList";
import { PageHeader } from "@/components/ui/page-header";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function CustomersPage() {
  const t = await getTranslations("pages.customers");
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;

  const customers = await getCustomers();

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={<CustomerSheet tenantId={tenantId} />}
      />

      <CustomerList customers={customers} tenantId={tenantId} />
    </div>
  );
}
