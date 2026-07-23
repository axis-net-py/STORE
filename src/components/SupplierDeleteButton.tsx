"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteSupplier } from "@/app/actions/supplier";

/**
 * Excluir fornecedor direto da listagem, sem abrir a ficha de edição.
 * Fornecedor com histórico fiscal é arquivado pela action, não apagado.
 */
export function SupplierDeleteButton({ supplier }: { supplier: { id: string; name: string } }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (loading) return;
    if (
      !window.confirm(
        `Excluir "${supplier.name}"? Se já tiver faturas ou pedidos vinculados, será arquivado em vez de apagado (o histórico fiscal é preservado).`
      )
    )
      return;

    setLoading(true);
    try {
      const res = await deleteSupplier(supplier.id);
      if (res?.archived) {
        alert(
          "Fornecedor arquivado: ele tem faturas ou pedidos vinculados, então o cadastro foi desativado para preservar o histórico fiscal."
        );
      }
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Erro ao excluir fornecedor");
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
      title="Excluir fornecedor"
      className="h-8 px-2.5 text-xs flex items-center gap-1.5 bg-card hover:bg-destructive/10 hover:text-destructive border-border"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
      )}
      <span>Excluir</span>
    </Button>
  );
}
