import { create } from "zustand"
import type { InstalledPlugin, ModSearchResult } from "@/types/api"

interface PluginState {
  installedPlugins: InstalledPlugin[]
  searchResults: ModSearchResult[]
  searchQuery: string
  searchTotalHits: number
  searchPage: number
  installedFilter: "all" | "enabled" | "disabled"
  loading: boolean
  searchLoading: boolean
  installing: Set<string>  // project_ids currently being installed
  restartRequired: boolean
}

interface PluginActions {
  setInstalledPlugins: (plugins: InstalledPlugin[]) => void
  setSearchResults: (results: ModSearchResult[], totalHits: number) => void
  appendSearchResults: (results: ModSearchResult[], totalHits: number) => void
  setSearchQuery: (query: string) => void
  setSearchPage: (page: number) => void
  setInstalledFilter: (filter: PluginState["installedFilter"]) => void
  setLoading: (loading: boolean) => void
  setSearchLoading: (loading: boolean) => void
  addInstalling: (projectId: string) => void
  removeInstalling: (projectId: string) => void
  setRestartRequired: (required: boolean) => void
  clearSearch: () => void
}

export const usePluginStore = create<PluginState & PluginActions>()((set) => ({
  installedPlugins: [],
  searchResults: [],
  searchQuery: "",
  searchTotalHits: 0,
  searchPage: 0,
  installedFilter: "all",
  loading: false,
  searchLoading: false,
  installing: new Set<string>(),
  restartRequired: false,

  setInstalledPlugins: (plugins) => set({ installedPlugins: plugins }),

  setSearchResults: (results, totalHits) =>
    set({ searchResults: results, searchTotalHits: totalHits }),

  appendSearchResults: (results, totalHits) =>
    set((state) => ({
      searchResults: [...state.searchResults, ...results],
      searchTotalHits: totalHits,
    })),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSearchPage: (page) => set({ searchPage: page }),

  setInstalledFilter: (filter) => set({ installedFilter: filter }),

  setLoading: (loading) => set({ loading }),

  setSearchLoading: (loading) => set({ searchLoading: loading }),

  addInstalling: (projectId) =>
    set((state) => ({
      installing: new Set([...state.installing, projectId]),
    })),

  removeInstalling: (projectId) =>
    set((state) => {
      const next = new Set(state.installing)
      next.delete(projectId)
      return { installing: next }
    }),

  setRestartRequired: (required) => set({ restartRequired: required }),

  clearSearch: () =>
    set({
      searchResults: [],
      searchQuery: "",
      searchTotalHits: 0,
      searchPage: 0,
    }),
}))
