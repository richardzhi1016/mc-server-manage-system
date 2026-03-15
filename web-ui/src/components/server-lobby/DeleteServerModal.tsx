import React, { useState, useCallback } from 'react'
import { X, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LobbyServer } from './LobbyServerCard'

interface DeleteServerModalProps {
    isOpen: boolean
    onClose: () => void
    onDelete: (serverName: string) => Promise<void>
    server: LobbyServer | null
}

export const DeleteServerModal = React.memo(function DeleteServerModal({
    isOpen,
    onClose,
    onDelete,
    server,
}: DeleteServerModalProps) {
    const { t } = useTranslation('servers')
    const [isDeleting, setIsDeleting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleDelete = useCallback(async () => {
        if (!server || isDeleting) return

        setIsDeleting(true)
        setError(null)

        try {
            await onDelete(server.name)
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message)
            } else {
                setError(t('deleteModal.deleteFailed'))
            }
            setIsDeleting(false)
        }
    }, [server, isDeleting, onDelete, t])

    if (!isOpen || !server) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col border border-transparent dark:border-slate-700">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                            <Trash2 size={18} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            {t('deleteModal.title')}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="cursor-pointer text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5">
                    {/* Server info */}
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            {t('deleteModal.server')}
                        </p>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                            {server.name}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {server.type} &middot; {server.version} &middot; :{server.port}
                        </p>
                    </div>

                    {/* Warning */}
                    <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-xl p-3">
                        <AlertTriangle size={18} className="text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-red-700 dark:text-red-300">
                            {t('deleteModal.permanentWarning')}
                        </p>
                    </div>

                    {/* Running server warning */}
                    {server.status === 'online' && (
                        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-3">
                            <AlertTriangle size={18} className="text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                                {t('deleteModal.runningWarning')}
                            </p>
                        </div>
                    )}

                    {/* Error message */}
                    {error && (
                        <p className="text-sm text-red-500 dark:text-red-400">
                            {error}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="cursor-pointer px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        {t('deleteModal.cancel')}
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting || server.status === 'online'}
                        className="cursor-pointer px-5 py-2.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                {t('deleteModal.deleting')}
                            </>
                        ) : (
                            <>
                                <Trash2 size={16} />
                                {t('deleteModal.delete')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
})
