"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { createProduct, updateProduct, deleteProduct } from "@/app/actions/product";
import type { Product } from "@prisma/client";

export function ProductSheet({
  tenantId,
  product,
  onSuccess,
}: {
  tenantId: string;
  product?: Product;
  onSuccess?: () => void;
}) {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!product;

  const [sku, setSku] = useState(product?.sku ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product?.price ? Number(product.price) : 0);
  const [cost, setCost] = useState(product?.cost ? Number(product.cost) : 0);
  const [unit, setUnit] = useState(product?.unit ?? "un");
  const [minStock, setMinStock] = useState(product?.minStock ? Number(product.minStock) : 0);
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [tags, setTags] = useState(product?.tags ?? "");
  const [isService, setIsService] = useState(product?.isService ?? false);
  const [currency, setCurrency] = useState<"PYG" | "USD" | "BRL">(product?.currency ?? "PYG");

  async function handleDelete() {
    if (!product) return;
    const confirmDelete = window.confirm(t("confirmDelete"));
    if (!confirmDelete) return;

    setLoading(true);
    try {
      const res = await deleteProduct(product.id);
      if (res?.archived) {
        alert(t("archived"));
      }
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      alert(err.message || t("deleteError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sku || !name) return;

    setLoading(true);
    try {
      if (isEdit && product) {
         await updateProduct(product.id, {
          sku,
          name,
          price,
          cost,
          unit,
          minStock,
          isActive,
          tags,
          isService,
          currency,
        });
      } else {
        await createProduct({
          sku,
          name,
          price,
          cost,
          unit,
          minStock,
          tags,
          isService,
          currency,
        });
      }
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      alert(err.message || t("saveError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="axis-btn-primary min-h-[44px] md:h-[32px] px-6 md:px-4 text-[14px] md:text-[13px] flex items-center justify-center font-bold shadow-md cursor-pointer">
          {isEdit ? tc("edit") : t("new")}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[75vw] w-[95vw] glass-pop-up p-0 overflow-hidden">
        <DialogHeader className="text-left space-y-1 p-6 border-b border-border bg-muted/30">
          <DialogTitle className="text-[18px] font-bold tracking-tight text-foreground">
            {isEdit ? t("editTitle") : t("new")}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground font-medium">
            {isEdit ? t("editDescription") : t("newDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{t("sku")}</Label>
              <Input
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder={t("skuPlaceholder")}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{t("category")}</Label>
              <Select
                value={isService ? "service" : "product"}
                onValueChange={(val) => setIsService(val === "service")}
              >
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[8px]">
                  <SelectItem value="product">{t("kindProduct")}</SelectItem>
                  <SelectItem value="service">{t("kindService")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{t("currency")}</Label>
              <Select
                value={currency}
                onValueChange={(val: "PYG" | "USD" | "BRL") => setCurrency(val)}
              >
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[8px]">
                  <SelectItem value="PYG">PYG (Gs)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="BRL">BRL (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{t("unit")}</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={t("unitPlaceholder")}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{tc("name")}</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{t("priceLabel", { currency })}</Label>
              <Input
                type="number"
                required
                min={0}
                step={currency === "PYG" ? "1" : "0.01"}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                placeholder={t("pricePlaceholder")}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{t("costLabel", { currency })}</Label>
              <Input
                type="number"
                required
                min={0}
                step={currency === "PYG" ? "1" : "0.01"}
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
                placeholder={t("costPlaceholder")}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {!isService && (
              <div className="space-y-2">
                <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{t("minStock")}</Label>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  value={minStock}
                  onChange={(e) => setMinStock(Number(e.target.value))}
                  placeholder={t("minStockPlaceholder")}
                  className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
                />
              </div>
            )}
            <div className={`space-y-2 flex items-center gap-2 ${isService ? 'pt-2' : 'pt-6'}`}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <Label className="text-[13px]">{t("active")}</Label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{t("tagsLabel")}</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={t("tagsPlaceholder")}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="mt-4 pt-6 border-t border-border flex justify-between items-center gap-3">
            <div>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 h-[40px] rounded-[8px] text-[14px] font-bold disabled:opacity-50 shadow-md active:scale-95 transition-all"
                >
                  {tc("delete")}
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 h-[40px] rounded-[8px] text-[14px] font-semibold text-muted-foreground hover:bg-muted transition-all"
              >
                {tc("cancel")}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-primary text-primary-foreground px-6 h-[40px] rounded-[8px] hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-[14px] font-bold disabled:opacity-50 shadow-md active:scale-95"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin text-secondary" />}
                {loading ? tc("saving") : isEdit ? t("update") : t("submit")}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
