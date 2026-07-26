import { ClipboardList, ShoppingCart } from "lucide-react";
import type { ModuleManifest } from "../types";

/**
 * Módulo `store` — comércio retalhista.
 *
 * Ponto de venda e pedidos. Tudo o resto que o axis store usa (faturação,
 * produtos, estoque, financeiro, contabilidade) é núcleo, partilhado com os
 * restantes verticais.
 */
export const storeModule: ModuleManifest = {
  name: "store",
  label: "Comércio",
  nav: [
    { icon: ShoppingCart,  key: "pos",    defaultLabel: "PDV",     href: "pos",    order: 20 },
    { icon: ClipboardList, key: "orders", defaultLabel: "Pedidos", href: "orders", order: 30 },
  ],
  routes: ["pos", "orders"],
  // Declaradas por convenção e semeadas com o módulo. As actions atuais de
  // pedidos usam `invoices:*` do núcleo, porque um pedido converte-se numa
  // fatura — funcionalidades futuras do módulo usarão estas.
  permissions: ["store:read", "store:write", "store:delete"],
};
