import i18next from 'i18next'

/**
 * Returns the current locale string for use in toLocaleString() calls.
 * Explicitly falls back to 'zh-CN' for any non-English locale, matching
 * the app's default language (fallbackLng: 'zh-CN' in i18n config).
 */
export function currentLocale(): string {
  return i18next.language === 'en-US' ? 'en-US' : 'zh-CN'
}
