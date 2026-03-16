import React from 'react'

export type ServerType = 'Vanilla' | 'Forge' | 'Fabric' | 'Paper'

interface TypeBadgeProps {
    type: ServerType
}

const styles: Record<ServerType, string> = {
    Vanilla: 'bg-stone-100 text-stone-600 border-stone-200 dark:bg-mrinth-high dark:text-mrinth-muted dark:border-mrinth-border',
    Forge:   'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40',
    Fabric:  'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/40',
    Paper:   'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800/40',
}

export const TypeBadge = React.memo(function TypeBadge({ type }: TypeBadgeProps) {
    return (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wide ${styles[type]}`}>
            {type}
        </span>
    )
})
