import type { LucideIcon } from "lucide-react";

/**
 * Sistema de módulos do AXIS.
 *
 * Um vertical (store, farm, clinic, food) é um conjunto nomeado de módulos.
 * O núcleo é comum a todos e nunca importa de um módulo — ver
 * docs/superpowers/specs/2026-07-25-projeto-1-unificacao-design.md §2.2.
 */

export type NavEntry = {
  /** Chave de tradução e identificação. */
  key: string;
  /** Rótulo por omissão, quando não há tradução para o idioma ativo. */
  defaultLabel: string;
  /** Caminho relativo ao tenant: `pos` → `/{tenantId}/pos`. */
  href: string;
  icon: LucideIcon;
  /** Posição na barra lateral. Núcleo e módulos partilham a mesma escala. */
  order: number;
};

export type ModuleManifest = {
  /** Identificador do módulo, usado em `Tenant.modules`. */
  name: string;
  label: string;
  /** Entradas de menu que este módulo acrescenta. */
  nav: NavEntry[];
  /**
   * Prefixos de rota que pertencem a este módulo. O layout usa-os para devolver
   * 404 quando o módulo não está ativo — esconder do menu não é suficiente.
   */
  routes: string[];
  /**
   * Ações de permissão que este módulo introduz, no formato `modulo:nivel`.
   * São semeadas quando o módulo é ativado para um cliente — sem isso o
   * requirePermission nega OPERATOR e AUDITOR (lib/authz.ts:38-52).
   */
  permissions: string[];
  /**
   * Rótulos do núcleo que este módulo reescreve. Numa clínica, "Clientes"
   * chama-se "Pacientes": é a mesma entidade e a mesma rota, com o vocabulário
   * do negócio. Chave = `key` da entrada do núcleo.
   */
  labelOverrides?: Record<string, string>;
};
