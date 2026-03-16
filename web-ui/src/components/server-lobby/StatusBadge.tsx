import React from 'react'
import { useTranslation } from 'react-i18next'

type ServerStatus = 'online' | 'offline'

interface StatusBadgeProps {
    status: ServerStatus
}

const styles = {
    online:  'bg-mrinth-green/10 text-mrinth-green border-mrinth-green/30',
    offline: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-mrinth-high dark:text-mrinth-muted dark:border-mrinth-border',
}

const dotStyles = {
    online:  'bg-mrinth-green animate-pulse',
    offline: 'bg-gray-400 dark:bg-mrinth-muted',
}

export const StatusBadge = React.memo(function StatusBadge({ status }: StatusBadgeProps) {
    const { t } = useTranslation('servers')
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[status]}`} />
            <span className="uppercase tracking-wide text-[10px]">
                {status === 'online' ? t('card.statusOnline') : t('card.statusOffline')}
            </span>
        </div>
    )
})
