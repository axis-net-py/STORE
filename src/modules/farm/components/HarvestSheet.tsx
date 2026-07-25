"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { createHarvest, updateHarvest, deleteHarvest } from "@/modules/farm/actions/safra";
import type { Harvest } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    editTrigger: "Editar",
    newTrigger: "Nova Safra",
    editTitle: "Editar Safra",
    newTitle: "Nova Safra",
    editDescription: "Atualize os dados do planejamento da safra.",
    newDescription: "Cadastre uma nova safra de plantio.",
    name: "Nome da Safra",
    namePlaceholder: "Ex: Safra de Soja 2026",
    cropType: "Cultura Principal",
    cropTypePlaceholder: "Selecione tipo",
    cropSoja: "Soja",
    cropMilho: "Milho",
    cropTrigo: "Trigo",
    cropAlgodao: "Algodão",
    cropArroz: "Arroz",
    cropOutro: "Outro",
    startDate: "Data de Início",
    endDate: "Data de Término",
    status: "Status",
    statusPlaceholder: "Selecione status",
    statusActive: "Ativo (Em Andamento)",
    statusPlanned: "Planejado",
    statusCompleted: "Concluído",
    delete: "Excluir",
    cancel: "Cancelar",
    saving: "Salvando...",
    update: "Atualizar",
    register: "Registrar Safra",
    deleteConfirm: "Tem certeza que deseja excluir esta safra? Esta ação removerá o vínculo com todos os talhões associados.",
    deleteErr: "Erro ao excluir safra",
    saveErr: "Erro ao salvar safra",
  },
  es: {
    editTrigger: "Editar",
    newTrigger: "Nueva Cosecha",
    editTitle: "Editar Cosecha",
    newTitle: "Nueva Cosecha",
    editDescription: "Actualice los datos de la planificación de la cosecha.",
    newDescription: "Registre una nueva cosecha de siembra.",
    name: "Nombre de la Cosecha",
    namePlaceholder: "Ej: Cosecha de Soja 2026",
    cropType: "Cultivo Principal",
    cropTypePlaceholder: "Seleccione tipo",
    cropSoja: "Soja",
    cropMilho: "Maíz",
    cropTrigo: "Trigo",
    cropAlgodao: "Algodón",
    cropArroz: "Arroz",
    cropOutro: "Otro",
    startDate: "Fecha de Inicio",
    endDate: "Fecha de Término",
    status: "Estado",
    statusPlaceholder: "Seleccione estado",
    statusActive: "Activo (En Curso)",
    statusPlanned: "Planificado",
    statusCompleted: "Concluido",
    delete: "Eliminar",
    cancel: "Cancelar",
    saving: "Guardando...",
    update: "Actualizar",
    register: "Registrar Cosecha",
    deleteConfirm: "¿Está seguro que desea eliminar esta cosecha? Esta acción eliminará el vínculo con todas las parcelas asociadas.",
    deleteErr: "Error al eliminar cosecha",
    saveErr: "Error al guardar cosecha",
  },
} as const;

export function HarvestSheet({
  tenantId,
  harvest,
  onSuccess,
}: {
  tenantId: string;
  harvest?: Harvest;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!harvest;

  const [name, setName] = useState(harvest?.name ?? "");
  const [cropType, setCropType] = useState(harvest?.cropType ?? "soja");
  const [startDate, setStartDate] = useState(
    harvest?.startDate ? new Date(harvest.startDate).toISOString().split("T")[0] : ""
  );
  const [endDate, setEndDate] = useState(
    harvest?.endDate ? new Date(harvest.endDate).toISOString().split("T")[0] : ""
  );
  const [status, setStatus] = useState(harvest?.status ?? "ACTIVE");

  async function handleDelete() {
    if (!harvest) return;
    const confirmDelete = window.confirm(s.deleteConfirm);
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await deleteHarvest(harvest.id);
      setOpen(false);
      onSuccess?.();
      router.refresh();
    } catch (err: any) {
      alert(err.message || s.deleteErr);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !cropType || !startDate || !endDate) return;

    setLoading(true);
    try {
      if (isEdit && harvest) {
        await updateHarvest(harvest.id, {
          name,
          cropType,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status,
        });
      } else {
        await createHarvest({
          name,
          cropType,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status,
        });
      }
      setOpen(false);
      onSuccess?.();
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
            {isEdit ? s.editDescription : s.newDescription}
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
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.cropType}</Label>
              <Select value={cropType} onValueChange={setCropType}>
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                  <SelectValue placeholder={s.cropTypePlaceholder} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="soja" className="text-[12px]">{s.cropSoja}</SelectItem>
                  <SelectItem value="milho" className="text-[12px]">{s.cropMilho}</SelectItem>
                  <SelectItem value="trigo" className="text-[12px]">{s.cropTrigo}</SelectItem>
                  <SelectItem value="algodao" className="text-[12px]">{s.cropAlgodao}</SelectItem>
                  <SelectItem value="arroz" className="text-[12px]">{s.cropArroz}</SelectItem>
                  <SelectItem value="outro" className="text-[12px]">{s.cropOutro}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.startDate}</Label>
              <Input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.endDate}</Label>
              <Input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.status}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                  <SelectValue placeholder={s.statusPlaceholder} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="ACTIVE" className="text-[12px]">{s.statusActive}</SelectItem>
                  <SelectItem value="PLANNED" className="text-[12px]">{s.statusPlanned}</SelectItem>
                  <SelectItem value="COMPLETED" className="text-[12px]">{s.statusCompleted}</SelectItem>
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
