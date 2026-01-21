import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { UIState, UIActions } from "@/types/store"
import { v4 as uuidv4 } from "uuid"

export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: "light",
      toasts: [],
      modals: {},

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setTheme: (theme) => set({ theme }),

      addToast: (toast) =>
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id: uuidv4() }],
        })),

      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      openModal: (modalId) =>
        set((state) => ({
          modals: { ...state.modals, [modalId]: true },
        })),

      closeModal: (modalId) =>
        set((state) => ({
          modals: { ...state.modals, [modalId]: false },
        })),

      clearToasts: () => set({ toasts: [] }),
    }),
    {
      name: "ui-storage",
      partialize: (state) => ({ theme: state.theme, sidebarOpen: state.sidebarOpen }),
    }
  )
)
