import { getCustomers } from "@/app/actions/customer";
import { CustomerSheet } from "@/components/CustomerSheet";
import { CustomerList } from "@/components/CustomerList";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function CustomersPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;

  const customers = await getCustomers();

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Clientes</h1>
          <p className="text-muted-foreground text-sm">Gerencie os clientes do sistema</p>
        </div>
        <div className="self-start sm:self-auto">
          <CustomerSheet tenantId={tenantId} />
        </div>
      </div>

      <CustomerList customers={customers} tenantId={tenantId} />
    </div>
  );
}
