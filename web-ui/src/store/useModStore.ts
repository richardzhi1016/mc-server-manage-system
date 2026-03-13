import { create } from "zustand"
import type { InstalledMod, ModSearchResult } from "@/types/api"

interface ModState {
  installedMods: InstalledMod[]
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

interface ModActions {
  setInstalledMods: (mods: InstalledMod[]) => void
  setSearchResults: (results: ModSearchResult[], totalHits: number) => void
  appendSearchResults: (results: ModSearchResult[], totalHits: number) => void
  setSearchQuery: (query: string) => void
  setSearchPage: (page: number) => void
  setInstalledFilter: (filter: ModState["installedFilter"]) => void
  setLoading: (loading: boolean) => void
  setSearchLoading: (loading: boolean) => void
  addInstalling: (projectId: string) => void
  removeInstalling: (projectId: string) => void
  setRestartRequired: (required: boolean) => void
  clearSearch: () => void
}

export const useModStore = create<ModState & ModActions>()((set) => ({
  installedMods: [],
  searchResults: [],
  searchQuery: "",
  searchTotalHits: 0,
  searchPage: 0,
  installedFilter: "all",
  loading: false,
  searchLoading: false,
  installing: new Set<string>(),
  restartRequired: false,

  setInstalledMods: (mods) => set({ installedMods: mods }),

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
