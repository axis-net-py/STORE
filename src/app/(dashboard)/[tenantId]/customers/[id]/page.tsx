import { notFound } from "next/navigation";
import { moduloAtivo } from "@/modules/guard";
import PatientDetailPage from "@/modules/clinic/pages/PatientDetailPage";

/**
 * Ficha detalhada do cliente. Hoje só o módulo clinic a fornece — é a ficha do
 * paciente, com data de nascimento, observações de saúde e marcações. Para
 * quem não tem o módulo, esta rota não existe (que é o comportamento atual do
 * store e do farm, onde a página nunca chegou a ser construída).
 */
export default async function Page(props: { params: Promise<{ tenantId: string; id: string }> }) {
  const { tenantId } = await props.params;
  if (!(await moduloAtivo(tenantId, "clinic"))) notFound();
  return <PatientDetailPage {...props} />;
}
