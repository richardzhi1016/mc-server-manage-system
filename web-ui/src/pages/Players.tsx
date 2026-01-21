import { useState, useEffect, useCallback } from "react"
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
  const { onlinePlayers, setOnlinePlayers, whitelist, setWhitelist, bans, setBans, setError } =
    usePlayerStore()
  const { addToast } = useUIStore()

  const [activeTab, setActiveTab] = useState<TabType>("online")
  const [selectedServer] = useState<string | null>(null)
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
      addToast({ type: "success", message: `${kickTarget.username} 已被踢出` })
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "踢出失败",
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
      addToast({ type: "success", message: `${banTarget.username} 已被封禁` })
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "封禁失败",
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
        addToast({ type: "success", message: `${opTarget.username} 已被取消OP` })
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
        addToast({ type: "success", message: `${opTarget.username} 已成为OP` })
      }
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "操作失败",
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
        message: `${teleportPlayer.username} 已传送到 ${targetUsername}`,
      })
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "传送失败",
      })
    }
  }

  const handleAddToWhitelist = async (username: string) => {
    try {
      await addToWhitelist({
        server_name: selectedServer || "",
        username,
      })
      addToast({ type: "success", message: `${username} 已添加到白名单` })
      fetchData()
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "添加失败",
      })
    }
  }

  const handleRemoveFromWhitelist = async (username: string) => {
    try {
      await removeFromWhitelist({
        server_name: selectedServer || "",
        username,
      })
      addToast({ type: "success", message: `${username} 已从白名单移除` })
      fetchData()
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "移除失败",
      })
    }
  }

  const handleUnban = async (username: string) => {
    try {
      await unbanPlayer({
        server_name: selectedServer || "",
        username,
      })
      addToast({ type: "success", message: `${username} 已解除封禁` })
      fetchData()
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "解除封禁失败",
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">玩家管理</h1>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          刷新
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
          在线 ({onlinePlayers.length})
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
          白名单 ({whitelist.length})
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
          封禁 ({bans.length})
        </button>
      </div>

      {activeTab === "online" && (
        <>
          {onlinePlayers.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
              <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                没有在线玩家
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                当前没有玩家在线
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
        title="踢出玩家"
        message={`确定要将 "${kickTarget?.username}" 踢出服务器吗？`}
        confirmText="踢出"
        variant="warning"
      />

      <ConfirmModal
        open={opConfirmOpen}
        onClose={() => setOpConfirmOpen(false)}
        onConfirm={handleOp}
        title={opTarget?.isOp ? "取消OP权限" : "授予OP权限"}
        message={`确定要${opTarget?.isOp ? "取消" : "授予"} "${opTarget?.username}" 的OP权限吗？`}
        confirmText="确认"
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
