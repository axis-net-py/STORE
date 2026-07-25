"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { createEmployee, updateEmployee, deleteEmployee } from "@/modules/farm/actions/funcionario";
import type { Employee } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    editTrigger: "Editar",
    newTrigger: "Novo Funcionário",
    editTitle: "Editar Funcionário",
    newTitle: "Novo Funcionário",
    editDescription: "Atualize os dados do funcionário.",
    newDescription: "Cadastre operadores, tratoristas, agrônomos ou auxiliares.",
    name: "Nome Completo",
    namePlaceholder: "Ex: João da Silva",
    role: "Cargo / Função",
    rolePlaceholder: "Selecione cargo",
    roleOperador: "Operador",
    roleTratorista: "Tratorista",
    roleAgronomo: "Agrônomo",
    roleAuxiliar: "Auxiliar Agrícola",
    roleGerente: "Gerente / Supervisor",
    roleOutro: "Outro",
    phone: "Telefone / Contato",
    phonePlaceholder: "+595 991 222 333",
    status: "Status",
    statusPlaceholder: "Selecione status",
    statusActive: "Ativo (Em Serviço)",
    statusInactive: "Inativo (Desligado)",
    statusLeave: "Licença / Afastado",
    delete: "Excluir",
    cancel: "Cancelar",
    saving: "Salvando...",
    update: "Atualizar",
    register: "Registrar Funcionário",
    deleteConfirm: "Tem certeza que deseja excluir este funcionário? Esta ação não pode ser desfeita.",
    deleteErr: "Erro ao excluir funcionário",
    saveErr: "Erro ao salvar funcionário",
  },
  es: {
    editTrigger: "Editar",
    newTrigger: "Nuevo Empleado",
    editTitle: "Editar Empleado",
    newTitle: "Nuevo Empleado",
    editDescription: "Actualice los datos del empleado.",
    newDescription: "Registre operadores, tractoristas, agrónomos o auxiliares.",
    name: "Nombre Completo",
    namePlaceholder: "Ej: Juan Pérez",
    role: "Cargo / Función",
    rolePlaceholder: "Seleccione cargo",
    roleOperador: "Operador",
    roleTratorista: "Tractorista",
    roleAgronomo: "Agrónomo",
    roleAuxiliar: "Auxiliar Agrícola",
    roleGerente: "Gerente / Supervisor",
    roleOutro: "Otro",
    phone: "Teléfono / Contacto",
    phonePlaceholder: "+595 991 222 333",
    status: "Estado",
    statusPlaceholder: "Seleccione estado",
    statusActive: "Activo (En Servicio)",
    statusInactive: "Inactivo (Desvinculado)",
    statusLeave: "Licencia / Ausente",
    delete: "Eliminar",
    cancel: "Cancelar",
    saving: "Guardando...",
    update: "Actualizar",
    register: "Registrar Empleado",
    deleteConfirm: "¿Está seguro que desea eliminar este empleado? Esta acción no se puede deshacer.",
    deleteErr: "Error al eliminar empleado",
    saveErr: "Error al guardar empleado",
  },
} as const;

export function EmployeeSheet({
  tenantId,
  employee,
  onSuccess,
}: {
  tenantId: string;
  employee?: Employee;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!employee;

  const [name, setName] = useState(employee?.name ?? "");
  const [role, setRole] = useState(employee?.role ?? "operador");
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const [status, setStatus] = useState(employee?.status ?? "ACTIVE");

  async function handleDelete() {
    if (!employee) return;
    const confirmDelete = window.confirm(s.deleteConfirm);
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await deleteEmployee(employee.id);
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
    if (!name || !role) return;

    setLoading(true);
    try {
      const payload = {
        name,
        role,
        phone: phone || undefined,
        status,
      };

      if (isEdit && employee) {
        await updateEmployee(employee.id, payload);
      } else {
        await createEmployee(payload);
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
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.role}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                  <SelectValue placeholder={s.rolePlaceholder} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="operador" className="text-[12px]">{s.roleOperador}</SelectItem>
                  <SelectItem value="tratorista" className="text-[12px]">{s.roleTratorista}</SelectItem>
                  <SelectItem value="agronomo" className="text-[12px]">{s.roleAgronomo}</SelectItem>
                  <SelectItem value="auxiliar" className="text-[12px]">{s.roleAuxiliar}</SelectItem>
                  <SelectItem value="gerente" className="text-[12px]">{s.roleGerente}</SelectItem>
                  <SelectItem value="outro" className="text-[12px]">{s.roleOutro}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.phone}</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={s.phonePlaceholder}
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
                  <SelectItem value="ACTIVE" className="text-[12px]">{s.statusActive}</SelectItem>
                  <SelectItem value="INACTIVE" className="text-[12px]">{s.statusInactive}</SelectItem>
                  <SelectItem value="LEAVE" className="text-[12px]">{s.statusLeave}</SelectItem>
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
