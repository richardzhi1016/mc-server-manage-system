import { useState, useEffect, useCallback } from "react"
import { useParams } from "react-router-dom"
import { Package, Search, AlertTriangle, RotateCcw, Loader2 } from "lucide-react"
import { useModStore } from "@/store/useModStore"
import { useServerStore } from "@/store/useServerStore"
import {
  getInstalledMods,
  searchMods,
  installMod,
  toggleMod,
  deleteMod,
  checkModDependencies,
  stopServer,
  startServer,
} from "@/api/client"
import { ModCard } from "@/components/mods/ModCard"
import { ModSearchResult } from "@/components/mods/ModSearchResult"
import { ModDetailPanel } from "@/components/mods/ModDetailPanel"
import { DependencyModal } from "@/components/mods/DependencyModal"
import type { ModDependency } from "@/types/api"

export default function Mods() {
  const { serverName } = useParams<{ serverName: string }>()
  const servers = useServerStore((s) => s.servers)
  const server = servers.find((s) => s.name === serverName)

  const {
    installedMods, searchResults, searchQuery, searchTotalHits,
    searchPage, installedFilter, loading, searchLoading,
    installing, restartRequired,
    setInstalledMods, setSearchResults, appendSearchResults,
    setSearchQuery, setSearchPage, setInstalledFilter, setLoading,
    setSearchLoading, addInstalling, removeInstalling,
    setRestartRequired,
  } = useModStore()

  const [selectedProject, setSelectedProject] = useState<{
    projectId: string; title: string; description: string; iconUrl: string | null
  } | null>(null)

  const [depsModal, setDepsModal] = useState<{
    modName: string; missing: ModDependency[]; versionId: string; projectId: string
  } | null>(null)
  const [depsInstalling, setDepsInstalling] = useState(false)

  const serverVersion = server?.version || ""
  const serverLoader = server?.server_type || ""

  // Load installed mods
  const loadInstalled = useCallback(async () => {
    if (!serverName) return
    setLoading(true)
    try {
      const data = await getInstalledMods(serverName)
      setInstalledMods(data.mods)
    } catch {
      // handled by error state
    } finally {
      setLoading(false)
    }
  }, [serverName, setInstalledMods, setLoading])

  useEffect(() => { loadInstalled() }, [loadInstalled])

  // Search mods
  const handleSearch = useCallback(async (query: string, page: number = 0) => {
    if (!query.trim() || !serverVersion || !serverLoader) return
    setSearchLoading(true)
    try {
      const data = await searchMods(query, serverVersion, serverLoader, page)
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
  }, [serverVersion, serverLoader, setSearchResults, appendSearchResults, setSearchPage, setSearchLoading])

  // Install flow
  const handleInstallClick = async (projectId: string, versionId: string) => {
    if (!serverName) return

    // Check dependencies first
    try {
      const deps = await checkModDependencies(serverName, versionId)
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
      const result = await installMod(serverName, { project_id: projectId, version_id: versionId })
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
      // Install dependencies first
      for (const dep of depsModal.missing) {
        if (dep.version_id) {
          await doInstall(dep.project_id, dep.version_id)
        }
      }
      // Install the main mod
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
      const result = await toggleMod(serverName, filename)
      if (result.restart_required) setRestartRequired(true)
      await loadInstalled()
    } catch { /* error toast */ }
  }

  const handleDelete = async (filename: string) => {
    if (!serverName || !confirm(`Delete ${filename}?`)) return
    try {
      const result = await deleteMod(serverName, filename)
      if (result.restart_required) setRestartRequired(true)
      await loadInstalled()
    } catch { /* error toast */ }
  }

  // Restart server
  const handleRestart = async () => {
    if (!serverName) return
    try {
      await stopServer({ server_name: serverName })
      // Wait briefly for clean shutdown
      await new Promise((r) => setTimeout(r, 2000))
      await startServer({ server_name: serverName })
      setRestartRequired(false)
    } catch { /* error toast */ }
  }

  // Filter installed mods
  const filteredMods = installedMods.filter((mod) => {
    if (installedFilter === "enabled") return mod.enabled
    if (installedFilter === "disabled") return !mod.enabled
    return true
  })

  const installedProjectIds = new Set(
    installedMods
      .map((m) => m.modrinth_project_id)
      .filter((id): id is string => id !== null)
  )

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Package size={24} className="text-blue-500" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">模组管理</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            管理 {serverName} 的模组
          </p>
        </div>
      </div>

      {/* Restart warning */}
      {restartRequired && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle size={16} />
            模组已变更，需要重启服务器才能生效
          </div>
          <button
            onClick={handleRestart}
            className="flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            <RotateCcw size={14} />
            重启服务器
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Installed */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
              已安装 ({installedMods.length})
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
                  {f === "all" ? "全部" : f === "enabled" ? "已启用" : "已禁用"}
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
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                暂无安装模组
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMods.map((mod) => (
                <ModCard
                  key={mod.filename}
                  mod={mod}
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
            浏览 Modrinth
          </h2>

          {/* Search bar */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="搜索模组..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch(searchQuery)
              }}
              className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            />
          </div>

          {/* Detail panel (shown when a mod is selected) */}
          {selectedProject && (
            <div className="mb-4">
              <ModDetailPanel
                projectId={selectedProject.projectId}
                title={selectedProject.title}
                description={selectedProject.description}
                iconUrl={selectedProject.iconUrl}
                serverVersion={serverVersion}
                serverLoader={serverLoader}
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
              {searchResults.map((mod) => (
                <ModSearchResult
                  key={mod.project_id}
                  mod={mod}
                  isInstalled={installedProjectIds.has(mod.project_id)}
                  isInstalling={installing.has(mod.project_id)}
                  onSelect={(projectId) => {
                    setSelectedProject({
                      projectId,
                      title: mod.title,
                      description: mod.description,
                      iconUrl: mod.icon_url,
                    })
                  }}
                />
              ))}
              {searchTotalHits > (searchPage + 1) * 20 && (
                <button
                  onClick={() => handleSearch(searchQuery, searchPage + 1)}
                  className="w-full rounded-md border border-zinc-300 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  加载更多
                </button>
              )}
            </div>
          ) : searchQuery ? (
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              未找到相关模组
            </p>
          ) : (
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              在 Modrinth 搜索模组以安装
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
