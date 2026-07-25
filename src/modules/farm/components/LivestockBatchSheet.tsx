"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { createLivestockBatch, updateLivestockBatch, deleteLivestockBatch } from "@/modules/farm/actions/livestock";
import type { LivestockBatch } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    editTrigger: "Editar",
    newTrigger: "Novo Lote",
    editTitle: "Editar Lote",
    newTitle: "Novo Lote de Gado",
    description: "Cadastre lotes de animais da fazenda.",
    name: "Nome do Lote",
    namePlaceholder: "Ex: Lote 1 - Novilhas",
    category: "Categoria",
    catBezerro: "Bezerro",
    catNovilho: "Novilho",
    catVaca: "Vaca",
    catTouro: "Touro",
    catBoi: "Boi",
    quantity: "Quantidade (cabeças)",
    averageWeight: "Peso Médio (kg)",
    location: "Piquete/Pasto Atual",
    locationPlaceholder: "Ex: Piquete 3",
    status: "Status",
    statusActive: "Ativo",
    statusSold: "Vendido",
    delete: "Excluir",
    cancel: "Cancelar",
    saving: "Salvando...",
    update: "Atualizar",
    register: "Registrar Lote",
    deleteConfirm: "Tem certeza que deseja excluir este lote? Esta ação não pode ser desfeita.",
    deleteErr: "Erro ao excluir lote",
    saveErr: "Erro ao salvar lote",
  },
  es: {
    editTrigger: "Editar",
    newTrigger: "Nuevo Lote",
    editTitle: "Editar Lote",
    newTitle: "Nuevo Lote de Ganado",
    description: "Registre lotes de animales de la granja.",
    name: "Nombre del Lote",
    namePlaceholder: "Ej: Lote 1 - Novillas",
    category: "Categoría",
    catBezerro: "Ternero",
    catNovilho: "Novillo",
    catVaca: "Vaca",
    catTouro: "Toro",
    catBoi: "Buey",
    quantity: "Cantidad (cabezas)",
    averageWeight: "Peso Promedio (kg)",
    location: "Potrero/Pastura Actual",
    locationPlaceholder: "Ej: Potrero 3",
    status: "Estado",
    statusActive: "Activo",
    statusSold: "Vendido",
    delete: "Eliminar",
    cancel: "Cancelar",
    saving: "Guardando...",
    update: "Actualizar",
    register: "Registrar Lote",
    deleteConfirm: "¿Está seguro que desea eliminar este lote? Esta acción no se puede deshacer.",
    deleteErr: "Error al eliminar lote",
    saveErr: "Error al guardar lote",
  },
} as const;

export function LivestockBatchSheet({ batch }: { batch?: LivestockBatch }) {
  const router = useRouter();
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!batch;

  const [name, setName] = useState(batch?.name ?? "");
  const [category, setCategory] = useState(batch?.category ?? "novilho");
  const [quantity, setQuantity] = useState(batch?.quantity != null ? String(batch.quantity) : "");
  const [averageWeight, setAverageWeight] = useState(batch?.averageWeight != null ? String(batch.averageWeight) : "");
  const [location, setLocation] = useState(batch?.location ?? "");
  const [status, setStatus] = useState(batch?.status ?? "ACTIVE");

  async function handleDelete() {
    if (!batch) return;
    const confirmDelete = window.confirm(s.deleteConfirm);
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await deleteLivestockBatch(batch.id);
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      alert(err.message || s.deleteErr);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !category || !quantity) return;

    setLoading(true);
    try {
      const payload = {
        name,
        category,
        quantity: Number(quantity),
        averageWeight: averageWeight ? Number(averageWeight) : undefined,
        location: location || undefined,
        status,
      };
      if (isEdit && batch) {
        await updateLivestockBatch(batch.id, payload);
      } else {
        await createLivestockBatch(payload);
      }
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      alert(err.message || s.saveErr);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="axis-btn-primary min-h-[44px] md:h-[32px] px-6 md:px-4 text-[14px] md:text-[13px] flex items-center justify-center font-bold shadow-md cursor-pointer">
          {isEdit ? s.editTrigger : s.newTrigger}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[50vw] w-[95vw] glass-pop-up p-0 overflow-hidden">
        <DialogHeader className="text-left space-y-1 p-6 border-b border-border bg-muted/30">
          <DialogTitle className="text-[18px] font-bold tracking-tight text-foreground">
            {isEdit ? s.editTitle : s.newTitle}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground font-medium">
            {s.description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.name}</Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={s.namePlaceholder}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.category}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="bezerro" className="text-[12px]">{s.catBezerro}</SelectItem>
                  <SelectItem value="novilho" className="text-[12px]">{s.catNovilho}</SelectItem>
                  <SelectItem value="vaca" className="text-[12px]">{s.catVaca}</SelectItem>
                  <SelectItem value="touro" className="text-[12px]">{s.catTouro}</SelectItem>
                  <SelectItem value="boi" className="text-[12px]">{s.catBoi}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.quantity}</Label>
              <Input
                type="number"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.averageWeight}</Label>
              <Input
                type="number"
                step="0.1"
                value={averageWeight}
                onChange={(e) => setAverageWeight(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.location}</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={s.locationPlaceholder}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.status}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="ACTIVE" className="text-[12px]">{s.statusActive}</SelectItem>
                  <SelectItem value="SOLD" className="text-[12px]">{s.statusSold}</SelectItem>
                </SelectContent>
              </Select>
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
                  {s.delete}
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 h-[40px] rounded-[8px] text-[14px] font-semibold text-muted-foreground hover:bg-muted transition-all"
              >
                {s.cancel}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-primary text-primary-foreground px-6 h-[40px] rounded-[8px] hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-[14px] font-bold disabled:opacity-50 shadow-md active:scale-95"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin text-secondary" />}
                {loading ? s.saving : isEdit ? s.update : s.register}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
