import { getSuppliers } from "@/app/actions/supplier";
import { SupplierSheet } from "@/components/SupplierSheet";
import { SupplierList } from "@/components/SupplierList";
import { PageHeader } from "@/components/ui/page-header";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function SuppliersPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;

  const suppliers = await getSuppliers();

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Fornecedores"
        subtitle="Gerencie os fornecedores e parceiros comerciais"
        actions={<SupplierSheet tenantId={tenantId} />}
      />

      <SupplierList suppliers={suppliers} tenantId={tenantId} />
    </div>
  );
}
