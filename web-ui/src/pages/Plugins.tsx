import { useState, useEffect, useCallback } from "react"
import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Puzzle, Search, AlertTriangle, RotateCcw, Loader2 } from "lucide-react"
import { usePluginStore } from "@/store/usePluginStore"
import { useServerStore } from "@/store/useServerStore"
import {
  getInstalledPlugins,
  searchPlugins,
  installPlugin,
  togglePlugin,
  deletePlugin,
  checkPluginDependencies,
  stopServer,
  startServer,
} from "@/api/client"
import { ModCard } from "@/components/mods/ModCard"
import { ModSearchResult } from "@/components/mods/ModSearchResult"
import { ModDetailPanel } from "@/components/mods/ModDetailPanel"
import { DependencyModal } from "@/components/mods/DependencyModal"
import type { InstalledMod, InstalledPlugin, ModDependency } from "@/types/api"

export default function Plugins() {
  const { t } = useTranslation('mods')
  const { t: tc } = useTranslation('common')
  const { serverName } = useParams<{ serverName: string }>()
  const servers = useServerStore((s) => s.servers)
  const server = servers.find((s) => s.name === serverName)

  const {
    installedPlugins, searchResults, searchQuery, searchTotalHits,
    searchPage, installedFilter, loading, searchLoading,
    installing, restartRequired,
    setInstalledPlugins, setSearchResults, appendSearchResults,
    setSearchQuery, setSearchPage, setInstalledFilter, setLoading,
    setSearchLoading, addInstalling, removeInstalling,
    setRestartRequired,
  } = usePluginStore()

  const [selectedProject, setSelectedProject] = useState<{
    projectId: string; title: string; description: string; iconUrl: string | null
  } | null>(null)

  const [depsModal, setDepsModal] = useState<{
    modName: string; missing: ModDependency[]; versionId: string; projectId: string
  } | null>(null)
  const [depsInstalling, setDepsInstalling] = useState(false)

  const serverVersion = server?.version || ""

  // Load installed plugins
  const loadInstalled = useCallback(async () => {
    if (!serverName) return
    setLoading(true)
    try {
      const data = await getInstalledPlugins(serverName)
      setInstalledPlugins(data.plugins)
    } catch {
      // handled by error state
    } finally {
      setLoading(false)
    }
  }, [serverName, setInstalledPlugins, setLoading])

  useEffect(() => { loadInstalled() }, [loadInstalled])

  // Search plugins
  const handleSearch = useCallback(async (query: string, page: number = 0) => {
    if (!query.trim() || !serverVersion) return
    setSearchLoading(true)
    try {
      const data = await searchPlugins(query, serverVersion, page)
      if (page === 0) {
        setSearchResults(data.hits, data.total_hits)
      } else {
        appendSearchResults(data.hits, data.total_hits)
      }
      setSearchPage(page)
    } catch {
      if (page === 0) setSearchResults([], 0)
    } finally {
      setSearchLoading(false)
    }
  }, [serverVersion, setSearchResults, appendSearchResults, setSearchPage, setSearchLoading])

  // Install flow
  const handleInstallClick = async (projectId: string, versionId: string) => {
    if (!serverName) return

    try {
      const deps = await checkPluginDependencies(serverName, versionId)
      if (deps.missing.length > 0) {
        const mod = searchResults.find((m) => m.project_id === projectId)
        setDepsModal({
          modName: mod?.title || projectId,
          missing: deps.missing,
          versionId,
          projectId,
        })
        return
      }
    } catch {
      // Proceed without dep check if it fails
    }

    await doInstall(projectId, versionId)
  }

  const doInstall = async (projectId: string, versionId: string) => {
    if (!serverName) return
    addInstalling(projectId)
    try {
      const result = await installPlugin(serverName, { project_id: projectId, version_id: versionId })
      if (result.restart_required) {
        setRestartRequired(true)
      }
      await loadInstalled()
    } finally {
      removeInstalling(projectId)
    }
  }

  const handleDepsConfirm = async () => {
    if (!depsModal || !serverName) return
    setDepsInstalling(true)
    try {
      for (const dep of depsModal.missing) {
        if (dep.version_id) {
          await doInstall(dep.project_id, dep.version_id)
        }
      }
      await doInstall(depsModal.projectId, depsModal.versionId)
    } finally {
      setDepsInstalling(false)
      setDepsModal(null)
    }
  }

  // Toggle & Delete
  const handleToggle = async (filename: string) => {
    if (!serverName) return
    try {
      const result = await togglePlugin(serverName, filename)
      if (result.restart_required) setRestartRequired(true)
      await loadInstalled()
    } catch { /* error toast */ }
  }

  const handleDelete = async (filename: string) => {
    if (!serverName || !confirm(`Delete ${filename}?`)) return
    try {
      const result = await deletePlugin(serverName, filename)
      if (result.restart_required) setRestartRequired(true)
      await loadInstalled()
    } catch { /* error toast */ }
  }

  // Restart server
  const handleRestart = async () => {
    if (!serverName) return
    try {
      await stopServer({ server_name: serverName })
      await new Promise((r) => setTimeout(r, 2000))
      await startServer({ server_name: serverName })
      setRestartRequired(false)
    } catch { /* error toast */ }
  }

  // Filter installed plugins
  const filteredPlugins = installedPlugins.filter((p) => {
    if (installedFilter === "enabled") return p.enabled
    if (installedFilter === "disabled") return !p.enabled
    return true
  })

  const installedProjectIds = new Set(
    installedPlugins
      .map((p) => p.modrinth_project_id)
      .filter((id): id is string => id !== null)
  )

  // ModCard expects InstalledMod shape — InstalledPlugin is compatible (mod_id is null for plugins)
  const toModShape = (p: InstalledPlugin): InstalledMod => ({
    ...p,
    mod_id: null,
  })

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Puzzle size={24} className="text-sky-500" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t('plugins.title')}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t('plugins.manage', { server: serverName })}
          </p>
        </div>
      </div>

      {/* Restart warning */}
      {restartRequired && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle size={16} />
            {t('plugins.changed')}
          </div>
          <button
            onClick={handleRestart}
            className="flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            <RotateCcw size={14} />
            {tc('actions.restart')}
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Installed */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
              {t('plugins.installed', { count: installedPlugins.length })}
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
                  {f === "all" ? t('filters.all') : f === "enabled" ? t('filters.enabled') : t('filters.disabled')}
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
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {t('plugins.empty')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPlugins.map((plugin) => (
                <ModCard
                  key={plugin.filename}
                  mod={toModShape(plugin)}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Search & Install */}
        <div>
          <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">
            {t('plugins.browse')}
          </h2>

          {/* Search bar */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder={t('plugins.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch(searchQuery)
              }}
              className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            />
          </div>

          {/* Detail panel (shown when a plugin is selected) */}
          {selectedProject && (
            <div className="mb-4">
              <ModDetailPanel
                projectId={selectedProject.projectId}
                title={selectedProject.title}
                description={selectedProject.description}
                iconUrl={selectedProject.iconUrl}
                serverVersion={serverVersion}
                serverLoader="paper"
                onInstall={(versionId) =>
                  handleInstallClick(selectedProject.projectId, versionId)
                }
                onClose={() => setSelectedProject(null)}
                installing={installing.has(selectedProject.projectId)}
              />
            </div>
          )}

          {/* Search results */}
          {searchLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-zinc-400" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-2">
              {searchResults.map((plugin) => (
                <ModSearchResult
                  key={plugin.project_id}
                  mod={plugin}
                  isInstalled={installedProjectIds.has(plugin.project_id)}
                  isInstalling={installing.has(plugin.project_id)}
                  onSelect={(projectId) => {
                    setSelectedProject({
                      projectId,
                      title: plugin.title,
                      description: plugin.description,
                      iconUrl: plugin.icon_url,
                    })
                  }}
                />
              ))}
              {searchTotalHits > (searchPage + 1) * 20 && (
                <button
                  onClick={() => handleSearch(searchQuery, searchPage + 1)}
                  className="w-full rounded-md border border-zinc-300 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  {tc('actions.loadMore')}
                </button>
              )}
            </div>
          ) : searchQuery ? (
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {t('plugins.noResults')}
            </p>
          ) : (
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {t('plugins.browseHint')}
            </p>
          )}
        </div>
      </div>

      {/* Dependency modal */}
      {depsModal && (
        <DependencyModal
          modName={depsModal.modName}
          missing={depsModal.missing}
          onConfirm={handleDepsConfirm}
          onCancel={() => setDepsModal(null)}
          loading={depsInstalling}
        />
      )}
    </div>
  )
}
