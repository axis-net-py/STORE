import {
  LayoutDashboard, FileText, Package, Users, Truck,
  BookOpen, BarChart3, Wallet, Boxes,
} from "lucide-react";
import type { ModuleManifest, NavEntry } from "./types";
// Extensão explícita: o runner nativo do Node (npm test) resolve ESM estrito.
// Os imports de tipo acima são apagados na compilação e não precisam dela.
import { storeModule } from "./store/manifest.ts";
import { farmModule } from "./farm/manifest.ts";
import { clinicModule } from "./clinic/manifest.ts";

/**
 * Registo de módulos e composição dos verticais.
 *
 * Regra invioláve: o núcleo nunca importa de um módulo. Este ficheiro é a
 * única fronteira onde os dois se encontram, e a direção é sempre
 * registo → módulo, nunca o contrário.
 */

/** Navegação do núcleo, disponível em todos os verticais. */
export const CORE_NAV: NavEntry[] = [
  { icon: LayoutDashboard, key: "dashboard",  defaultLabel: "Dashboard",     href: "dashboard",  order: 10 },
  { icon: FileText,        key: "invoices",   defaultLabel: "Faturas",       href: "invoices",   order: 40 },
  { icon: Package,         key: "products",   defaultLabel: "Produtos",      href: "products",   order: 50 },
  { icon: Boxes,           key: "inventory",  defaultLabel: "Estoque",       href: "inventory",  order: 60 },
  { icon: Users,           key: "customers",  defaultLabel: "Clientes",      href: "customers",  order: 70 },
  { icon: Truck,           key: "suppliers",  defaultLabel: "Fornecedores",  href: "suppliers",  order: 80 },
  { icon: Wallet,          key: "finance",    defaultLabel: "Financeiro",    href: "finance",    order: 90 },
  { icon: BookOpen,        key: "accounting", defaultLabel: "Contabilidade", href: "accounting", order: 100 },
  { icon: BarChart3,       key: "reports",    defaultLabel: "Relatórios",    href: "reports",    order: 110 },
];

/** Todos os módulos conhecidos. Food entra no Projeto 3. */
export const MODULES: Record<string, ModuleManifest> = {
  store: storeModule,
  farm: farmModule,
  clinic: clinicModule,
};

/** Composição de cada marca. Um cliente pode ter módulos além dos do seu vertical. */
export const VERTICALS: Record<string, string[]> = {
  store: ["store"],
  farm: ["farm"],
  clinic: ["clinic"],
  food: ["food"],
};

/** Módulos ativos que existem de facto no registo — ignora nomes desconhecidos. */
export function resolveModules(active: string[]): ModuleManifest[] {
  return active.map((name) => MODULES[name]).filter((m): m is ModuleManifest => !!m);
}

/**
 * Navegação final: núcleo + módulos ativos, ordenada, com os rótulos do núcleo
 * reescritos pelos módulos que o pedem (ex.: "Clientes" → "Pacientes").
 */
export function navFor(active: string[]): NavEntry[] {
  const modulos = resolveModules(active);
  const overrides: Record<string, string> = {};
  for (const m of modulos) Object.assign(overrides, m.labelOverrides ?? {});

  // O override troca a CHAVE de tradução, não um texto fixo: a barra lateral
  // traduz por chave (next-intl), e um literal aqui ficaria só num idioma.
  const nucleo = CORE_NAV.map((e) =>
    overrides[e.key] ? { ...e, key: overrides[e.key] } : e
  );

  return [...nucleo, ...modulos.flatMap((m) => m.nav)].sort((a, b) => a.order - b.order);
}

/**
 * Diz se um caminho pertence a um módulo que NÃO está ativo.
 * Usado pelo layout para devolver 404 — esconder do menu não fecha o URL.
 */
export function isRotaBloqueada(segmento: string, active: string[]): boolean {
  const ativos = new Set(active);
  return Object.values(MODULES).some(
    (m) => !ativos.has(m.name) && m.routes.includes(segmento)
  );
}
