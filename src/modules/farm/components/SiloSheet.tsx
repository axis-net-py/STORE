"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { createSilo, updateSilo, deleteSilo } from "@/modules/farm/actions/silo";
import type { Silo } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    edit: "Editar",
    newSilo: "Novo Silo",
    editTitle: "Editar Silo",
    description: "Cadastre os silos de armazenamento próprios da fazenda.",
    name: "Nome",
    namePlaceholder: "Ex: Silo 1 - Sede",
    capacity: "Capacidade",
    unit: "Unidade",
    ton: "Toneladas",
    bag: "Sacas",
    kg: "Quilos",
    deleteConfirm: "Tem certeza que deseja excluir este silo? Esta ação não pode ser desfeita.",
    deleteErr: "Erro ao excluir silo",
    saveErr: "Erro ao salvar silo",
    delete: "Excluir",
    cancel: "Cancelar",
    saving: "Salvando...",
    update: "Atualizar",
    register: "Registrar Silo",
  },
  es: {
    edit: "Editar",
    newSilo: "Nuevo Silo",
    editTitle: "Editar Silo",
    description: "Registre los silos de almacenamiento propios de la finca.",
    name: "Nombre",
    namePlaceholder: "Ej: Silo 1 - Sede",
    capacity: "Capacidad",
    unit: "Unidad",
    ton: "Toneladas",
    bag: "Bolsas",
    kg: "Kilos",
    deleteConfirm: "¿Está seguro que desea eliminar este silo? Esta acción no se puede deshacer.",
    deleteErr: "Error al eliminar silo",
    saveErr: "Error al guardar silo",
    delete: "Eliminar",
    cancel: "Cancelar",
    saving: "Guardando...",
    update: "Actualizar",
    register: "Registrar Silo",
  },
} as const;

export function SiloSheet({ silo }: { silo?: Silo }) {
  const router = useRouter();
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!silo;

  const [name, setName] = useState(silo?.name ?? "");
  const [capacity, setCapacity] = useState(silo?.capacity != null ? String(silo.capacity) : "");
  const [unit, setUnit] = useState(silo?.unit ?? "TON");

  async function handleDelete() {
    if (!silo) return;
    const confirmDelete = window.confirm(s.deleteConfirm);
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await deleteSilo(silo.id);
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
    if (!name || !capacity) return;

    setLoading(true);
    try {
      const payload = { name, capacity: Number(capacity), unit };
      if (isEdit && silo) {
        await updateSilo(silo.id, payload);
      } else {
        await createSilo(payload);
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
          {isEdit ? s.edit : s.newSilo}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[50vw] w-[95vw] glass-pop-up p-0 overflow-hidden">
        <DialogHeader className="text-left space-y-1 p-6 border-b border-border bg-muted/30">
          <DialogTitle className="text-[18px] font-bold tracking-tight text-foreground">
            {isEdit ? s.editTitle : s.newSilo}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground font-medium">
            {s.description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.capacity}</Label>
              <Input
                type="number"
                step="0.01"
                required
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.unit}</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="TON" className="text-[12px]">{s.ton}</SelectItem>
                  <SelectItem value="BAG" className="text-[12px]">{s.bag}</SelectItem>
                  <SelectItem value="KG" className="text-[12px]">{s.kg}</SelectItem>
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
