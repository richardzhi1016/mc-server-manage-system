import { create } from 'zustand'
import type { TpsDataPoint } from '@/api/client'

interface TpsState {
  history: TpsDataPoint[]
  currentTps: number | null
  status: string
  setHistory: (history: TpsDataPoint[]) => void
  appendPoint: (point: TpsDataPoint) => void
  setStatus: (status: string) => void
}

export const useTpsStore = create<TpsState>((set) => ({
  history: [],
  currentTps: null,
  status: 'unknown',
  setHistory: (history) => set({ history, currentTps: history.at(-1)?.tps ?? null }),
  appendPoint: (point) =>
    set((state) => ({
      history: [...state.history.slice(-719), point],  // keep last 720 points (1h at 5s)
      currentTps: point.tps,
      status: point.status,
    })),
  setStatus: (status) => set({ status }),
}))
