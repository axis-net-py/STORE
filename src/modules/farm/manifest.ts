import { Sprout, Map, Warehouse, Beef, Tractor, UserCheck, Handshake, BadgeCheck } from "lucide-react";
import type { ModuleManifest } from "../types";

/**
 * Módulo `farm` — agronegócio.
 *
 * Safras, talhões, silos, rebanho, frota, funcionários, contratos e
 * certificações. Faturação, produtos, clientes, fornecedores, contabilidade
 * e relatórios continuam a ser núcleo, partilhados com os outros verticais.
 *
 * Ordem 81-88: o bloco agrícola fica depois de Fornecedores (80) e antes de
 * Financeiro, Contabilidade e Relatórios — a mesma posição relativa que tinha
 * na barra lateral do FARM.
 */
export const farmModule: ModuleManifest = {
  name: "farm",
  label: "Agronegócio",
  nav: [
    { icon: Sprout,     key: "safra",         defaultLabel: "Safras",        href: "safra",         order: 81 },
    { icon: Map,        key: "talhoes",       defaultLabel: "Talhões",       href: "talhoes",       order: 82 },
    { icon: Warehouse,  key: "silos",         defaultLabel: "Silos",         href: "silos",         order: 83 },
    { icon: Beef,       key: "rebanho",       defaultLabel: "Rebanho",       href: "rebanho",       order: 84 },
    { icon: Tractor,    key: "frota",         defaultLabel: "Frota",         href: "frota",         order: 85 },
    { icon: UserCheck,  key: "funcionarios",  defaultLabel: "Funcionários",  href: "funcionarios",  order: 86 },
    { icon: Handshake,  key: "contratos",     defaultLabel: "Contratos",     href: "contratos",     order: 87 },
    { icon: BadgeCheck, key: "certificacoes", defaultLabel: "Certificações", href: "certificacoes", order: 88 },
  ],
  routes: ["safra", "talhoes", "silos", "rebanho", "frota", "funcionarios", "contratos", "certificacoes"],
  permissions: ["farm:read", "farm:write", "farm:delete"],
};
