import { Menu, Bell, Sun, Moon, Globe, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/useTheme'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'

interface TopNavProps {
  onMenuToggle: () => void
  serverName?: string
  serverStatus?: string
}

const LANGUAGES = [
  { code: 'zh-CN', labelKey: 'language.zh' },
  { code: 'en-US', labelKey: 'language.en' },
] as const

export function TopNav({ onMenuToggle, serverName, serverStatus }: TopNavProps) {
  const { theme, toggleTheme } = useTheme()
  const { t, i18n } = useTranslation('common')
  const [langOpen, setLangOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentLangLabel = i18n.language === 'en-US' ? t('language.en') : t('language.zh')

  function handleLangChange(code: string) {
    i18next.changeLanguage(code)
    setLangOpen(false)
  }

  return (
    <header
      className={cn(
        'h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800',
        'flex items-center justify-between px-4 lg:px-6'
      )}
    >
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuToggle}
          className="lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </Button>

        {serverName && (
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('nav.server')}:</span>
            <span className="font-medium text-gray-900 dark:text-white">{serverName}</span>
            {serverStatus && (
              <span
                className={cn(
                  'px-2 py-0.5 text-xs rounded-full font-medium',
                  serverStatus === 'running'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : serverStatus === 'stopped'
                    ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                )}
              >
                {serverStatus === 'running'
                  ? t('status.running')
                  : serverStatus === 'stopped'
                  ? t('status.stopped')
                  : serverStatus}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Language Switcher */}
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="ghost"
            onClick={() => setLangOpen((o) => !o)}
            className="gap-1 px-2 h-9 text-sm"
            aria-label="Switch language"
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">{currentLangLabel}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </Button>

          {langOpen && (
            <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 py-1">
              {LANGUAGES.map(({ code, labelKey }) => (
                <button
                  key={code}
                  onClick={() => handleLangChange(code)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                    'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                    i18n.language === code
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-700 dark:text-gray-300'
                  )}
                >
                  {i18n.language === code && <Check className="w-3 h-3 flex-shrink-0" />}
                  {i18n.language !== code && <span className="w-3 h-3 flex-shrink-0" />}
                  {t(labelKey)}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </Button>

        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </Button>
      </div>
    </header>
  )
}
