"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations, Language } from "@/lib/i18n/translations";

export type ThemeMode = "dark" | "light" | "oled";
export type CurrencyCode = "COP" | "USD" | "EUR";

interface AppContextType {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  t: (key: string) => any;
  formatMoney: (amount: number) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [language, setLanguageState] = useState<Language>("es");
  const [currency, setCurrencyState] = useState<CurrencyCode>("COP");

  // Load saved preferences on mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("tafinance_theme") as ThemeMode | null;
      if (savedTheme) {
        setThemeState(savedTheme);
        applyThemeClass(savedTheme);
      } else {
        applyThemeClass("dark");
      }

      const savedLang = localStorage.getItem("tafinance_lang") as Language | null;
      if (savedLang) {
        setLanguageState(savedLang);
        document.documentElement.lang = savedLang;
      }

      const savedCurrency = localStorage.getItem("tafinance_currency") as CurrencyCode | null;
      if (savedCurrency) setCurrencyState(savedCurrency);
    } catch {
      applyThemeClass("dark");
    }
  }, []);

  const applyThemeClass = (t: ThemeMode) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("dark", "light", "oled");
    const bg = t === "light" ? "#f1f5f9" : t === "oled" ? "#000000" : "#070A11";
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", bg));

    if (t === "light") {
      root.classList.add("light");
    } else if (t === "oled") {
      root.classList.add("dark", "oled");
    } else {
      root.classList.add("dark");
    }
  };

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    applyThemeClass(t);
    try {
      localStorage.setItem("tafinance_theme", t);
    } catch {}
  };

  const setLanguage = (l: Language) => {
    setLanguageState(l);
    if (typeof document !== "undefined") document.documentElement.lang = l;
    try {
      localStorage.setItem("tafinance_lang", l);
    } catch {}
  };

  const setCurrency = (c: CurrencyCode) => {
    setCurrencyState(c);
    try {
      localStorage.setItem("tafinance_currency", c);
    } catch {}
  };

  // Helper to fetch nested translation key e.g. "quickActions.send"
  const t = (path: string): any => {
    const keys = path.split(".");
    let current: any = translations[language];
    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        return path; // Fallback to key name
      }
    }
    return current;
  };

  const formatMoney = (amount: number): string => {
    const locale = language === "es" ? "es-CO" : "en-US";
    const formatted = Math.abs(amount).toLocaleString(locale, {
      minimumFractionDigits: currency === "COP" ? 0 : 2,
      maximumFractionDigits: currency === "COP" ? 0 : 2,
    });

    const prefix = amount < 0 ? "-" : "";
    return `${prefix}$${formatted} ${currency}`;
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        setTheme,
        language,
        setLanguage,
        currency,
        setCurrency,
        t,
        formatMoney,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
