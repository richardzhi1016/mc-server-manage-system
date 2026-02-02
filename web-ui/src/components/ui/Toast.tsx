import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

// Toast types
export interface Toast {
    id: string
    type: 'success' | 'error' | 'info' | 'warning'
    message: string
    duration?: number
}

interface ToastContextType {
    toasts: Toast[]
    showToast: (type: Toast['type'], message: string, duration?: number) => void
    removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}

// Individual Toast component
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onRemove()
        }, toast.duration || 5000)
        return () => clearTimeout(timer)
    }, [toast.duration, onRemove])

    const icons = {
        success: <CheckCircle className="text-green-500" size={20} />,
        error: <AlertCircle className="text-red-500" size={20} />,
        info: <Info className="text-blue-500" size={20} />,
        warning: <AlertTriangle className="text-yellow-500" size={20} />,
    }

    const bgColors = {
        success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
        error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
        info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
        warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    }

    return (
        <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm animate-in slide-in-from-right-5 duration-300 ${bgColors[toast.type]}`}
        >
            {icons[toast.type]}
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1">
                {toast.message}
            </p>
            <button
                onClick={onRemove}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
                <X size={16} />
            </button>
        </div>
    )
}

// Toast container renders in top-right
function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
    if (toasts.length === 0) return null

    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
            ))}
        </div>
    )
}

// Provider component
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const showToast = useCallback((type: Toast['type'], message: string, duration = 5000) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        setToasts((prev) => [...prev, { id, type, message, duration }])
    }, [])

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    )
}
