import { create } from 'zustand'
import type { AlertConfig, AutoRestartRule } from '@/api/client'

interface PendingRestart {
  serverName: string
  reason: string
  cancelDeadline: string
}

interface AlertState {
  alertConfigs: AlertConfig[]
  autoRestartRules: AutoRestartRule[]
  pendingRestart: PendingRestart | null
  setAlertConfigs: (configs: AlertConfig[]) => void
  setAutoRestartRules: (rules: AutoRestartRule[]) => void
  setPendingRestart: (pr: PendingRestart | null) => void
}

export const useAlertStore = create<AlertState>((set) => ({
  alertConfigs: [],
  autoRestartRules: [],
  pendingRestart: null,
  setAlertConfigs: (alertConfigs) => set({ alertConfigs }),
  setAutoRestartRules: (autoRestartRules) => set({ autoRestartRules }),
  setPendingRestart: (pendingRestart) => set({ pendingRestart }),
}))
