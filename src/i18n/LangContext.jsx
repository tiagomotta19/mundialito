import { createContext, useContext, useEffect, useState } from 'react'
import { translations } from './translations'

const LangContext = createContext(null)

const STORAGE_KEY = 'mundialito_lang'

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem(STORAGE_KEY) || 'pt')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang)
  }, [lang])

  const t = (key) => translations[lang]?.[key] ?? translations.pt[key] ?? key

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLang() {
  return useContext(LangContext)
}
