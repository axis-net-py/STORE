"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteProfessional } from "@/modules/clinic/actions/professional";
import { useLanguage } from "@/components/language-provider";
import { toast } from "sonner";

const STRINGS = {
  pt: {
    del: "Excluir",
    title: "Excluir profissional",
    confirm: (name: string) =>
      `Excluir "${name}"? Se já tiver consultas vinculadas, será arquivado em vez de apagado (o histórico é preservado).`,
    archived:
      "Profissional arquivado: ele tem consultas vinculadas, então o cadastro foi desativado para preservar o histórico.",
    err: "Erro ao excluir profissional",
    deletedOk: "Profissional excluído com sucesso.",
  },
  es: {
    del: "Eliminar",
    title: "Eliminar profesional",
    confirm: (name: string) =>
      `¿Eliminar "${name}"? Si ya tiene consultas vinculadas, será archivado en lugar de eliminado (el historial se preserva).`,
    archived:
      "Profesional archivado: tiene consultas vinculadas, por eso el registro fue desactivado para preservar el historial.",
    err: "Error al eliminar profesional",
    deletedOk: "Profesional eliminado con éxito.",
  },
} as const;

/**
 * Excluir profissional direto da listagem, sem abrir a ficha de edição.
 * Profissional com consultas vinculadas é arquivado pela action, não apagado.
 */
export function ProfessionalDeleteButton({ professional }: { professional: { id: string; name: string } }) {
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (loading) return;
    if (!window.confirm(s.confirm(professional.name))) return;

    setLoading(true);
    try {
      const res = await deleteProfessional(professional.id);
      if (res?.archived) toast.info(s.archived);
      else toast.success(s.deletedOk);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || s.err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={handleDelete}
      title={s.title}
      className="h-8 px-2.5 text-xs flex items-center gap-1.5 bg-card hover:bg-destructive/10 hover:text-destructive border-border"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
      )}
      <span>{s.del}</span>
    </Button>
  );
}
