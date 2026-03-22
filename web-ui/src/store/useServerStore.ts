import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ServerState, ServerActions, DashboardState, DashboardActions } from "@/types/store"

const MAX_HISTORY_POINTS = 100

export const useServerStore = create<ServerState & ServerActions>()(
  persist(
    (set) => ({
      servers: [],
      loading: false,
      error: null,
      selectedServerId: null,

      setServers: (servers) => set({ servers }),

      addServer: (server) =>
        set((state) => ({
          servers: [...state.servers, server],
        })),

      removeServer: (serverId) =>
        set((state) => ({
          servers: state.servers.filter((s) => s.id !== serverId),
        })),

      updateServerStatus: (serverId, status, port) =>
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === serverId ? { ...s, status, port: port ?? s.port } : s
          ),
        })),

      updateServerStatusByName: (serverName, status) =>
        set((state) => ({
          servers: state.servers.map((s) =>
            s.name === serverName ? { ...s, status } : s
          ),
        })),


      setSelectedServer: (serverId) => set({ selectedServerId: serverId }),

      setLoading: (loading) => set({ loading }),

      setError: (error) => set({ error }),

      clearServers: () => set({ servers: [] }),
    }),
    {
      name: "server-storage",
      partialize: (state) => ({ servers: state.servers }),
    }
  )
)

export const useDashboardStore = create<DashboardState & DashboardActions>()((set) => ({
  currentMetrics: null,
  metricsHistory: [],
  metricsLoading: false,
  metricsError: null,
  selectedTimeRange: '1h',
  actionStates: {},
  lastUpdated: null,

  setCurrentMetrics: (metrics) => set({ currentMetrics: metrics, lastUpdated: new Date().toISOString() }),

  setMetricsHistory: (history) => set({ metricsHistory: history.slice(-MAX_HISTORY_POINTS) }),

  appendMetricsPoint: (point) =>
    set((state) => ({
      metricsHistory: [...state.metricsHistory.slice(-MAX_HISTORY_POINTS + 1), point],
    })),

  setMetricsLoading: (loading) => set({ metricsLoading: loading }),

  setMetricsError: (error) => set({ metricsError: error }),

  setSelectedTimeRange: (range) => set({ selectedTimeRange: range }),

  setActionState: (serverName, state) =>
    set((prev) => ({
      actionStates: { ...prev.actionStates, [serverName]: state },
    })),

  clearActionState: (serverName) =>
    set((prev) => {
      const { [serverName]: _, ...rest } = prev.actionStates // eslint-disable-line @typescript-eslint/no-unused-vars
      return { actionStates: rest }
    }),

  setLastUpdated: (timestamp) => set({ lastUpdated: timestamp }),

  clearMetrics: () =>
    set({
      currentMetrics: null,
      metricsHistory: [],
      metricsError: null,
      lastUpdated: null,
    }),
}))
