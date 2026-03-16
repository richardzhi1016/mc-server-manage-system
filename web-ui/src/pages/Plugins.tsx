import { useState, useEffect, useCallback } from "react"
import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Puzzle, AlertTriangle, RotateCcw, Loader2 } from "lucide-react"
import { usePluginStore } from "@/store/usePluginStore"
import { useServerStore } from "@/store/useServerStore"
import {
  getInstalledPlugins,
  togglePlugin,
  deletePlugin,
  stopServer,
  startServer,
} from "@/api/client"
import { ModCard } from "@/components/mods/ModCard"
import { ModMarket } from "@/components/mods/ModMarket"
import type { InstalledMod, InstalledPlugin } from "@/types/api"

export default function Plugins() {
  const { t } = useTranslation("mods")
  const { t: tc } = useTranslation("common")
  const { serverName } = useParams<{ serverName: string }>()
  const servers = useServerStore((s) => s.servers)
  const server = servers.find((s) => s.name === serverName)

  const {
    installedPlugins, installedFilter, loading, installing, restartRequired,
    setInstalledPlugins, setInstalledFilter, setLoading,
    addInstalling, removeInstalling, setRestartRequired,
  } = usePluginStore()

  const [activeTab, setActiveTab] = useState<"market" | "installed">("market")

  const serverVersion = server?.version ?? ""

  const loadInstalled = useCallback(async () => {
    if (!serverName) return
    setLoading(true)
    try {
      const data = await getInstalledPlugins(serverName)
      setInstalledPlugins(data.plugins)
    } catch { /* handled by empty state */ } finally {
      setLoading(false)
    }
  }, [serverName, setInstalledPlugins, setLoading])

  useEffect(() => { loadInstalled() }, [loadInstalled])

  const handleToggle = async (filename: string) => {
    if (!serverName) return
    try {
      const result = await togglePlugin(serverName, filename)
      if (result.restart_required) setRestartRequired(true)
      await loadInstalled()
    } catch { /* error handled */ }
  }

  const handleDelete = async (filename: string) => {
    if (!serverName || !confirm(`Delete ${filename}?`)) return
    try {
      const result = await deletePlugin(serverName, filename)
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

  const filteredPlugins = installedPlugins.filter((p: InstalledPlugin) => {
    if (installedFilter === "enabled") return p.enabled
    if (installedFilter === "disabled") return !p.enabled
    return true
  })

  const installedProjectIds = new Set(
    installedPlugins.map((p) => p.modrinth_project_id).filter((id): id is string => id !== null)
  )

  const toModShape = (p: InstalledPlugin): InstalledMod => ({ ...p, mod_id: null })

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Puzzle size={24} className="text-sky-500" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t("plugins.title")}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("plugins.manage", { server: serverName })}</p>
        </div>
      </div>

      {/* Restart warning */}
      {restartRequired && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle size={16} />
            {t("plugins.changed")}
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
                ? "border-sky-500 text-sky-600 dark:text-sky-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {t("market.browse")}
          </button>
          <button
            onClick={() => setActiveTab("installed")}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "installed"
                ? "border-sky-500 text-sky-600 dark:text-sky-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {t("market.installedTab")} ({installedPlugins.length})
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "market" ? (
        <ModMarket
          type="plugin"
          serverName={serverName!}
          serverVersion={serverVersion}
          serverLoader="paper"
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
              {t("plugins.installed", { count: installedPlugins.length })}
            </h2>
            <div className="flex gap-1">
              {(["all", "enabled", "disabled"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setInstalledFilter(f)}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    installedFilter === f
                      ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
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
          ) : filteredPlugins.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
              <Puzzle size={32} className="mx-auto text-zinc-300 dark:text-zinc-600" />
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t("plugins.empty")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPlugins.map((plugin) => (
                <ModCard key={plugin.filename} mod={toModShape(plugin)} onToggle={handleToggle} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
