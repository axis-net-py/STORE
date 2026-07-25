"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { createCertification, updateCertification, deleteCertification } from "@/modules/farm/actions/certification";
import type { Certification } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    newTrigger: "Nova Certificação",
    editTitle: "Editar Certificação",
    newTitle: "Nova Certificação",
    description: "Registre certificações da fazenda (orgânico, GLOBALG.A.P, etc).",
    name: "Nome",
    namePlaceholder: "Ex: GLOBALG.A.P",
    issuingBody: "Órgão Emissor",
    number: "Número",
    issueDate: "Emissão",
    expiryDate: "Validade",
    status: "Status",
    statusActive: "Ativa",
    statusPending: "Pendente",
    statusExpired: "Vencida",
    scope: "Escopo",
    scopePlaceholder: "Ex: Talhões 1-5, Soja",
    notes: "Observações",
    deleteConfirm: "Tem certeza que deseja excluir esta certificação? Esta ação não pode ser desfeita.",
    deleteErr: "Erro ao excluir certificação",
    saveErr: "Erro ao salvar certificação",
    delete: "Excluir",
    cancel: "Cancelar",
    saving: "Salvando...",
    update: "Atualizar",
    register: "Registrar",
  },
  es: {
    newTrigger: "Nueva Certificación",
    editTitle: "Editar Certificación",
    newTitle: "Nueva Certificación",
    description: "Registre certificaciones de la granja (orgánico, GLOBALG.A.P, etc).",
    name: "Nombre",
    namePlaceholder: "Ej: GLOBALG.A.P",
    issuingBody: "Organismo Emisor",
    number: "Número",
    issueDate: "Emisión",
    expiryDate: "Vencimiento",
    status: "Estado",
    statusActive: "Activa",
    statusPending: "Pendiente",
    statusExpired: "Vencida",
    scope: "Alcance",
    scopePlaceholder: "Ej: Parcelas 1-5, Soja",
    notes: "Observaciones",
    deleteConfirm: "¿Está seguro que desea eliminar esta certificación? Esta acción no se puede deshacer.",
    deleteErr: "Error al eliminar certificación",
    saveErr: "Error al guardar certificación",
    delete: "Eliminar",
    cancel: "Cancelar",
    saving: "Guardando...",
    update: "Actualizar",
    register: "Registrar",
  },
} as const;

export function CertificationSheet({ certification }: { certification?: Certification }) {
  const router = useRouter();
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!certification;

  const [name, setName] = useState(certification?.name ?? "");
  const [issuingBody, setIssuingBody] = useState(certification?.issuingBody ?? "");
  const [certificateNumber, setCertificateNumber] = useState(certification?.certificateNumber ?? "");
  const [issueDate, setIssueDate] = useState(
    certification?.issueDate ? new Date(certification.issueDate).toISOString().split("T")[0] : ""
  );
  const [expiryDate, setExpiryDate] = useState(
    certification?.expiryDate ? new Date(certification.expiryDate).toISOString().split("T")[0] : ""
  );
  const [status, setStatus] = useState(certification?.status ?? "ACTIVE");
  const [scope, setScope] = useState(certification?.scope ?? "");
  const [notes, setNotes] = useState(certification?.notes ?? "");

  async function handleDelete() {
    if (!certification) return;
    const confirmDelete = window.confirm(s.deleteConfirm);
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await deleteCertification(certification.id);
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
    if (!name) return;

    setLoading(true);
    try {
      const payload = {
        name,
        issuingBody: issuingBody || undefined,
        certificateNumber: certificateNumber || undefined,
        issueDate: issueDate ? new Date(issueDate) : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        status,
        scope: scope || undefined,
        notes: notes || undefined,
      };
      if (isEdit && certification) {
        await updateCertification(certification.id, payload);
      } else {
        await createCertification(payload);
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
          {isEdit ? "Editar" : s.newTrigger}
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
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.issuingBody}</Label>
              <Input
                value={issuingBody}
                onChange={(e) => setIssuingBody(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.number}</Label>
              <Input
                value={certificateNumber}
                onChange={(e) => setCertificateNumber(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.issueDate}</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.expiryDate}</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.status}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-background border-border text-[13px] h-[40px] rounded-[8px] focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="ACTIVE" className="text-[12px]">{s.statusActive}</SelectItem>
                  <SelectItem value="PENDING" className="text-[12px]">{s.statusPending}</SelectItem>
                  <SelectItem value="EXPIRED" className="text-[12px]">{s.statusExpired}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.scope}</Label>
              <Input
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder={s.scopePlaceholder}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.notes}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="bg-background border-border text-[13px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
            />
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
