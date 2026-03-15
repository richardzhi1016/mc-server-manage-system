import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'zh-CN',
    supportedLngs: ['zh-CN', 'en-US'],
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    ns: ['common', 'dashboard', 'players', 'servers', 'mods', 'backups'],
    resources: {
      'zh-CN': zhCN,
      'en-US': enUS,
    },
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  })

export default i18next
