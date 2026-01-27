import React from 'react'

type ServerStatus = 'online' | 'offline'

interface StatusBadgeProps {
    status: ServerStatus
}

const styles = {
    online: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    offline: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600',
}

const dotStyles = {
    online: 'bg-green-500',
    offline: 'bg-slate-400',
}

export const StatusBadge = React.memo(function StatusBadge({ status }: StatusBadgeProps) {
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${styles[status]}`}>
            <span className={`w-2 h-2 rounded-full ${dotStyles[status]}`} />
            <span className="uppercase tracking-wide">{status}</span>
        </div>
    )
})
