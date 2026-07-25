import { assertModuloAtivo } from "@/modules/guard";

// Fecha o URL quando o módulo `store` não está ativo para este cliente.
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  await assertModuloAtivo(tenantId, "orders");
  return <>{children}</>;
}
