import { create } from "zustand"
import type { ConsoleState, ConsoleActions } from "@/types/store"

import type { LogMessage } from "@/types/console"

const MAX_LOGS = 10000

function applyFilters(
  logs: LogMessage[],
  selectedLevels: string[]
): LogMessage[] {
  if (selectedLevels.includes("ALL") || selectedLevels.length === 0) {
    return logs
  }
  return logs.filter((log) => selectedLevels.includes(log.level))
}

function getServerLogs(logs: Record<string, LogMessage[]>, server: string | null): LogMessage[] {
  if (!server) return []
  return logs[server] || []
}

function capLogs(logs: LogMessage[]): LogMessage[] {
  if (logs.length <= MAX_LOGS) return logs
  return logs.slice(logs.length - MAX_LOGS)
}

export const useConsoleStore = create<ConsoleState & ConsoleActions>()((set) => ({
  isConnected: false,
  connectionStatus: "disconnected",
  currentServer: null,
  logs: {},
  filteredLogs: [],
  selectedLevels: ["ALL"],
  commandHistory: [],
  historyIndex: -1,
  autoScroll: true,
  serverRunning: false,

  setIsConnected: (isConnected) => set({ isConnected }),

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  setCurrentServer: (server) =>
    set((state) => {
      const serverLogs = getServerLogs(state.logs, server)
      return {
        ...state,
        currentServer: server,
        filteredLogs: applyFilters(serverLogs, state.selectedLevels),
      }
    }),

  addLog: (log) =>
    set((state) => {
      const serverKey = log.server
      const existingLogs = state.logs[serverKey] || []
      const updatedServerLogs = capLogs([...existingLogs, log])
      const newLogs = { ...state.logs, [serverKey]: updatedServerLogs }

      const filteredLogs = serverKey === state.currentServer
        ? applyFilters(updatedServerLogs, state.selectedLevels)
        : state.filteredLogs

      return {
        ...state,
        logs: newLogs,
        filteredLogs,
      }
    }),

  setLogs: (logs) =>
    set((state) => {
      if (!state.currentServer) return state
      const newLogs = { ...state.logs, [state.currentServer]: logs }
      return {
        ...state,
        logs: newLogs,
        filteredLogs: applyFilters(logs, state.selectedLevels),
      }
    }),

  setFilterLevels: (levels) =>
    set((state) => {
      const serverLogs = getServerLogs(state.logs, state.currentServer)
      return {
        ...state,
        selectedLevels: levels,
        filteredLogs: applyFilters(serverLogs, levels),
      }
    }),

  addCommandToHistory: (command) =>
    set((state) => {
      const history = [command, ...state.commandHistory].slice(0, 50)
      return { ...state, commandHistory: history, historyIndex: -1 }
    }),

  navigateHistory: (direction) =>
    set((state) => {
      if (state.commandHistory.length === 0) return state

      let newIndex = state.historyIndex
      if (direction === "up") {
        newIndex = Math.min(newIndex + 1, state.commandHistory.length - 1)
      } else {
        newIndex = Math.max(newIndex - 1, -1)
      }
      return { ...state, historyIndex: newIndex }
    }),

  toggleAutoScroll: () => set((state) => ({ ...state, autoScroll: !state.autoScroll })),

  setAutoScroll: (autoScroll) => set((state) => ({ ...state, autoScroll })),

  setServerRunning: (serverRunning) => set((state) => ({ ...state, serverRunning })),

  clearLogs: () =>
    set((state) => {
      if (!state.currentServer) return { ...state, filteredLogs: [] }
      return {
        ...state,
        logs: { ...state.logs, [state.currentServer]: [] },
        filteredLogs: [],
      }
    }),
}))
