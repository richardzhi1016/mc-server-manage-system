import { useState, useEffect, useCallback } from "react"
import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Users, RefreshCw, UserPlus, Ban } from "lucide-react"
import { PlayerCard } from "@/components/players/PlayerCard"
import { BanReasonModal } from "@/components/players/BanReasonModal"
import { ConfirmModal } from "@/components/players/ConfirmModal"
import { TeleportModal } from "@/components/players/TeleportModal"
import { WhitelistManager } from "@/components/players/WhitelistManager"
import { BanListManager } from "@/components/players/BanListManager"
import { Button } from "@/components/ui/Button"
import { usePlayerStore } from "@/store/usePlayerStore"
import { useUIStore } from "@/store/useUIStore"
import {
  getOnlinePlayers,
  kickPlayer,
  banPlayer,
  unbanPlayer,
  opPlayer,
  deopPlayer,
  teleportPlayer as teleportPlayerApi,
  addToWhitelist,
  removeFromWhitelist,
  getWhitelist,
  getBans,
} from "@/api/client"
import type { Player } from "@/types/api"

type TabType = "online" | "whitelist" | "bans"

export default function PlayersPage() {
  const { serverName } = useParams<{ serverName: string }>()
  const { t } = useTranslation('players')
  const { t: tc } = useTranslation('common')
  const { onlinePlayers, setOnlinePlayers, whitelist, setWhitelist, bans, setBans, setError } =
    usePlayerStore()
  const { addToast } = useUIStore()

  const [activeTab, setActiveTab] = useState<TabType>("online")
  const selectedServer = serverName || ""
  const [loading, setLoading] = useState(false)

  const [banModalOpen, setBanModalOpen] = useState(false)
  const [banTarget, setBanTarget] = useState<Player | null>(null)

  const [kickConfirmOpen, setKickConfirmOpen] = useState(false)
  const [kickTarget, setKickTarget] = useState<Player | null>(null)

  const [opConfirmOpen, setOpConfirmOpen] = useState(false)
  const [opTarget, setOpTarget] = useState<Player | null>(null)

  const [teleportModalOpen, setTeleportModalOpen] = useState(false)
  const [teleportPlayer, setTeleportPlayerSource] = useState<Player | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const playersResponse = await getOnlinePlayers(selectedServer || undefined)
      setOnlinePlayers(playersResponse.players || [])

      const whitelistResponse = await getWhitelist(selectedServer || undefined)
      setWhitelist(whitelistResponse.players || [])

      const bansResponse = await getBans(selectedServer || undefined)
      setBans(bansResponse.banned_players || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch player data")
    } finally {
      setLoading(false)
    }
  }, [selectedServer, setOnlinePlayers, setWhitelist, setBans, setError])


  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleAction = (action: string, player: Player) => {
    switch (action) {
      case "kick":
        setKickTarget(player)
        setKickConfirmOpen(true)
        break
      case "ban":
        setBanTarget(player)
        setBanModalOpen(true)
        break
      case "op":
        setOpTarget(player)
        setOpConfirmOpen(true)
        break
      case "teleport":
        setTeleportPlayerSource(player)
        setTeleportModalOpen(true)
        break
    }
  }

  const handleKick = async () => {
    if (!kickTarget) return
    try {
      await kickPlayer({
        server_name: selectedServer || "",
        username: kickTarget.username,
      })
      setOnlinePlayers(onlinePlayers.filter((p) => p.username !== kickTarget.username))
      addToast({ type: "success", message: t('kick.success', { username: kickTarget.username }) })
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : t('kick.fail'),
      })
    }
  }

  const handleBan = async (reason: string) => {
    if (!banTarget) return
    try {
      await banPlayer({
        server_name: selectedServer || "",
        username: banTarget.username,
        reason,
      })
      setOnlinePlayers(onlinePlayers.filter((p) => p.username !== banTarget.username))
      addToast({ type: "success", message: t('ban.success', { username: banTarget.username }) })
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : t('ban.fail'),
      })
    }
  }

  const handleOp = async () => {
    if (!opTarget) return
    try {
      if (opTarget.isOp) {
        await deopPlayer({
          server_name: selectedServer || "",
          username: opTarget.username,
        })
        setOnlinePlayers(
          onlinePlayers.map((p) =>
            p.username === opTarget.username ? { ...p, isOp: false } : p
          )
        )
        addToast({ type: "success", message: t('op.revoked', { username: opTarget.username }) })
      } else {
        await opPlayer({
          server_name: selectedServer || "",
          username: opTarget.username,
        })
        setOnlinePlayers(
          onlinePlayers.map((p) =>
            p.username === opTarget.username ? { ...p, isOp: true } : p
          )
        )
        addToast({ type: "success", message: t('op.granted', { username: opTarget.username }) })
      }
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : t('op.fail'),
      })
    }
  }

  const handleTeleport = async (targetUsername: string) => {
    if (!teleportPlayer) return
    try {
      await teleportPlayerApi({
        server_name: selectedServer || "",
        player: teleportPlayer.username,
        target: targetUsername,
      })
      addToast({
        type: "success",
        message: t('teleport.success', { username: teleportPlayer.username, target: targetUsername }),
      })
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : t('teleport.fail'),
      })
    }
  }

  const handleAddToWhitelist = async (username: string) => {
    try {
      await addToWhitelist({
        server_name: selectedServer || "",
        username,
      })
      addToast({ type: "success", message: t('whitelist.addSuccess', { username }) })
      fetchData()
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : t('whitelist.addFail'),
      })
    }
  }

  const handleRemoveFromWhitelist = async (username: string) => {
    try {
      await removeFromWhitelist({
        server_name: selectedServer || "",
        username,
      })
      addToast({ type: "success", message: t('whitelist.removeSuccess', { username }) })
      fetchData()
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : t('whitelist.removeFail'),
      })
    }
  }

  const handleUnban = async (username: string) => {
    try {
      await unbanPlayer({
        server_name: selectedServer || "",
        username,
      })
      addToast({ type: "success", message: t('banList.unbanSuccess', { username }) })
      fetchData()
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : t('banList.unbanFail'),
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {tc('actions.refresh')}
        </Button>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
        <button
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "online"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
          onClick={() => setActiveTab("online")}
        >
          <Users className="w-4 h-4 inline mr-2" />
          {t('tabs.online', { count: onlinePlayers.length })}
        </button>
        <button
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "whitelist"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
          onClick={() => setActiveTab("whitelist")}
        >
          <UserPlus className="w-4 h-4 inline mr-2" />
          {t('tabs.whitelist', { count: whitelist.length })}
        </button>
        <button
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "bans"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
          onClick={() => setActiveTab("bans")}
        >
          <Ban className="w-4 h-4 inline mr-2" />
          {t('tabs.bans', { count: bans.length })}
        </button>
      </div>

      {activeTab === "online" && (
        <>
          {onlinePlayers.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
              <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {t('noOnline')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {t('noOnlineDesc')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {onlinePlayers.map((player) => (
                <PlayerCard key={player.uuid} player={player} onAction={handleAction} />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "whitelist" && (
        <WhitelistManager
          whitelist={whitelist}
          onAdd={handleAddToWhitelist}
          onRemove={handleRemoveFromWhitelist}
        />
      )}

      {activeTab === "bans" && (
        <BanListManager bans={bans} onUnban={handleUnban} />
      )}

      <BanReasonModal
        open={banModalOpen}
        onClose={() => setBanModalOpen(false)}
        username={banTarget?.username || ""}
        onConfirm={handleBan}
      />

      <ConfirmModal
        open={kickConfirmOpen}
        onClose={() => setKickConfirmOpen(false)}
        onConfirm={handleKick}
        title={t('kick.title')}
        message={t('kick.confirm', { username: kickTarget?.username })}
        confirmText={t('actions.kick')}
        variant="warning"
      />

      <ConfirmModal
        open={opConfirmOpen}
        onClose={() => setOpConfirmOpen(false)}
        onConfirm={handleOp}
        title={opTarget?.isOp ? t('op.revokeTitle') : t('op.grantTitle')}
        message={opTarget?.isOp ? t('op.revokeConfirm', { username: opTarget?.username }) : t('op.grantConfirm', { username: opTarget?.username })}
        confirmText={tc('actions.confirm')}
        variant="info"
      />

      <TeleportModal
        open={teleportModalOpen}
        onClose={() => setTeleportModalOpen(false)}
        player={teleportPlayer}
        availablePlayers={onlinePlayers}
        onConfirm={handleTeleport}
      />
    </div>
  )
}
