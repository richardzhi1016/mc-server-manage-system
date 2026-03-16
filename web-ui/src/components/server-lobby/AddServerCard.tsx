import React from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface AddServerCardProps {
    onClick: () => void
}

export const AddServerCard = React.memo(function AddServerCard({ onClick }: AddServerCardProps) {
    const { t } = useTranslation('servers')
    return (
        <button
            onClick={onClick}
            className="group h-52 w-full cursor-pointer
                       border-2 border-dashed
                       border-gray-300 dark:border-mrinth-border
                       rounded-xl flex flex-col items-center justify-center gap-3
                       text-gray-400 dark:text-mrinth-muted
                       hover:text-mrinth-green hover:border-mrinth-green/60
                       dark:hover:text-mrinth-green dark:hover:border-mrinth-green/60
                       hover:bg-mrinth-green/5 dark:hover:bg-mrinth-green/5
                       transition-all duration-200"
        >
            <div className="w-12 h-12 rounded-full
                            bg-gray-50 dark:bg-mrinth-high
                            border border-gray-200 dark:border-mrinth-border
                            group-hover:bg-mrinth-green/10 group-hover:border-mrinth-green/40
                            flex items-center justify-center
                            transition-all duration-200 shadow-sm">
                <Plus size={24} />
            </div>
            <span className="text-sm font-semibold">{t('addCard.createNew')}</span>
        </button>
    )
})
