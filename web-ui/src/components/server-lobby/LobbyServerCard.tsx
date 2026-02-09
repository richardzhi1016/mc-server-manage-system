import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server as ServerIcon, MoreVertical, Copy, Trash2 } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { TypeBadge, type ServerType } from './TypeBadge'

export interface LobbyServer {
    id: string
    name: string
    version: string
    type: ServerType
    status: 'online' | 'offline'
    port: number
}

interface LobbyServerCardProps {
    server: LobbyServer
    onClone?: (server: LobbyServer) => void
    onDelete?: (server: LobbyServer) => void
}

export const LobbyServerCard = React.memo(function LobbyServerCard({ server, onClone, onDelete }: LobbyServerCardProps) {
    const navigate = useNavigate()
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    const handleCardClick = useCallback(() => {
        navigate(`/${encodeURIComponent(server.name)}/panel`)
    }, [navigate, server.name])

    const handleMenuToggle = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        setIsMenuOpen((prev) => !prev)
    }, [])

    const handleCloneClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        setIsMenuOpen(false)
        onClone?.(server)
    }, [onClone, server])

    const handleDeleteClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        setIsMenuOpen(false)
        onDelete?.(server)
    }, [onDelete, server])

    // Close dropdown on outside click or Escape key
    useEffect(() => {
        if (!isMenuOpen) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsMenuOpen(false)
            }
        }

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false)
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isMenuOpen])

    return (
        <div
            onClick={handleCardClick}
            className="cursor-pointer group relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col h-52">
            <div className={`h-2 w-full transition-colors duration-500 ${server.status === 'online' ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />

            <div className="p-5 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        <ServerIcon size={20} />
                    </div>

                    {/* Kebab menu */}
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={handleMenuToggle}
                            className="cursor-pointer text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <MoreVertical size={18} />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 z-10 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 py-1 min-w-[140px] animate-in fade-in zoom-in-95 duration-150">
                                <button
                                    onClick={handleCloneClick}
                                    className="cursor-pointer w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                                >
                                    <Copy size={14} />
                                    Clone
                                </button>
                                <div className="my-1 border-t border-slate-200 dark:border-slate-600" />
                                <button
                                    onClick={handleDeleteClick}
                                    className="cursor-pointer w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    <Trash2 size={14} />
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-1 truncate">{server.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-mono mb-4">:{server.port}</p>

                <div className="mt-auto flex items-center justify-between">
                    <StatusBadge status={server.status} />

                    <div className="flex items-center gap-2">
                        <TypeBadge type={server.type} />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded border border-slate-200 dark:border-slate-600">
                            {server.version}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
})
