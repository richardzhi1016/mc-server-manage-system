import { useState } from "react"
import { MoreHorizontal, Crown, Signal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PlayerAvatar } from "./PlayerAvatar"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import type { Player } from "@/types/api"

interface PlayerCardProps {
  player: Player
  onAction: (action: string, player: Player) => void
}

export function PlayerCard({ player, onAction }: PlayerCardProps) {
  const { t } = useTranslation('players')
  const [menuOpen, setMenuOpen] = useState(false)

  const latencyColor =
    player.latency < 100 ? "text-green-500" : player.latency < 200 ? "text-yellow-500" : "text-red-500"

  const handleAction = (action: string) => {
    onAction(action, player)
    setMenuOpen(false)
  }

  return (
    <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <PlayerAvatar uuid={player.uuid} username={player.username} size="lg" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 dark:text-white truncate">{player.username}</h3>
            {player.isOp && <Crown className="w-4 h-4 text-yellow-500" />}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{player.uuid}</p>
          <div className="flex items-center gap-1 mt-1">
            <Signal className={cn("w-3 h-3", latencyColor)} />
            <span className={cn("text-xs font-medium", latencyColor)}>
              {player.latency > 0 ? `${player.latency}ms` : "?"}
            </span>
          </div>
        </div>

        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Player actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                <button
                  className="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleAction("teleport")}
                >
                  {t('actions.teleport')}
                </button>
                <button
                  className="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleAction("op")}
                >
                  {player.isOp ? t('actions.deop') : t('actions.op')}
                </button>
                <hr className="my-1 border-gray-200 dark:border-gray-700" />
                <button
                  className="w-full px-3 py-1.5 text-left text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                  onClick={() => handleAction("kick")}
                >
                  {t('actions.kick')}
                </button>
                <button
                  className="w-full px-3 py-1.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => handleAction("ban")}
                >
                  {t('actions.ban')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
