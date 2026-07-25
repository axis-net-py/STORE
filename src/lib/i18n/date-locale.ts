"use client";

import { useLocale } from "next-intl";
import { ptBR, es } from "date-fns/locale";
import type { Locale } from "date-fns";

/**
 * Locale do date-fns correspondente ao idioma ativo.
 *
 * Evita o bug de datas/meses saírem sempre em português quando a interface
 * está em espanhol (ex.: "janeiro" em vez de "enero").
 */
export function useDateLocale(): Locale {
  return useLocale() === "es-PY" ? es : ptBR;
}

/** Locale BCP-47 para Intl.NumberFormat / toLocaleDateString. */
export function useIntlLocale(): string {
  return useLocale() === "es-PY" ? "es-PY" : "pt-BR";
}
