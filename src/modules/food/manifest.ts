import { UtensilsCrossed, ChefHat, BookMarked } from "lucide-react";
import type { ModuleManifest } from "../types";

/**
 * Módulo `food` — restaurantes e lanchonetes.
 *
 * Três ecrãs, e a ordem deles é a ordem do turno: o salão é onde se está a
 * maior parte do tempo, a cozinha é o que se olha a seguir, o cardápio mexe-se
 * uma vez por semana.
 *
 * Faturação, produtos, estoque, fornecedores, financeiro e contabilidade são
 * núcleo — uma lanchonete compra, vende e fecha o mês como qualquer outra
 * empresa. O que é próprio do ramo é a conta que fica aberta na mesa e o que
 * acontece entre pedir e servir.
 *
 * As comandas não têm entrada no menu de propósito: chega-se a uma comanda
 * pela mesa, no salão, que é como se chega a ela na vida real.
 */
export const foodModule: ModuleManifest = {
  name: "food",
  label: "Restauração",
  nav: [
    { icon: UtensilsCrossed, key: "salao",    defaultLabel: "Salão",    href: "salao",    order: 20 },
    { icon: ChefHat,         key: "cozinha",  defaultLabel: "Cozinha",  href: "cozinha",  order: 25 },
    { icon: BookMarked,      key: "cardapio", defaultLabel: "Cardápio", href: "cardapio", order: 55 },
  ],
  routes: ["salao", "cozinha", "cardapio", "comandas"],
  routesSemMenu: ["comandas"],
  permissions: ["food:read", "food:write", "food:delete"],
};
