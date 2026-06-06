"use client";

import React, { createContext, useContext, useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import ptMessages from "../messages/pt-BR.json";
import esMessages from "../messages/es-PY.json";

type Language = "pt" | "es";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  pt: {
    "common.filter": "Filtrar",
    "common.search": "Buscar",
    "common.save": "Salvar",
    "common.cancel": "Cancelar",
    "common.delete": "Excluir",
    "common.edit": "Editar",
    "common.loading": "Carregando...",
    "common.actions": "Ações",
    "dashboard.welcome": "Bem-vindo ao AXIS ERP",
    "reports.filters.type": "Tipo de Relatório",
    "reports.filters.exportPDF": "Exportar PDF",
    "reports.table.date": "Data",
    "reports.table.total": "Total",
    "suppliers.title": "Fornecedores",
    "suppliers.newSupplier": "Novo Fornecedor",
    "inventory.title": "Estoque",
    "inventory.adjustStock": "Ajustar Estoque",
    "accounting.title": "Contabilidade",
    "accounting.description": "Lançamentos contábeis",
  },
  es: {
    "common.filter": "Filtrar",
    "common.search": "Buscar",
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.delete": "Eliminar",
    "common.edit": "Editar",
    "common.loading": "Cargando...",
    "common.actions": "Acciones",
    "dashboard.welcome": "Bienvenido a AXIS ERP",
    "reports.filters.type": "Tipo de Reporte",
    "reports.filters.exportPDF": "Exportar PDF",
    "reports.table.date": "Fecha",
    "reports.table.total": "Total",
    "suppliers.title": "Proveedores",
    "suppliers.newSupplier": "Nuevo Proveedor",
    "inventory.title": "Inventario",
    "inventory.adjustStock": "Ajustar Inventario",
    "accounting.title": "Contabilidad",
    "accounting.description": "Asientos contables",
  },
};

const LanguageContext = createContext<LanguageContextType>({
  language: "pt",
  setLanguage: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("pt");

  // Sync state with cookie on client side mount
  React.useEffect(() => {
    const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
    if (match) {
      const cookieLocale = match[1];
      if (cookieLocale === "es-PY") {
        setLanguageState("es");
      } else {
        setLanguageState("pt");
      }
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    const localeVal = lang === "pt" ? "pt-BR" : "es-PY";
    document.cookie = `NEXT_LOCALE=${localeVal}; path=/; max-age=31536000`;
    // Reload page to refresh server components with the new locale
    window.location.reload();
  };

  const locale = language === "pt" ? "pt-BR" : "es-PY";
  const messages = language === "pt" ? ptMessages : esMessages;

  const t = (key: string): string => {
    return translations[language]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
