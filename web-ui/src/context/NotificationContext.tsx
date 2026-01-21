import { createContext, useState, useCallback, useContext, type ReactNode } from "react"

type NotificationType = "success" | "error" | "warning" | "info"

interface Notification {
  type: NotificationType
  message: string
}

interface NotificationContextType {
  notify: (notification: Notification) => void
  dismiss: () => void
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function useNotification() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error("useNotification must be used within a NotificationProvider")
  }
  return context
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null)

  const notify = useCallback((n: Notification) => {
    setNotification(n)
    if (n.type === "success") {
      setTimeout(() => setNotification(null), 5000)
    }
  }, [])

  const dismiss = useCallback(() => {
    setNotification(null)
  }, [])

  return (
    <NotificationContext.Provider value={{ notify, dismiss }}>
      {children}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg max-w-sm animate-slideIn ${
            notification.type === "success"
              ? "bg-emerald-500 text-white"
              : notification.type === "error"
              ? "bg-red-500 text-white"
              : notification.type === "warning"
              ? "bg-amber-500 text-white"
              : "bg-blue-500 text-white"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <span>{notification.message}</span>
            <button onClick={dismiss} className="hover:opacity-70 transition-opacity">
              ×
            </button>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  )
}
