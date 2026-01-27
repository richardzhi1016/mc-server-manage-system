import React from 'react'
import { Plus } from 'lucide-react'

interface AddServerCardProps {
    onClick: () => void
}

export const AddServerCard = React.memo(function AddServerCard({ onClick }: AddServerCardProps) {
    return (
        <button
            onClick={onClick}
            className="group h-52 w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all duration-200"
        >
            <div className="w-14 h-14 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:border-blue-200 dark:group-hover:border-blue-700 group-hover:shadow-md flex items-center justify-center transition-all duration-200">
                <Plus size={28} />
            </div>
            <span className="font-semibold">Create New Server</span>
        </button>
    )
})
