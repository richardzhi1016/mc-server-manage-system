import React, { useState, useEffect, useCallback } from 'react'
import { X, Copy, AlertTriangle, Loader2 } from 'lucide-react'
import { getNextAvailablePort } from '@/api/client'
import type { LobbyServer } from './LobbyServerCard'

interface CloneServerModalProps {
    isOpen: boolean
    onClose: () => void
    onClone: (serverName: string, newName: string, newPort: number) => Promise<void>
    sourceServer: LobbyServer | null
}

export const CloneServerModal = React.memo(function CloneServerModal({
    isOpen,
    onClose,
    onClone,
    sourceServer,
}: CloneServerModalProps) {
    const [newName, setNewName] = useState('')
    const [newPort, setNewPort] = useState(25566)
    const [isCloning, setIsCloning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isLoadingPort, setIsLoadingPort] = useState(false)

    // Reset state and fetch next available port when modal opens
    useEffect(() => {
        if (isOpen && sourceServer) {
            setNewName(`${sourceServer.name}-clone`)
            setError(null)
            setIsCloning(false)
            setIsLoadingPort(true)

            getNextAvailablePort()
                .then((res) => setNewPort(res.port))
                .catch(() => setNewPort(25566))
                .finally(() => setIsLoadingPort(false))
        }
    }, [isOpen, sourceServer])

    const validateName = useCallback((name: string): string | null => {
        const trimmed = name.trim()
        if (!trimmed) return 'Server name is required'
        if (/[<>:"/\\|?*\s]/.test(trimmed)) return 'Name contains invalid characters (no spaces or special chars)'
        return null
    }, [])

    const validatePort = useCallback((port: number): string | null => {
        if (isNaN(port)) return 'Port must be a number'
        if (port < 1024 || port > 65535) return 'Port must be between 1024 and 65535'
        return null
    }, [])

    const handleClone = useCallback(async () => {
        if (!sourceServer || isCloning) return

        const nameError = validateName(newName)
        if (nameError) {
            setError(nameError)
            return
        }

        const portError = validatePort(newPort)
        if (portError) {
            setError(portError)
            return
        }

        setIsCloning(true)
        setError(null)

        try {
            await onClone(sourceServer.name, newName.trim(), newPort)
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message)
            } else {
                setError('Clone failed. Please try again.')
            }
        } finally {
            setIsCloning(false)
        }
    }, [sourceServer, newName, newPort, isCloning, onClone, validateName, validatePort])

    if (!isOpen || !sourceServer) return null

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
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            <Copy size={18} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            Clone Server
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
                    {/* Source server info */}
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Source Server
                        </p>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                            {sourceServer.name}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {sourceServer.type} &middot; {sourceServer.version} &middot; :{sourceServer.port}
                        </p>
                    </div>

                    {/* Running server warning */}
                    {sourceServer.status === 'online' && (
                        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-3">
                            <AlertTriangle size={18} className="text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                                Server is running. World data in the clone may be inconsistent.
                            </p>
                        </div>
                    )}

                    {/* New server name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            New Server Name
                        </label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => {
                                setNewName(e.target.value)
                                setError(null)
                            }}
                            placeholder="my-server-clone"
                            className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors text-sm"
                            disabled={isCloning}
                        />
                    </div>

                    {/* Port */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            Port
                        </label>
                        <input
                            type="number"
                            value={isLoadingPort ? '' : newPort}
                            onChange={(e) => {
                                const parsed = parseInt(e.target.value, 10)
                                setNewPort(isNaN(parsed) ? 0 : parsed)
                                setError(null)
                            }}
                            placeholder={isLoadingPort ? 'Loading...' : '25565'}
                            min={1024}
                            max={65535}
                            className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors text-sm"
                            disabled={isCloning || isLoadingPort}
                        />
                    </div>

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
                        disabled={isCloning}
                        className="cursor-pointer px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleClone}
                        disabled={isCloning || isLoadingPort}
                        className="cursor-pointer px-5 py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isCloning ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Cloning...
                            </>
                        ) : (
                            <>
                                <Copy size={16} />
                                Clone Server
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
})
