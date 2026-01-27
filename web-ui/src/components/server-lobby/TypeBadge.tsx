import React from 'react'

export type ServerType = 'Vanilla' | 'Forge' | 'Fabric' | 'Paper'

interface TypeBadgeProps {
    type: ServerType
}

const styles: Record<ServerType, string> = {
    Vanilla: 'bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-900/40 dark:text-stone-400 dark:border-stone-700',
    Forge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-500 dark:border-amber-800',
    Fabric: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
    Paper: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800',
}

export const TypeBadge = React.memo(function TypeBadge({ type }: TypeBadgeProps) {
    return (
        <span className={`text-xs font-medium px-2 py-1 rounded border transition-colors ${styles[type]}`}>
            {type}
        </span>
    )
})
