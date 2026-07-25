"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteProduct } from "@/app/actions/product";

/**
 * Excluir produto direto da listagem, sem abrir a ficha de edição.
 * Produto com histórico fiscal é arquivado pela action, não apagado.
 */
export function ProductDeleteButton({ product }: { product: { id: string; name: string } }) {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (loading) return;
    if (
      !window.confirm(
        t("confirmDeleteNamed", { name: product.name })
      )
    )
      return;

    setLoading(true);
    try {
      const res = await deleteProduct(product.id);
      if (res?.archived) {
        alert(
          t("archived")
        );
      }
      router.refresh();
    } catch (err: any) {
      alert(err.message || t("deleteError"));
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
      title={t("deleteTitle")}
      className="h-8 px-2.5 text-xs flex items-center gap-1.5 bg-card hover:bg-destructive/10 hover:text-destructive border-border"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
      )}
      <span>{tc("delete")}</span>
    </Button>
  );
}
