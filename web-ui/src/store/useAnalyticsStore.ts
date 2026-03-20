import { create } from 'zustand'
import type { PlaytimeEntry, HeatmapCell, RetentionData } from '@/types/api'

interface AnalyticsState {
  playtime: PlaytimeEntry[]
  heatmap: HeatmapCell[]
  retention: RetentionData | null
  loading: boolean
  error: string | null
  setPlaytime: (data: PlaytimeEntry[]) => void
  setHeatmap: (data: HeatmapCell[]) => void
  setRetention: (data: RetentionData) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  playtime: [],
  heatmap: [],
  retention: null,
  loading: false,
  error: null,
  setPlaytime: (playtime) => set({ playtime }),
  setHeatmap: (heatmap) => set({ heatmap }),
  setRetention: (retention) => set({ retention }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
