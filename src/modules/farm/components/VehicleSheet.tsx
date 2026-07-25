"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { createVehicle, updateVehicle, deleteVehicle } from "@/modules/farm/actions/frota";
import type { Vehicle } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    editTrigger: "Editar",
    newTrigger: "Novo Veículo",
    editTitle: "Editar Veículo",
    newTitle: "Novo Veículo / Máquina",
    editDescription: "Atualize os dados da máquina ou veículo.",
    newDescription: "Cadastre maquinários, tratores ou caminhões da fazenda.",
    name: "Nome / Modelo",
    namePlaceholder: "Ex: Trator John Deere 7200",
    type: "Tipo",
    typePlaceholder: "Selecione tipo",
    typeTrator: "Trator",
    typeColheitadeira: "Colheitadeira",
    typePulverizador: "Pulverizador",
    typeCaminhao: "Caminhão",
    typeImplemento: "Implemento Agrícola",
    typeOutro: "Outro",
    plate: "Placa / Chassi / Identificação",
    platePlaceholder: "Ex: ABC1234 ou Chassi",
    status: "Status Operacional",
    statusPlaceholder: "Selecione status",
    statusOperational: "Operando (Disponível)",
    statusMaintenance: "Em Manutenção",
    statusOutOfService: "Fora de Serviço",
    delete: "Excluir",
    cancel: "Cancelar",
    saving: "Salvando...",
    update: "Atualizar",
    register: "Registrar Veículo",
    deleteConfirm: "Tem certeza que deseja excluir este veículo/maquinário? Esta ação não pode ser desfeita.",
    deleteErr: "Erro ao excluir veículo",
    saveErr: "Erro ao salvar veículo",
  },
  es: {
    editTrigger: "Editar",
    newTrigger: "Nuevo Vehículo",
    editTitle: "Editar Vehículo",
    newTitle: "Nuevo Vehículo / Máquina",
    editDescription: "Actualice los datos de la máquina o vehículo.",
    newDescription: "Registre maquinaria, tractores o camiones de la granja.",
    name: "Nombre / Modelo",
    namePlaceholder: "Ej: Tractor John Deere 7200",
    type: "Tipo",
    typePlaceholder: "Seleccione tipo",
    typeTrator: "Tractor",
    typeColheitadeira: "Cosechadora",
    typePulverizador: "Pulverizador",
    typeCaminhao: "Camión",
    typeImplemento: "Implemento Agrícola",
    typeOutro: "Otro",
    plate: "Placa / Chasis / Identificación",
    platePlaceholder: "Ej: ABC1234 o Chasis",
    status: "Estado Operativo",
    statusPlaceholder: "Seleccione estado",
    statusOperational: "Operando (Disponible)",
    statusMaintenance: "En Mantenimiento",
    statusOutOfService: "Fuera de Servicio",
    delete: "Eliminar",
    cancel: "Cancelar",
    saving: "Guardando...",
    update: "Actualizar",
    register: "Registrar Vehículo",
    deleteConfirm: "¿Está seguro que desea eliminar este vehículo/maquinaria? Esta acción no se puede deshacer.",
    deleteErr: "Error al eliminar vehículo",
    saveErr: "Error al guardar vehículo",
  },
} as const;

export function VehicleSheet({
  tenantId,
  vehicle,
  onSuccess,
}: {
  tenantId: string;
  vehicle?: Vehicle;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!vehicle;

  const [name, setName] = useState(vehicle?.name ?? "");
  const [type, setType] = useState(vehicle?.type ?? "trator");
  const [plate, setPlate] = useState(vehicle?.plate ?? "");
  const [status, setStatus] = useState(vehicle?.status ?? "OPERATIONAL");

  async function handleDelete() {
    if (!vehicle) return;
    const confirmDelete = window.confirm(s.deleteConfirm);
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await deleteVehicle(vehicle.id);
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
    if (!name || !type) return;

    setLoading(true);
    try {
      const payload = {
        name,
        type,
        plate: plate || undefined,
        status,
      };

      if (isEdit && vehicle) {
        await updateVehicle(vehicle.id, payload);
      } else {
        await createVehicle(payload);
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
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.type}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                  <SelectValue placeholder={s.typePlaceholder} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="trator" className="text-[12px]">{s.typeTrator}</SelectItem>
                  <SelectItem value="colheitadeira" className="text-[12px]">{s.typeColheitadeira}</SelectItem>
                  <SelectItem value="pulverizador" className="text-[12px]">{s.typePulverizador}</SelectItem>
                  <SelectItem value="caminhao" className="text-[12px]">{s.typeCaminhao}</SelectItem>
                  <SelectItem value="implemento" className="text-[12px]">{s.typeImplemento}</SelectItem>
                  <SelectItem value="outro" className="text-[12px]">{s.typeOutro}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.plate}</Label>
              <Input
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder={s.platePlaceholder}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.status}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                  <SelectValue placeholder={s.statusPlaceholder} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="OPERATIONAL" className="text-[12px]">{s.statusOperational}</SelectItem>
                  <SelectItem value="MAINTENANCE" className="text-[12px]">{s.statusMaintenance}</SelectItem>
                  <SelectItem value="OUT_OF_SERVICE" className="text-[12px]">{s.statusOutOfService}</SelectItem>
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
