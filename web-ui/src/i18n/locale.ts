import i18next from 'i18next'

/** Returns the current locale string for use in toLocaleString() calls. */
export function currentLocale(): string {
  return i18next.language === 'en-US' ? 'en-US' : 'zh-CN'
}
