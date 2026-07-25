"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Calendar } from "lucide-react";
import { createContract, updateContract, deleteContract } from "@/modules/farm/actions/contrato";
import type { Contract, Harvest } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";

const translations = {
  pt: {
    newContract: "Novo Contrato",
    editContract: "Editar Contrato",
    addInfo: "Cadastre as informações da venda de grãos.",
    updateInfo: "Atualize os dados da venda de grãos.",
    number: "Número do Contrato",
    silo: "Silo Comprador (Destino)",
    grain: "Tipo de Grão",
    quantity: "Quantidade",
    unit: "Unidade",
    price: "Preço Unitário",
    currency: "Moeda",
    deliveryDate: "Data Estimada de Entrega",
    status: "Status do Contrato",
    notes: "Observações",
    harvest: "Vincular a Safra",
    none: "Nenhuma (Sem vínculo)",
    cancel: "Cancelar",
    save: "Registrar Contrato",
    updating: "Salvando...",
    delete: "Excluir",
    confirmDelete: "Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.",
    successSave: "Contrato salvo com sucesso!",
    errorSave: "Erro ao salvar contrato.",
    errorDelete: "Erro ao excluir contrato."
  },
  es: {
    newContract: "Nuevo Contrato",
    editContract: "Editar Contrato",
    addInfo: "Registre los datos de la venta de granos.",
    updateInfo: "Actualice los datos de la venta de granos.",
    number: "Número de Contrato",
    silo: "Silo Comprador (Destino)",
    grain: "Tipo de Grano",
    quantity: "Cantidad",
    unit: "Unidad",
    price: "Precio Unitario",
    currency: "Moneda",
    deliveryDate: "Fecha Estimada de Entrega",
    status: "Estado del Contrato",
    notes: "Observaciones",
    harvest: "Vincular a Cosecha",
    none: "Ninguna (Sin vínculo)",
    cancel: "Cancelar",
    save: "Registrar Contrato",
    updating: "Guardando...",
    delete: "Eliminar",
    confirmDelete: "¿Está seguro que deseja eliminar este contrato? Esta acción no se puede deshacer.",
    successSave: "¡Contrato guardado con éxito!",
    errorSave: "Error al guardar el contrato.",
    errorDelete: "Error al eliminar el contrato."
  }
};

export function ContractSheet({
  tenantId,
  contract,
  harvests = [],
  onSuccess,
}: {
  tenantId: string;
  contract?: Contract;
  harvests?: Harvest[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const { language } = useLanguage();
  const currentLang = (language === 'es' || language === 'pt') ? language : 'pt';
  const t = translations[currentLang];

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!contract;

  const [contractNumber, setContractNumber] = useState(contract?.contractNumber ?? "");
  const [siloName, setSiloName] = useState(contract?.siloName ?? "");
  const [grainType, setGrainType] = useState(contract?.grainType ?? "");
  const [quantity, setQuantity] = useState(contract?.quantity ? Number(contract.quantity) : 0);
  const [unit, setUnit] = useState(contract?.unit ?? "TON");
  const [pricePerUnit, setPricePerUnit] = useState(contract?.pricePerUnit ? Number(contract.pricePerUnit) : 0);
  const [currency, setCurrency] = useState(contract?.currency ?? "USD");
  const [status, setStatus] = useState(contract?.status ?? "ACTIVE");
  const [harvestId, setHarvestId] = useState(contract?.harvestId ?? "none");
  const [notes, setNotes] = useState(contract?.notes ?? "");
  
  // Format Date for HTML Input
  const formattedDate = contract?.deliveryDate 
    ? new Date(contract.deliveryDate).toISOString().split('T')[0]
    : "";
  const [deliveryDate, setDeliveryDate] = useState(formattedDate);

  async function handleDelete() {
    if (!contract) return;
    const confirmDelete = window.confirm(t.confirmDelete);
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await deleteContract(contract.id);
      setOpen(false);
      onSuccess?.();
      router.refresh();
    } catch (err: any) {
      alert(err.message || t.errorDelete);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contractNumber || !siloName || !grainType || quantity <= 0 || pricePerUnit <= 0) return;

    setLoading(true);
    try {
      const payload = {
        contractNumber,
        siloName,
        grainType,
        quantity,
        unit,
        pricePerUnit,
        currency: currency as 'USD' | 'PYG' | 'BRL',
        status,
        deliveryDate: deliveryDate || null,
        notes: notes || null,
        harvestId: harvestId === "none" ? null : harvestId,
      };

      if (isEdit && contract) {
        await updateContract(contract.id, payload);
      } else {
        await createContract(payload);
      }
      setOpen(false);
      onSuccess?.();
      router.refresh();
    } catch (err: any) {
      alert(err.message || t.errorSave);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="axis-btn-primary min-h-[44px] md:h-[32px] px-6 md:px-4 text-[14px] md:text-[13px] flex items-center justify-center font-bold shadow-md cursor-pointer">
          {isEdit ? t.delete.replace("Eliminar", "Editar").replace("Excluir", "Editar") : t.newContract}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[65vw] w-[95vw] glass-pop-up p-0 overflow-hidden max-h-[90vh]">
        <DialogHeader className="text-left space-y-1 p-6 border-b border-border bg-muted/30">
          <DialogTitle className="text-[18px] font-bold tracking-tight text-foreground">
            {isEdit ? t.editContract : t.newContract}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground font-medium">
            {isEdit ? t.updateInfo : t.addInfo}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[65vh]">
          {/* Main info row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-extrabold">{t.number}</Label>
              <Input
                required
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                placeholder="Ex: C-2026-001"
                className="bg-background border-border text-[13px] min-h-[44px] md:h-[40px] rounded-[8px] font-medium shadow-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-extrabold">{t.silo}</Label>
              <Input
                required
                value={siloName}
                onChange={(e) => setSiloName(e.target.value)}
                placeholder="Ex: Silo Coamo, Lar, Cargill"
                className="bg-background border-border text-[13px] min-h-[44px] md:h-[40px] rounded-[8px] font-medium shadow-sm"
              />
            </div>
          </div>

          {/* Grain, Qty and Unit */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-extrabold">{t.grain}</Label>
              <Input
                required
                value={grainType}
                onChange={(e) => setGrainType(e.target.value)}
                placeholder="Ex: Soja, Milho, Trigo"
                className="bg-background border-border text-[13px] min-h-[44px] md:h-[40px] rounded-[8px] font-medium shadow-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-extrabold">{t.quantity}</Label>
              <Input
                type="number"
                step="0.01"
                required
                value={quantity || ""}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="bg-background border-border text-[13px] min-h-[44px] md:h-[40px] rounded-[8px] font-medium shadow-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-extrabold">{t.unit}</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="bg-background border-border text-[13px] min-h-[44px] md:h-[40px] rounded-[8px]">
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="TON" className="text-[12px]">Toneladas (t)</SelectItem>
                  <SelectItem value="BAG" className="text-[12px]">Sacas (60kg)</SelectItem>
                  <SelectItem value="KG" className="text-[12px]">Quilos (kg)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pricing, Currency and Delivery Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-extrabold">{t.price}</Label>
              <Input
                type="number"
                step="0.01"
                required
                value={pricePerUnit || ""}
                onChange={(e) => setPricePerUnit(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="bg-background border-border text-[13px] min-h-[44px] md:h-[40px] rounded-[8px] font-medium shadow-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-extrabold">{t.currency}</Label>
              <Select value={currency} onValueChange={(val) => setCurrency(val as 'USD' | 'PYG' | 'BRL')}>
                <SelectTrigger className="bg-background border-border text-[13px] min-h-[44px] md:h-[40px] rounded-[8px]">
                  <SelectValue placeholder="Moeda" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="USD" className="text-[12px]">Dólar (USD)</SelectItem>
                  <SelectItem value="BRL" className="text-[12px]">Real (BRL)</SelectItem>
                  <SelectItem value="PYG" className="text-[12px]">Guarani (PYG)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-extrabold">{t.deliveryDate}</Label>
              <div className="relative">
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="bg-background border-border text-[13px] min-h-[44px] md:h-[40px] rounded-[8px] font-medium shadow-sm pl-3 pr-10"
                />
              </div>
            </div>
          </div>

          {/* Harvest & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-extrabold">{t.harvest}</Label>
              <Select value={harvestId} onValueChange={setHarvestId}>
                <SelectTrigger className="bg-background border-border text-[13px] min-h-[44px] md:h-[40px] rounded-[8px]">
                  <SelectValue placeholder="Selecione a Safra" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="none" className="text-[12px]">{t.none}</SelectItem>
                  {harvests.map((h) => (
                    <SelectItem key={h.id} value={h.id} className="text-[12px]">{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-extrabold">{t.status}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-background border-border text-[13px] min-h-[44px] md:h-[40px] rounded-[8px]">
                  <SelectValue placeholder="Selecione status" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="ACTIVE" className="text-[12px]">Ativo (Em vigor)</SelectItem>
                  <SelectItem value="COMPLETED" className="text-[12px]">Concluído (Entregue)</SelectItem>
                  <SelectItem value="CANCELLED" className="text-[12px]">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-primary uppercase tracking-widest font-extrabold">{t.notes}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="..."
              rows={3}
              className="bg-background border-border text-[13px] rounded-[8px] font-medium shadow-sm resize-none"
            />
          </div>

          {/* Action buttons */}
          <div className="mt-4 pt-6 border-t border-border flex justify-between items-center gap-3">
            <div>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-5 min-h-[44px] rounded-[8px] text-[14px] font-bold disabled:opacity-50 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  {t.delete}
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-5 min-h-[44px] rounded-[8px] text-[14px] font-bold text-muted-foreground hover:bg-muted transition-all cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-primary text-primary-foreground px-6 min-h-[44px] rounded-[8px] hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-[14px] font-bold disabled:opacity-50 shadow-md active:scale-95 cursor-pointer"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin text-secondary" />}
                {loading ? t.updating : t.save}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
