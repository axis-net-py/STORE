"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { createMesa, updateMesa, deleteMesa } from "@/modules/food/actions/mesa";

const STRINGS = {
  pt: {
    nova: "Nova mesa",
    editar: "Editar mesa",
    novaSub: "As mesas do salão, como a casa lhes chama.",
    editarSub: "Altere o nome, a zona ou o número de lugares.",
    nome: "Nome",
    nomeDica: "Ex: 12, Varanda 3, Balcão 1",
    zona: "Zona",
    zonaDica: "Ex: Salão, Varanda, Mezanino",
    lugares: "Lugares",
    estado: "Estado",
    livre: "Livre",
    reservada: "Reservada",
    inativa: "Inativa (fora de serviço)",
    guardar: "Guardar",
    apagar: "Apagar",
    confirmar: "Apagar esta mesa? O histórico das contas fechadas nela mantém-se.",
    guardada: "Mesa guardada.",
    apagada: "Mesa apagada.",
    erro: "Não foi possível guardar a mesa.",
  },
  es: {
    nova: "Nueva mesa",
    editar: "Editar mesa",
    novaSub: "Las mesas del salón, tal como las llama la casa.",
    editarSub: "Cambie el nombre, la zona o la cantidad de lugares.",
    nome: "Nombre",
    nomeDica: "Ej: 12, Terraza 3, Barra 1",
    zona: "Zona",
    zonaDica: "Ej: Salón, Terraza, Entrepiso",
    lugares: "Lugares",
    estado: "Estado",
    livre: "Libre",
    reservada: "Reservada",
    inativa: "Inactiva (fuera de servicio)",
    guardar: "Guardar",
    apagar: "Eliminar",
    confirmar: "¿Eliminar esta mesa? El historial de las cuentas cerradas en ella se mantiene.",
    guardada: "Mesa guardada.",
    apagada: "Mesa eliminada.",
    erro: "No se pudo guardar la mesa.",
  },
} as const;

export type MesaEditavel = {
  id: string;
  nome: string;
  zona: string | null;
  lugares: number;
  estado: "LIVRE" | "RESERVADA" | "INATIVA";
};

export function MesaSheet({
  tenantId,
  mesa,
  trigger,
}: {
  tenantId: string;
  mesa?: MesaEditavel;
  trigger?: React.ReactNode;
}) {
  const { language } = useLanguage();
  const s = STRINGS[language === "es" ? "es" : "pt"];
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState(mesa?.nome ?? "");
  const [zona, setZona] = useState(mesa?.zona ?? "");
  const [lugares, setLugares] = useState(String(mesa?.lugares ?? 2));
  const [estado, setEstado] = useState<MesaEditavel["estado"]>(mesa?.estado ?? "LIVRE");

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const dados = { nome, zona, lugares, estado };
      if (mesa) await updateMesa(mesa.id, dados);
      else await createMesa(dados);
      toast.success(s.guardada);
      setOpen(false);
      if (!mesa) { setNome(""); setZona(""); setLugares("2"); }
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || s.erro);
    } finally {
      setLoading(false);
    }
  }

  async function apagar() {
    if (!mesa || !window.confirm(s.confirmar)) return;
    setLoading(true);
    try {
      await deleteMesa(mesa.id);
      toast.success(s.apagada);
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || s.erro);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> {s.nova}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{mesa ? s.editar : s.nova}</DialogTitle>
          <DialogDescription>{mesa ? s.editarSub : s.novaSub}</DialogDescription>
        </DialogHeader>

        <form onSubmit={guardar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mesa-nome">{s.nome}</Label>
            <Input
              id="mesa-nome"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={s.nomeDica}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="mesa-zona">{s.zona}</Label>
              <Input
                id="mesa-zona"
                value={zona}
                onChange={(e) => setZona(e.target.value)}
                placeholder={s.zonaDica}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mesa-lugares">{s.lugares}</Label>
              <Input
                id="mesa-lugares"
                type="number"
                min={1}
                max={60}
                value={lugares}
                onChange={(e) => setLugares(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{s.estado}</Label>
            <Select value={estado} onValueChange={(v) => setEstado(v as MesaEditavel["estado"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LIVRE">{s.livre}</SelectItem>
                <SelectItem value="RESERVADA">{s.reservada}</SelectItem>
                <SelectItem value="INATIVA">{s.inativa}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading} className="flex-1 gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {s.guardar}
            </Button>
            {mesa && (
              <Button type="button" variant="outline" disabled={loading} onClick={apagar}>
                {s.apagar}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
