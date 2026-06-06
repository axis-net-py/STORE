import { getSuppliers } from "@/app/actions/supplier";
import { SupplierSheet } from "@/components/SupplierSheet";
import { SupplierList } from "@/components/SupplierList";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function SuppliersPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;

  const suppliers = await getSuppliers();

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Fornecedores</h1>
          <p className="text-muted-foreground text-sm">Gerencie os fornecedores e parceiros comerciais</p>
        </div>
        <div className="self-start sm:self-auto">
          <SupplierSheet tenantId={tenantId} />
        </div>
      </div>

      <SupplierList suppliers={suppliers} tenantId={tenantId} />
    </div>
  );
}
