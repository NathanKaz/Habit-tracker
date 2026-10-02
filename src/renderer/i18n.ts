import { useCallback } from 'react'
import { resolveLanguage, t, type Language, type TranslationKey } from '../i18n'
import { useApp } from './state/app'

export interface I18n {
  lang: Language
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

export function systemLanguage(): string | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.language
}

export function useI18n(): I18n {
  const { state } = useApp()
  const lang = resolveLanguage(state?.settings.language, systemLanguage())
  const translate = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => t(lang, key, params),
    [lang],
  )
  return { lang, t: translate }
}
