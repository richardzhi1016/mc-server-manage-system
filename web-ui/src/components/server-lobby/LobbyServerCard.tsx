import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
    const { t } = useTranslation('servers')
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

    useEffect(() => {
        if (!isMenuOpen) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsMenuOpen(false)
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
            className="cursor-pointer group relative flex flex-col h-52 rounded-xl overflow-hidden
                       bg-white dark:bg-mrinth-surface
                       border border-gray-200 dark:border-mrinth-border
                       hover:border-mrinth-green/60 dark:hover:border-mrinth-green/60
                       shadow-sm hover:shadow-md hover:shadow-mrinth-green/5
                       transition-all duration-200"
        >
            {/* Status stripe at top */}
            <div className={`h-1 w-full flex-shrink-0 transition-colors duration-500 ${
                server.status === 'online'
                    ? 'bg-gradient-to-r from-mrinth-green to-emerald-400'
                    : 'bg-gray-200 dark:bg-mrinth-border'
            }`} />

            <div className="p-5 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-3">
                    {/* Server icon */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg
                                    bg-gray-100 dark:bg-mrinth-high
                                    text-gray-500 dark:text-mrinth-muted
                                    group-hover:bg-mrinth-green/10 group-hover:text-mrinth-green
                                    transition-colors duration-200">
                        <ServerIcon size={20} />
                    </div>

                    {/* Kebab menu */}
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={handleMenuToggle}
                            className="cursor-pointer p-1.5 rounded-md
                                       text-gray-400 dark:text-mrinth-muted
                                       hover:text-gray-700 dark:hover:text-mrinth-text
                                       hover:bg-gray-100 dark:hover:bg-mrinth-high
                                       transition-colors"
                        >
                            <MoreVertical size={16} />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 z-10
                                            bg-white dark:bg-mrinth-high
                                            rounded-lg shadow-xl
                                            border border-gray-200 dark:border-mrinth-border
                                            py-1 min-w-[140px]
                                            animate-in fade-in zoom-in-95 duration-150">
                                <button
                                    onClick={handleCloneClick}
                                    className="cursor-pointer w-full flex items-center gap-2 px-3 py-2 text-sm
                                               text-gray-700 dark:text-mrinth-text
                                               hover:bg-gray-50 dark:hover:bg-mrinth-border
                                               transition-colors"
                                >
                                    <Copy size={14} />
                                    {t('card.clone')}
                                </button>
                                <div className="my-1 border-t border-gray-200 dark:border-mrinth-border" />
                                <button
                                    onClick={handleDeleteClick}
                                    className="cursor-pointer w-full flex items-center gap-2 px-3 py-2 text-sm
                                               text-red-600 dark:text-red-400
                                               hover:bg-red-50 dark:hover:bg-red-900/10
                                               transition-colors"
                                >
                                    <Trash2 size={14} />
                                    {t('card.delete')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <h3 className="font-bold text-base text-gray-900 dark:text-mrinth-text mb-1 truncate">
                    {server.name}
                </h3>
                <p className="text-xs text-gray-400 dark:text-mrinth-muted font-mono mb-4">
                    :{server.port}
                </p>

                <div className="mt-auto flex items-center justify-between">
                    <StatusBadge status={server.status} />

                    <div className="flex items-center gap-2">
                        <TypeBadge type={server.type} />
                        <span className="text-xs font-medium
                                         text-gray-500 dark:text-mrinth-muted
                                         bg-gray-100 dark:bg-mrinth-high
                                         px-2 py-0.5 rounded border border-gray-200 dark:border-mrinth-border">
                            {server.version}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
})
