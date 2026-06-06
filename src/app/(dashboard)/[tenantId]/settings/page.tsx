import { redirect } from "next/navigation";

export default async function SettingsRootPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  redirect(`/${tenantId}/settings/team`);
}
