import type { Server } from "./api"
import type { ServerMetrics, ChartDataPoint, TimeRange, QuickActionState } from "./metrics"
import type { Player, WhitelistEntry, BanEntry } from "./api"
import type { LogMessage, LogLevel } from "./console"

export interface ServerState {
  servers: Server[]
  loading: boolean
  error: string | null
  selectedServerId: string | null
}

export interface ServerActions {
  setServers: (servers: Server[]) => void
  addServer: (server: Server) => void
  removeServer: (serverId: string) => void
  updateServerStatus: (serverId: string, status: Server["status"], port?: number) => void
  /** Update status by server name (used by lobby socket events which send server_name not id). */
  updateServerStatusByName: (serverName: string, status: Server["status"]) => void
  setSelectedServer: (serverId: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearServers: () => void
}


export interface DashboardState {
  currentMetrics: ServerMetrics | null
  metricsHistory: ChartDataPoint[]
  metricsLoading: boolean
  metricsError: string | null
  selectedTimeRange: TimeRange
  actionStates: Record<string, QuickActionState>
  lastUpdated: string | null
}

export interface DashboardActions {
  setCurrentMetrics: (metrics: ServerMetrics | null) => void
  setMetricsHistory: (history: ChartDataPoint[]) => void
  appendMetricsPoint: (point: ChartDataPoint) => void
  setMetricsLoading: (loading: boolean) => void
  setMetricsError: (error: string | null) => void
  setSelectedTimeRange: (range: TimeRange) => void
  setActionState: (serverName: string, state: QuickActionState) => void
  clearActionState: (serverName: string) => void
  setLastUpdated: (timestamp: string | null) => void
  clearMetrics: () => void
}

export interface PlayerState {
  onlinePlayers: Player[]
  selectedServer: string | null
  whitelist: WhitelistEntry[]
  bans: BanEntry[]
  loading: boolean
  error: string | null
}

export interface PlayerActions {
  setOnlinePlayers: (players: Player[]) => void
  setSelectedServer: (serverName: string | null) => void
  setWhitelist: (entries: WhitelistEntry[]) => void
  setBans: (entries: BanEntry[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  removePlayerFromList: (username: string) => void
  clearPlayers: () => void
}

export interface UIState {
  sidebarOpen: boolean
  theme: "light" | "dark"
  toasts: Array<{
    id: string
    type: "success" | "error" | "info" | "warning"
    message: string
  }>
  modals: Record<string, boolean>
}

export interface UIActions {
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setTheme: (theme: "light" | "dark") => void
  addToast: (toast: Omit<UIState["toasts"][0], "id">) => void
  removeToast: (id: string) => void
  openModal: (modalId: string) => void
  closeModal: (modalId: string) => void
  clearToasts: () => void
}

export interface ConsoleState {
  isConnected: boolean
  connectionStatus: "connecting" | "connected" | "reconnecting" | "disconnected"
  currentServer: string | null
  logs: Record<string, LogMessage[]>
  filteredLogs: LogMessage[]
  selectedLevels: LogLevel[]
  commandHistory: string[]
  historyIndex: number
  autoScroll: boolean
  serverRunning: boolean
}

export interface ConsoleActions {
  setIsConnected: (isConnected: boolean) => void
  setConnectionStatus: (status: "connecting" | "connected" | "reconnecting" | "disconnected") => void
  setCurrentServer: (server: string | null) => void
  addLog: (log: LogMessage) => void
  setLogs: (logs: LogMessage[]) => void
  setFilterLevels: (levels: LogLevel[]) => void
  addCommandToHistory: (command: string) => void
  navigateHistory: (direction: "up" | "down") => void
  toggleAutoScroll: () => void
  setAutoScroll: (value: boolean) => void
  setServerRunning: (running: boolean) => void
  clearLogs: () => void
}
