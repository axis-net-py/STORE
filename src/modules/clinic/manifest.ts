import { CalendarDays, Stethoscope, ClipboardList } from "lucide-react";
import type { ModuleManifest } from "../types";

/**
 * Módulo `clinic` — clínicas e consultórios.
 *
 * Agenda, profissionais e serviços. Faturação, produtos, fornecedores,
 * contabilidade e relatórios são núcleo.
 *
 * O Conselheiro NÃO faz parte deste módulo: é projeto independente (TAVOLA),
 * decisão D6 da arquitetura da linha de produtos.
 *
 * Ordem: agenda em 15, logo a seguir ao Dashboard, como estava no CLINIC;
 * profissionais e serviços em 91-92, antes de Contabilidade.
 */
export const clinicModule: ModuleManifest = {
  name: "clinic",
  label: "Saúde",
  nav: [
    { icon: CalendarDays,  key: "agenda",        defaultLabel: "Agenda",        href: "agenda",        order: 15 },
    { icon: Stethoscope,   key: "profissionais", defaultLabel: "Profissionais", href: "profissionais", order: 91 },
    { icon: ClipboardList, key: "servicos",      defaultLabel: "Serviços",      href: "servicos",      order: 92 },
  ],
  routes: ["agenda", "profissionais", "servicos"],
  // Numa clínica o cliente é o paciente: mesma entidade, mesma rota, outro nome.
  labelOverrides: { customers: "Pacientes" },
};
