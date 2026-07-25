"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { createSoilAnalysis } from "@/modules/farm/actions/soilAnalysis";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";

const STRINGS = {
  pt: {
    newTrigger: "Nova Análise de Solo",
    description: "Registre os resultados da análise de solo deste talhão.",
    date: "Data",
    organicMatter: "Matéria Orgânica (%)",
    recommendation: "Recomendação",
    recommendationPlaceholder: "Ex: Aplicar calcário 2t/ha",
    notes: "Observações",
    saveErr: "Erro ao registrar análise de solo",
    cancel: "Cancelar",
    saving: "Salvando...",
    register: "Registrar",
  },
  es: {
    newTrigger: "Nuevo Análisis de Suelo",
    description: "Registre los resultados del análisis de suelo de esta parcela.",
    date: "Fecha",
    organicMatter: "Materia Orgánica (%)",
    recommendation: "Recomendación",
    recommendationPlaceholder: "Ej: Aplicar cal 2t/ha",
    notes: "Observaciones",
    saveErr: "Error al registrar el análisis de suelo",
    cancel: "Cancelar",
    saving: "Guardando...",
    register: "Registrar",
  },
} as const;

export function SoilAnalysisSheet({ plotId }: { plotId: string }) {
  const router = useRouter();
  const { language } = useLanguage();
  const s = STRINGS[language];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [ph, setPh] = useState("");
  const [phosphorus, setPhosphorus] = useState("");
  const [potassium, setPotassium] = useState("");
  const [organicMatter, setOrganicMatter] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;

    setLoading(true);
    try {
      await createSoilAnalysis({
        plotId,
        date: new Date(date),
        ph: ph ? Number(ph) : undefined,
        phosphorus: phosphorus ? Number(phosphorus) : undefined,
        potassium: potassium ? Number(potassium) : undefined,
        organicMatter: organicMatter ? Number(organicMatter) : undefined,
        recommendation: recommendation || undefined,
        notes: notes || undefined,
      });
      setOpen(false);
      setPh("");
      setPhosphorus("");
      setPotassium("");
      setOrganicMatter("");
      setRecommendation("");
      setNotes("");
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
        <button className="px-4 h-[32px] rounded-[8px] text-[13px] font-bold border border-border bg-background hover:bg-muted transition-all">
          {s.newTrigger}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[50vw] w-[95vw] glass-pop-up p-0 overflow-hidden">
        <DialogHeader className="text-left space-y-1 p-6 border-b border-border bg-muted/30">
          <DialogTitle className="text-[18px] font-bold tracking-tight text-foreground">{s.newTrigger}</DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground font-medium">
            {s.description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          <div className="space-y-2">
            <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.date}</Label>
            <Input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">pH</Label>
              <Input
                type="number"
                step="0.01"
                value={ph}
                onChange={(e) => setPh(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">P (mg/dm³)</Label>
              <Input
                type="number"
                step="0.01"
                value={phosphorus}
                onChange={(e) => setPhosphorus(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">K (cmolc/dm³)</Label>
              <Input
                type="number"
                step="0.01"
                value={potassium}
                onChange={(e) => setPotassium(e.target.value)}
                className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.organicMatter}</Label>
            <Input
              type="number"
              step="0.01"
              value={organicMatter}
              onChange={(e) => setOrganicMatter(e.target.value)}
              className="bg-background border-border text-[13px] h-[40px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] text-primary uppercase tracking-widest font-bold">{s.recommendation}</Label>
            <Textarea
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              rows={2}
              placeholder={s.recommendationPlaceholder}
              className="bg-background border-border text-[13px] rounded-[8px] font-medium shadow-sm focus:ring-primary/20"
            />
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

          <div className="mt-4 pt-6 border-t border-border flex justify-end gap-3">
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
              {loading ? s.saving : s.register}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
