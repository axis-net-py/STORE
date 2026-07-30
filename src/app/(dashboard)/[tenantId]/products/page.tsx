import { getProducts } from "@/app/actions/product";
import { ProductSheet } from "@/components/ProductSheet";
import { ProductList } from "@/components/ProductList";
import { PageHeader } from "@/components/ui/page-header";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ProductsPage() {
  const t = await getTranslations("pages.products");
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;

  const products = await getProducts();

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={<ProductSheet tenantId={tenantId} />}
      />

      <ProductList products={products} tenantId={tenantId} />
    </div>
  );
}

