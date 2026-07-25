import { assertModuloAtivo } from "@/modules/guard";

export default async function Layout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  await assertModuloAtivo(tenantId, "talhoes");
  return <>{children}</>;
}
