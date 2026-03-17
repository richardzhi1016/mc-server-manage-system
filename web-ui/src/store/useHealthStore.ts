import { create } from 'zustand'
import type { HealthData } from '@/api/client'

interface HealthState {
  health: HealthData | null
  setHealth: (h: HealthData) => void
}

export const useHealthStore = create<HealthState>((set) => ({
  health: null,
  setHealth: (health) => set({ health }),
}))
