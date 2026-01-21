import { create } from "zustand"
import type { ConsoleState, ConsoleActions } from "@/types/store"

const MAX_LOGS = 10000

function applyFilters(
  logs: Array<{ level: string }>,
  selectedLevels: string[]
): Array<{ level: string }> {
  if (selectedLevels.includes("ALL") || selectedLevels.length === 0) {
    return logs
  }
  return logs.filter((log) => selectedLevels.includes(log.level))
}

export const useConsoleStore = create<ConsoleState & ConsoleActions>()((set) => ({
  isConnected: false,
  connectionStatus: "disconnected",
  logs: [],
  filteredLogs: [],
  selectedLevels: ["ALL"],
  commandHistory: [],
  historyIndex: -1,
  autoScroll: true,

  setIsConnected: (isConnected) => set({ isConnected }),

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  addLog: (log) =>
    set((state) => {
      const newLogs = [...state.logs, log]
      if (newLogs.length > MAX_LOGS) {
        newLogs.splice(0, newLogs.length - MAX_LOGS)
      }
      const filteredLogs = applyFilters(newLogs, state.selectedLevels)
      return {
        ...state,
        logs: newLogs,
        filteredLogs,
      }
    }),

  setLogs: (logs) => set((state) => ({ ...state, logs, filteredLogs: applyFilters(logs, state.selectedLevels) })),

  setFilterLevels: (levels) =>
    set((state) => ({
      ...state,
      selectedLevels: levels,
      filteredLogs: applyFilters(state.logs, levels),
    })),

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

  clearLogs: () => set((state) => ({ ...state, logs: [], filteredLogs: [] })),
}))
