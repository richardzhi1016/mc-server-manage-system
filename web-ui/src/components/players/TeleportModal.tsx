import { useState } from "react"
import { Users } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Modal } from "./Modal"
import { Button } from "@/components/ui/Button"
import { PlayerAvatar } from "./PlayerAvatar"
import { cn } from "@/lib/utils"
import type { Player } from "@/types/api"

interface TeleportModalProps {
  open: boolean
  onClose: () => void
  player: Player | null
  availablePlayers: Player[]
  onConfirm: (targetUsername: string) => void
}

export function TeleportModal({ open, onClose, player, availablePlayers, onConfirm }: TeleportModalProps) {
  const { t } = useTranslation('players')
  const { t: tc } = useTranslation('common')
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)

  if (!player) return null

  const otherPlayers = availablePlayers.filter((p) => p.username !== player.username)

  const handleConfirm = () => {
    if (selectedTarget) {
      onConfirm(selectedTarget)
      setSelectedTarget(null)
      onClose()
    }
  }

  const handleClose = () => {
    setSelectedTarget(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('teleport.title', { username: player.username })} size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('teleport.select')}</p>

        {otherPlayers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{t('teleport.noOthers')}</p>
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto space-y-2">
            {otherPlayers.map((targetPlayer) => (
              <button
                key={targetPlayer.username}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-lg border transition-colors",
                  selectedTarget === targetPlayer.username
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
                onClick={() => setSelectedTarget(targetPlayer.username)}
              >
                <PlayerAvatar uuid={targetPlayer.uuid} username={targetPlayer.username} size="sm" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {targetPlayer.username}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedTarget}>
            {t('actions.teleport')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
