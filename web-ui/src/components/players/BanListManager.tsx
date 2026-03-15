import { useState } from "react"
import { RotateCcw, Ban } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/Button"
import { ConfirmModal } from "./ConfirmModal"
import { currentLocale } from "@/i18n/locale"
import type { BanEntry } from "@/types/api"

interface BanListManagerProps {
  bans: BanEntry[]
  onUnban: (username: string) => void
}

export function BanListManager({ bans, onUnban }: BanListManagerProps) {
  const { t } = useTranslation('players')
  const [unbanUsername, setUnbanUsername] = useState<string | null>(null)

  const handleUnban = () => {
    if (unbanUsername) {
      onUnban(unbanUsername)
      setUnbanUsername(null)
    }
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-white">{t('banList.title')}</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">{t('banList.count', { count: bans.length })}</span>
        </div>

        {bans.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Ban className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>{t('banList.empty')}</p>
            <p className="text-sm mt-1">{t('banList.emptyDesc')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {bans.map((entry) => (
              <div
                key={entry.username}
                className="flex items-start justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      {entry.username}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      {t('banList.banned')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{entry.uuid}</p>
                  {entry.reason && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('banList.reason', { reason: entry.reason })}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {t('banList.bannedAt', { date: new Date(entry.banned_at).toLocaleString(currentLocale()) })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 ml-2"
                  onClick={() => setUnbanUsername(entry.username)}
                  title={t('banList.unban')}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!unbanUsername}
        onClose={() => setUnbanUsername(null)}
        onConfirm={handleUnban}
        title={t('banList.unban')}
        message={t('banList.unbanConfirm', { username: unbanUsername ?? '' })}
        variant="warning"
      />
    </>
  )
}
