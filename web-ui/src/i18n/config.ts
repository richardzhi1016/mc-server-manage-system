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
    resources: {
      'zh-CN': {
        common: zhCN.common,
        dashboard: zhCN.dashboard,
        players: zhCN.players,
        servers: zhCN.servers,
        mods: zhCN.mods,
        backups: zhCN.backups,
      },
      'en-US': {
        common: enUS.common,
        dashboard: enUS.dashboard,
        players: enUS.players,
        servers: enUS.servers,
        mods: enUS.mods,
        backups: enUS.backups,
      },
    },
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  })

export default i18next
