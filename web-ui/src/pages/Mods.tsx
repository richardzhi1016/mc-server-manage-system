import { useState, useEffect, useCallback } from "react"
import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Package, AlertTriangle, RotateCcw, Loader2 } from "lucide-react"
import { useModStore } from "@/store/useModStore"
import { useServerStore } from "@/store/useServerStore"
import {
  getInstalledMods,
  toggleMod,
  deleteMod,
  stopServer,
  startServer,
} from "@/api/client"
import { ModCard } from "@/components/mods/ModCard"
import { ModMarket } from "@/components/mods/ModMarket"
import type { InstalledMod } from "@/types/api"

export default function Mods() {
  const { t } = useTranslation("mods")
  const { t: tc } = useTranslation("common")
  const { serverName } = useParams<{ serverName: string }>()
  const servers = useServerStore((s) => s.servers)
  const server = servers.find((s) => s.name === serverName)

  const {
    installedMods, installedFilter, loading, installing, restartRequired,
    setInstalledMods, setInstalledFilter, setLoading,
    addInstalling, removeInstalling, setRestartRequired,
  } = useModStore()

  const [activeTab, setActiveTab] = useState<"market" | "installed">("market")

  const serverVersion = server?.version ?? ""
  const serverLoader = server?.server_type ?? ""

  const loadInstalled = useCallback(async () => {
    if (!serverName) return
    setLoading(true)
    try {
      const data = await getInstalledMods(serverName)
      setInstalledMods(data.mods)
    } catch { /* handled by empty state */ } finally {
      setLoading(false)
    }
  }, [serverName, setInstalledMods, setLoading])

  useEffect(() => { loadInstalled() }, [loadInstalled])

  const handleToggle = async (filename: string) => {
    if (!serverName) return
    try {
      const result = await toggleMod(serverName, filename)
      if (result.restart_required) setRestartRequired(true)
      await loadInstalled()
    } catch { /* error handled */ }
  }

  const handleDelete = async (filename: string) => {
    if (!serverName || !confirm(`Delete ${filename}?`)) return
    try {
      const result = await deleteMod(serverName, filename)
      if (result.restart_required) setRestartRequired(true)
      await loadInstalled()
    } catch { /* error handled */ }
  }

  const handleRestart = async () => {
    if (!serverName) return
    try {
      await stopServer({ server_name: serverName })
      await new Promise((r) => setTimeout(r, 2000))
      await startServer({ server_name: serverName })
      setRestartRequired(false)
    } catch { /* error handled */ }
  }

  const filteredMods = installedMods.filter((mod: InstalledMod) => {
    if (installedFilter === "enabled") return mod.enabled
    if (installedFilter === "disabled") return !mod.enabled
    return true
  })

  const installedProjectIds = new Set(
    installedMods.map((m) => m.modrinth_project_id).filter((id): id is string => id !== null)
  )

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Package size={24} className="text-blue-500" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t("title")}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("manage", { server: serverName })}</p>
        </div>
      </div>

      {/* Restart warning */}
      {restartRequired && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle size={16} />
            {t("changed")}
          </div>
          <button
            onClick={handleRestart}
            className="flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            <RotateCcw size={14} />
            {tc("actions.restart")}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-700">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab("market")}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "market"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {t("market.browse")}
          </button>
          <button
            onClick={() => setActiveTab("installed")}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "installed"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {t("market.installedTab")} ({installedMods.length})
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "market" ? (
        <ModMarket
          type="mod"
          serverName={serverName!}
          serverVersion={serverVersion}
          serverLoader={serverLoader}
          installedProjectIds={installedProjectIds}
          installing={installing}
          addInstalling={addInstalling}
          removeInstalling={removeInstalling}
          setRestartRequired={setRestartRequired}
          onInstallSuccess={loadInstalled}
        />
      ) : (
        <div>
          {/* Filter bar */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
              {t("installed", { count: installedMods.length })}
            </h2>
            <div className="flex gap-1">
              {(["all", "enabled", "disabled"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setInstalledFilter(f)}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    installedFilter === f
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {f === "all" ? t("filters.all") : f === "enabled" ? t("filters.enabled") : t("filters.disabled")}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-zinc-400" />
            </div>
          ) : filteredMods.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
              <Package size={32} className="mx-auto text-zinc-300 dark:text-zinc-600" />
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t("empty")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMods.map((mod) => (
                <ModCard key={mod.filename} mod={mod} onToggle={handleToggle} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
