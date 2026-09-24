import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language } from '../domain/enums'
import { uz, type DictKey } from './uz'
import { ru } from './ru'
import { en } from './en'

const DICTS: Record<Language, Partial<Record<DictKey, string>>> = { uz, ru, en }

interface I18nState {
  lang: Language
  setLang: (l: Language) => void
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      lang: 'uz',
      setLang: (lang) => {
        document.documentElement.lang = lang
        set({ lang })
      },
    }),
    { name: 'balans.i18n' },
  ),
)

export type TFn = (key: DictKey, vars?: Record<string, string | number>) => string

export function translate(lang: Language, key: DictKey, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? uz[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

/** Hook: `const t = useT(); t('nav.sales')` */
export function useT(): TFn {
  const lang = useI18nStore((s) => s.lang)
  return (key, vars) => translate(lang, key, vars)
}

export type { DictKey }
export const LANG_LABELS: Record<Language, string> = { uz: 'UZ', ru: 'RU', en: 'EN' }
