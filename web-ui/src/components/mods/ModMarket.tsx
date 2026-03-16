import { useState, useEffect, useCallback, useRef } from "react"
import { Search, Grid3X3, List, ChevronDown, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ModProjectCard } from "./ModProjectCard"
import { MarketSidebar } from "./MarketSidebar"
import { ModDetailPanel } from "./ModDetailPanel"
import { DependencyModal } from "./DependencyModal"
import {
  searchMods, searchPlugins,
  installMod, installPlugin,
  checkModDependencies, checkPluginDependencies,
} from "@/api/client"
import type { ModSearchResult, ModDependency, ModSearchResponse } from "@/types/api"

type SortBy = "relevance" | "downloads" | "newest" | "updated"
type ViewMode = "grid" | "list"

interface ModMarketProps {
  type: "mod" | "plugin"
  serverName: string
  serverVersion: string
  serverLoader: string
  installedProjectIds: Set<string>
  installing: Set<string>
  addInstalling: (id: string) => void
  removeInstalling: (id: string) => void
  setRestartRequired: (v: boolean) => void
  onInstallSuccess: () => Promise<void>
}

export function ModMarket({
  type, serverName, serverVersion, serverLoader,
  installedProjectIds, installing, addInstalling, removeInstalling,
  setRestartRequired, onInstallSuccess,
}: ModMarketProps) {
  const { t } = useTranslation("mods")
  const { t: tc } = useTranslation("common")

  const [query, setQuery] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<SortBy>("downloads")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [results, setResults] = useState<ModSearchResult[]>([])
  const [totalHits, setTotalHits] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  // Track whether at least one search has completed (avoid premature empty state flash)
  const [hasSearched, setHasSearched] = useState(false)
  // Use ref for page to avoid async state race in handleLoadMore
  const pageRef = useRef(0)

  const [selectedProject, setSelectedProject] = useState<{
    projectId: string; title: string; description: string; iconUrl: string | null
  } | null>(null)

  const [depsModal, setDepsModal] = useState<{
    modName: string; missing: ModDependency[]; versionId: string; projectId: string
  } | null>(null)
  const [depsInstalling, setDepsInstalling] = useState(false)

  const [installError, setInstallError] = useState<string | null>(null)

  const doSearch = useCallback(async (
    q: string, cats: string[], sort: SortBy, pageNum: number, append: boolean,
  ) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    try {
      let data: ModSearchResponse
      if (type === "mod") {
        data = await searchMods(q, serverVersion, serverLoader, pageNum, 20, cats, sort)
      } else {
        data = await searchPlugins(q, serverVersion, pageNum, 20, cats, sort)
      }

      if (append) {
        setResults((prev) => [...prev, ...data.hits])
      } else {
        setResults(data.hits)
        pageRef.current = 0
      }
      setTotalHits(data.total_hits)
      setHasSearched(true)
    } catch {
      if (!append) { setResults([]); setTotalHits(0) }
    } finally {
      if (append) setLoadingMore(false)
      else setLoading(false)
    }
  }, [type, serverVersion, serverLoader])

  // Auto-search: immediate on mount (query is ""), debounced on query change
  useEffect(() => {
    const delay = query ? 400 : 0
    const timer = setTimeout(() => {
      doSearch(query, selectedCategories, sortBy, 0, false)
    }, delay)
    return () => clearTimeout(timer)
  }, [query, selectedCategories, sortBy, doSearch])

  const handleLoadMore = () => {
    pageRef.current += 1
    doSearch(query, selectedCategories, sortBy, pageRef.current, true)
  }

  // Install flow
  const doInstall = useCallback(async (projectId: string, versionId: string) => {
    setInstallError(null)
    addInstalling(projectId)
    try {
      const result = type === "mod"
        ? await installMod(serverName, { project_id: projectId, version_id: versionId })
        : await installPlugin(serverName, { project_id: projectId, version_id: versionId })
      if (result.restart_required) setRestartRequired(true)
      await onInstallSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setInstallError(msg)
      throw err
    } finally {
      removeInstalling(projectId)
    }
  }, [type, serverName, addInstalling, removeInstalling, setRestartRequired, onInstallSuccess])

  const handleInstallClick = async (projectId: string, versionId: string) => {
    try {
      const deps = type === "mod"
        ? await checkModDependencies(serverName, versionId)
        : await checkPluginDependencies(serverName, versionId)
      if (deps.missing.length > 0) {
        const mod = results.find((m) => m.project_id === projectId)
        setDepsModal({ modName: mod?.title ?? projectId, missing: deps.missing, versionId, projectId })
        return
      }
    } catch { /* proceed without dep check on network error */ }
    await doInstall(projectId, versionId)
  }

  const handleDepsConfirm = async () => {
    if (!depsModal) return
    setDepsInstalling(true)
    try {
      for (const dep of depsModal.missing) {
        if (dep.version_id) await doInstall(dep.project_id, dep.version_id)
      }
      await doInstall(depsModal.projectId, depsModal.versionId)
      setDepsModal(null)
    } catch {
      // Error already captured in installError; close modal so user can retry
      setDepsModal(null)
    } finally {
      setDepsInstalling(false)
    }
  }

  const searchPlaceholder = type === "mod" ? t("searchPlaceholder") : t("plugins.searchPlaceholder")

  return (
    <div className="flex gap-4">
      {/* Sidebar */}
      <MarketSidebar
        type={type}
        selectedCategories={selectedCategories}
        onCategoriesChange={setSelectedCategories}
      />

      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Search bar + controls row */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="appearance-none rounded-md border border-zinc-300 bg-white py-2 pl-3 pr-7 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
              >
                <option value="downloads">{t("market.sort.downloads")}</option>
                <option value="relevance">{t("market.sort.relevance")}</option>
                <option value="newest">{t("market.sort.newest")}</option>
                <option value="updated">{t("market.sort.updated")}</option>
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400" />
            </div>

            {/* View mode toggle */}
            <div className="flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-600">
              <button
                onClick={() => setViewMode("grid")}
                title={t("market.viewGrid")}
                className={`p-1.5 transition-colors ${viewMode === "grid" ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-600 dark:text-zinc-200" : "text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700"}`}
              >
                <Grid3X3 size={16} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                title={t("market.viewList")}
                className={`p-1.5 transition-colors ${viewMode === "list" ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-600 dark:text-zinc-200" : "text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700"}`}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Install error banner */}
        {installError && (
          <div className="mb-4 flex items-center justify-between rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
            <span>{installError}</span>
            <button onClick={() => setInstallError(null)} className="ml-2 text-red-500 hover:text-red-700">✕</button>
          </div>
        )}

        {/* Detail panel */}
        {selectedProject && (
          <div className="mb-4">
            <ModDetailPanel
              projectId={selectedProject.projectId}
              title={selectedProject.title}
              description={selectedProject.description}
              iconUrl={selectedProject.iconUrl}
              serverVersion={serverVersion}
              serverLoader={type === "plugin" ? "paper" : serverLoader}
              onInstall={(versionId) => handleInstallClick(selectedProject.projectId, versionId)}
              onClose={() => setSelectedProject(null)}
              installing={installing.has(selectedProject.projectId)}
            />
          </div>
        )}

        {/* Results area */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-zinc-400" />
          </div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {hasSearched ? t("market.noResults") : ""}
          </div>
        ) : (
          <>
            <div className={
              viewMode === "grid"
                ? "grid grid-cols-2 gap-3 xl:grid-cols-3"
                : "space-y-2"
            }>
              {results.map((mod) => (
                <ModProjectCard
                  key={mod.project_id}
                  mod={mod}
                  viewMode={viewMode}
                  isInstalled={installedProjectIds.has(mod.project_id)}
                  onSelect={(m) => setSelectedProject({
                    projectId: m.project_id,
                    title: m.title,
                    description: m.description,
                    iconUrl: m.icon_url,
                  })}
                />
              ))}
            </div>

            {totalHits > results.length && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="mt-4 w-full rounded-md border border-zinc-300 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                {loadingMore
                  ? <Loader2 size={14} className="mx-auto animate-spin" />
                  : tc("actions.loadMore")}
              </button>
            )}
          </>
        )}
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
