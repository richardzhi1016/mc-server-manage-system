import React, { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Check } from 'lucide-react'

interface CustomSelectProps {
    options: string[]
    value: string
    onChange: (value: string) => void
    label: string
}

export const CustomSelect = React.memo(function CustomSelect({ options, value, onChange, label }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelect = useCallback((option: string) => {
        onChange(option)
        setIsOpen(false)
    }, [onChange])

    const toggleOpen = useCallback(() => {
        setIsOpen(prev => !prev)
    }, [])

    return (
        <div className="space-y-2 relative" ref={dropdownRef}>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>

            {/* Trigger Button */}
            <button
                type="button"
                onClick={toggleOpen}
                className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-slate-900 flex items-center justify-between outline-none transition-all text-slate-800 dark:text-slate-100 font-medium ${isOpen
                        ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900'
                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
            >
                <span>{value}</span>
                <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="
          absolute z-20 w-full mt-1
          bg-white dark:bg-slate-900
          border border-slate-200 dark:border-slate-600
          rounded-xl shadow-xl
          animate-in fade-in zoom-in-95 duration-100
          max-h-40 overflow-y-auto p-1
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-slate-200
          [&::-webkit-scrollbar-thumb]:dark:bg-slate-700
          [&::-webkit-scrollbar-thumb]:rounded-full
        ">
                    {options.map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => handleSelect(option)}
                            className={`w-full px-3 py-2 text-left text-sm font-medium transition-colors flex items-center justify-between rounded-lg mb-0.5 last:mb-0
                ${option === value
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                        >
                            {option}
                            {option === value && <Check size={14} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
})
