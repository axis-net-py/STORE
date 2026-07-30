"use client";

import React, { createContext, useContext, useState } from "react";
import { NextIntlClientProvider } from "next-intl";

type Language = "pt" | "es";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "pt",
  setLanguage: () => {},
});

interface LanguageProviderProps {
  children: React.ReactNode;
  /** Locale resolvido no servidor a partir do cookie NEXT_LOCALE. */
  locale: string;
  /** Mensagens do locale ativo, carregadas no servidor. */
  messages: Record<string, unknown>;
}

/**
 * Mantém o idioma da UI em sincronia com o servidor.
 *
 * O locale e as mensagens vêm prontos do layout (server component), evitando
 * a divergência que fazia os componentes de cliente renderizarem em português
 * mesmo com o espanhol selecionado.
 */
export function LanguageProvider({
  children,
  locale,
  messages,
}: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(
    locale === "es-PY" ? "es" : "pt"
  );

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    const localeVal = lang === "pt" ? "pt-BR" : "es-PY";
    document.cookie = `NEXT_LOCALE=${localeVal}; path=/; max-age=31536000`;
    // Recarrega para que os server components também usem o novo idioma.
    window.location.reload();
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
