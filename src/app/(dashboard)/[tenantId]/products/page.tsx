import { getProducts } from "@/app/actions/product";
import { ProductSheet } from "@/components/ProductSheet";
import { ProductList } from "@/components/ProductList";
import { PageHeader } from "@/components/ui/page-header";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;

  const products = await getProducts();

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Produtos"
        subtitle="Gerencie o catálogo e o estoque de produtos"
        actions={<ProductSheet tenantId={tenantId} />}
      />

      <ProductList products={products} tenantId={tenantId} />
    </div>
  );
}

