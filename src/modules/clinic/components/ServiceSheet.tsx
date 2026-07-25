"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { createService, updateService, deleteService } from "@/modules/clinic/actions/service";
import type { Service } from "@prisma/client";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { COMMON } from "@/lib/ui-strings";

const STRINGS = {
  pt: {
    newItem: "Novo Serviço",
    editItem: "Editar Serviço",
    editSubtitle: "Atualize os dados do serviço",
    newSubtitle: "Cadastre um serviço agendável (consulta, sessão, procedimento).",
    confirmDelete: "Tem certeza que deseja excluir este serviço? Consultas vinculadas impedirão a exclusão.",
    deletedOk: "Serviço excluído com sucesso.",
    deleteErr: "Erro ao excluir serviço.",
    updatedOk: "Serviço atualizado com sucesso.",
    createdOk: "Serviço cadastrado com sucesso.",
    saveErr: "Erro ao salvar serviço.",
    namePlaceholder: "Ex: Consulta de avaliação",
    duration: "Duração (minutos)",
    price: "Preço (Gs.)",
    register: "Registrar Serviço",
    update: "Atualizar",
  },
  es: {
    newItem: "Nuevo Servicio",
    editItem: "Editar Servicio",
    editSubtitle: "Actualice los datos del servicio",
    newSubtitle: "Registre un servicio agendable (consulta, sesión, procedimiento).",
    confirmDelete: "¿Está seguro de eliminar este servicio? Las consultas vinculadas impedirán la eliminación.",
    deletedOk: "Servicio eliminado con éxito.",
    deleteErr: "Error al eliminar servicio.",
    updatedOk: "Servicio actualizado con éxito.",
    createdOk: "Servicio registrado con éxito.",
    saveErr: "Error al guardar servicio.",
    namePlaceholder: "Ej: Consulta de evaluación",
    duration: "Duración (minutos)",
    price: "Precio (Gs.)",
    register: "Registrar Servicio",
    update: "Actualizar",
  },
} as const;

export function ServiceSheet({
  tenantId,
  service,
  onSuccess,
}: {
  tenantId: string;
  service?: Service;
  onSuccess?: () => void;
}) {
  const { language } = useLanguage();
  const s = STRINGS[language];
  const c = COMMON[language];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!service;

  const [name, setName] = useState(service?.name ?? "");
  const [durationMin, setDurationMin] = useState(service ? String(service.durationMin) : "30");
  const [price, setPrice] = useState(service ? String(service.price) : "");
  const [active, setActive] = useState(service?.active ?? true);

  async function handleDelete() {
    if (!service) return;
    const confirmDelete = window.confirm(s.confirmDelete);
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await deleteService(service.id);
      toast.success(s.deletedOk);
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || s.deleteErr);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;

    setLoading(true);
    try {
      const data = { name, durationMin, price: price || "0", active };
      if (isEdit && service) {
        await updateService(service.id, data);
      } else {
        await createService(data);
      }
      toast.success(isEdit ? s.updatedOk : s.createdOk);
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || s.saveErr);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="axis-btn-primary min-h-[44px] md:h-[32px] px-6 md:px-4 text-[14px] md:text-[13px] flex items-center justify-center font-bold shadow-md cursor-pointer">
          {isEdit ? c.edit : s.newItem}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] w-[95vw] glass-pop-up p-0 overflow-hidden">
        <DialogHeader className="text-left space-y-1 p-6 border-b border-border bg-muted/30">
          <DialogTitle className="text-[18px] font-bold tracking-tight text-foreground">
            {isEdit ? s.editItem : s.newItem}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground font-medium">
            {isEdit ? s.editSubtitle : s.newSubtitle}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          <div className="space-y-2">
            <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{c.name}</Label>
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
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.duration}</Label>
              <Input
                required
                type="number"
                min={5}
                step={5}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.price}</Label>
              <Input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Ex: 150000"
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="serviceActive"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="serviceActive" className="text-[13px] cursor-pointer">{c.active}</Label>
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
                  {c.delete}
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 h-[40px] rounded-[8px] text-[14px] font-semibold text-muted-foreground hover:bg-muted transition-all"
              >
                {c.cancel}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-primary text-primary-foreground px-6 h-[40px] rounded-[8px] hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-[14px] font-bold disabled:opacity-50 shadow-md active:scale-95"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin text-secondary" />}
                {loading ? c.saving : isEdit ? s.update : s.register}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
