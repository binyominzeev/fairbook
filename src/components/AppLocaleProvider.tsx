"use client";

import { createContext, useContext } from "react";
import type { AppLocale } from "@/lib/i18n";

const AppLocaleContext = createContext<AppLocale>("hu");

export function AppLocaleProvider({
  locale,
  children,
}: {
  locale: AppLocale;
  children: React.ReactNode;
}) {
  return <AppLocaleContext.Provider value={locale}>{children}</AppLocaleContext.Provider>;
}

export function useAppLocale(): AppLocale {
  return useContext(AppLocaleContext);
}
