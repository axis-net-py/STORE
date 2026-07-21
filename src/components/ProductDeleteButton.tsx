"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteProduct } from "@/app/actions/product";

/**
 * Excluir produto direto da listagem, sem abrir a ficha de edição.
 * Produto com histórico fiscal é arquivado pela action, não apagado.
 */
export function ProductDeleteButton({ product }: { product: { id: string; name: string } }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (loading) return;
    if (
      !window.confirm(
        `Excluir "${product.name}"? Se ele já tiver faturas ou movimentações de estoque, será arquivado em vez de apagado (o histórico fiscal é preservado).`
      )
    )
      return;

    setLoading(true);
    try {
      const res = await deleteProduct(product.id);
      if (res?.archived) {
        alert(
          "Produto arquivado: ele tem faturas ou movimentações vinculadas, então o cadastro foi desativado para preservar o histórico fiscal."
        );
      }
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Erro ao excluir produto");
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
      title="Excluir produto"
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
