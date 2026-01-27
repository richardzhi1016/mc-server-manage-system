import React from 'react'
import { Server as ServerIcon, MoreVertical } from 'lucide-react'
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
}

export const LobbyServerCard = React.memo(function LobbyServerCard({ server }: LobbyServerCardProps) {
    return (
        <div className="group relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col h-52">
            <div className={`h-2 w-full transition-colors duration-500 ${server.status === 'online' ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />

            <div className="p-5 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        <ServerIcon size={20} />
                    </div>
                    <button className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <MoreVertical size={18} />
                    </button>
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
