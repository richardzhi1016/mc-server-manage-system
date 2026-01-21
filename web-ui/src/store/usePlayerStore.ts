import { create } from "zustand"
import type { PlayerState, PlayerActions } from "@/types/store"

export const usePlayerStore = create<PlayerState & PlayerActions>()((set) => ({
  onlinePlayers: [],
  selectedServer: null,
  whitelist: [],
  bans: [],
  loading: false,
  error: null,

  setOnlinePlayers: (players) => set({ onlinePlayers: players }),

  setSelectedServer: (serverName) => set({ selectedServer: serverName }),

  setWhitelist: (entries) => set({ whitelist: entries }),

  setBans: (entries) => set({ bans: entries }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  removePlayerFromList: (username) =>
    set((state) => ({
      onlinePlayers: state.onlinePlayers.filter((p) => p.username !== username),
    })),

  clearPlayers: () => set({ onlinePlayers: [], whitelist: [], bans: [] }),
}))
