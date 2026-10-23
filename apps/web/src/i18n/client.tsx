"use client";

import { createContext, useContext, useEffect } from "react";
import type { Dict } from "./dictionaries";

const DictContext = createContext<Dict | null>(null);

// the root layout's <html lang> can't read the cookie (it renders before the request data),
// so the provider corrects it once the page knows the language
export function I18nProvider({ dict, children }: { dict: Dict; children: React.ReactNode }) {
  useEffect(() => { document.documentElement.lang = dict.locale; }, [dict.locale]);
  return <DictContext.Provider value={dict}>{children}</DictContext.Provider>;
}

export function useDict(): Dict {
  const dict = useContext(DictContext);
  if (!dict) throw new Error("useDict outside I18nProvider");
  return dict;
}
