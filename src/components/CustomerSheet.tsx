"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { createCustomer, updateCustomer, deleteCustomer } from "@/app/actions/customer";
import type { Customer } from "@prisma/client";

export function CustomerSheet({
  tenantId,
  customer,
  onSuccess,
}: {
  tenantId: string;
  customer?: Customer;
  onSuccess?: () => void;
}) {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!customer;

  const [name, setName] = useState(customer?.name ?? "");
  const [document, setDocument] = useState(customer?.document ?? "");
  const [documentType, setDocumentType] = useState(customer?.documentType ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [city, setCity] = useState(customer?.city ?? "");
  const [country, setCountry] = useState(customer?.country ?? "PY");
  const [category, setCategory] = useState(customer?.category ?? "fisica");
  const [isActive, setIsActive] = useState(customer?.isActive ?? true);

  async function handleDelete() {
    if (!customer) return;
    const confirmDelete = window.confirm(t("confirmDelete"));
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await deleteCustomer(customer.id);
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
    if (!name) return;

    setLoading(true);
    try {
      if (isEdit && customer) {
        await updateCustomer(customer.id, {
          name,
          document,
          documentType,
          email,
          phone,
          address,
          city,
          country,
          category,
          isActive,
        });
      } else {
        await createCustomer({
          name,
          document,
          documentType,
          email,
          phone,
          address,
          city,
          country,
          category,
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
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{t("documentLabel")}</Label>
              <Input
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                placeholder={t("documentPlaceholder")}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{t("documentType")}</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                  <SelectValue placeholder={t("selectDocumentType")} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="RUC" className="text-[12px]">RUC</SelectItem>
                  <SelectItem value="CI" className="text-[12px]">CI</SelectItem>
                  <SelectItem value="CPF" className="text-[12px]">CPF</SelectItem>
                  <SelectItem value="CNPJ" className="text-[12px]">CNPJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{t("category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                  <SelectValue placeholder={t("selectCategory")} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="fisica" className="text-[12px]">{t("fisica")}</SelectItem>
                  <SelectItem value="juridica" className="text-[12px]">{t("juridica")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{t("email")}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{t("phone")}</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("phonePlaceholder")}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{t("address")}</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t("addressPlaceholder")}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{t("city")}</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t("cityPlaceholder")}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{t("country")}</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                  <SelectValue placeholder={t("selectCountry")} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="PY" className="text-[12px]">{t("countryPY")}</SelectItem>
                  <SelectItem value="BR" className="text-[12px]">{t("countryBR")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <Label className="text-[13px]">{t("active")}</Label>
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
