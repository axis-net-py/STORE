"use client";

import { useEffect } from "react";
import type { Acento } from "@/lib/tema";

/**
 * Propaga o acento para o `<html>`.
 *
 * O acento é servido num contentor à volta do painel, o que basta para tudo o
 * que é filho dele — e é o que evita ver a paleta trocar depois da página
 * pintada. Mas os diálogos, os menus e os avisos da Radix e do sonner são
 * montados por portal no `<body>`, fora desse contentor: sem isto herdavam a
 * paleta neutra, e um cliente do agronegócio via um diálogo azul sobre uma
 * interface verde.
 *
 * Corre depois da montagem, o que aqui não custa nada: nada disso está no ecrã
 * no primeiro instante — só aparece depois de alguém abrir um diálogo ou de
 * uma notificação surgir.
 */
export function AcentoNoDocumento({ acento }: { acento: Acento }) {
  useEffect(() => {
    const raiz = document.documentElement;
    const anterior = raiz.dataset.accent;
    raiz.dataset.accent = acento;
    return () => {
      // Ao sair do painel — para o login, por exemplo — a paleta do cliente
      // não deve ficar agarrada ao documento.
      if (anterior === undefined) delete raiz.dataset.accent;
      else raiz.dataset.accent = anterior;
    };
  }, [acento]);

  return null;
}
