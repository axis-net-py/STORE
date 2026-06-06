import { getProducts } from "@/app/actions/product";
import { ProductSheet } from "@/components/ProductSheet";
import { ProductList } from "@/components/ProductList";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;

  const products = await getProducts();

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Produtos</h1>
          <p className="text-muted-foreground text-sm">Gerencie o estoque de produtos</p>
        </div>
        <div className="self-start sm:self-auto">
          <ProductSheet tenantId={tenantId} />
        </div>
      </div>

      <ProductList products={products} tenantId={tenantId} />
    </div>
  );
}

