import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, X, ArrowLeft, ChevronRight, Check, Box, Layers, Code, ScrollText } from 'lucide-react'
import { io, Socket } from 'socket.io-client'
import { CustomSelect } from '@/components/ui/CustomSelect'
import type { ServerType } from './TypeBadge'

type CategoryType = 'Official' | 'Plugins' | 'Mods'
type StepType = 'category' | 'type' | 'details'

interface CreateServerModalProps {
    isOpen: boolean
    onClose: () => void
    onCreateServer: (data: { type: ServerType; name: string; version: string; version_url?: string }) => void
    versions: string[]
    versionsMap: Map<string, string>  // Maps version ID to metadata URL
    latestRelease: string
}

interface CategoryData {
    id: CategoryType
    label: string
    icon: React.ReactNode
    desc: string
    color: string
}

interface ServerTypeData {
    id: ServerType
    icon: React.ReactNode
    desc: string
    color: string
}

const categories: CategoryData[] = [
    {
        id: 'Official',
        label: 'Official',
        icon: <Box size={32} />,
        desc: 'Standard vanilla experience',
        color: 'hover:bg-stone-50 dark:hover:bg-stone-900/30 hover:border-stone-300 dark:hover:border-stone-700 text-stone-700 dark:text-stone-300'
    },
    {
        id: 'Plugins',
        label: 'Plugins',
        icon: <ScrollText size={32} />,
        desc: 'Optimized for plugins (Spigot/Paper)',
        color: 'hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:border-sky-300 dark:hover:border-sky-700 text-sky-700 dark:text-sky-300'
    },
    {
        id: 'Mods',
        label: 'Mods',
        icon: <Layers size={32} />,
        desc: 'For modpacks (Forge/Fabric)',
        color: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-700 text-indigo-700 dark:text-indigo-300'
    },
]

const typesByCategory: Record<CategoryType, ServerTypeData[]> = {
    'Official': [
        { id: 'Vanilla', icon: <Box size={24} />, desc: 'The original Minecraft server software from Mojang', color: 'hover:bg-stone-50 dark:hover:bg-stone-900/30 hover:border-stone-300 dark:hover:border-stone-700 text-stone-700 dark:text-stone-300' },
    ],
    'Plugins': [
        { id: 'Paper', icon: <ScrollText size={24} />, desc: 'High performance Spigot fork, supports plugins', color: 'hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:border-sky-300 dark:hover:border-sky-700 text-sky-700 dark:text-sky-300' },
    ],
    'Mods': [
        { id: 'Forge', icon: <Layers size={24} />, desc: 'The most popular mod loader for heavy modpacks', color: 'hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:border-amber-300 dark:hover:border-amber-700 text-amber-700 dark:text-amber-300' },
        { id: 'Fabric', icon: <Code size={24} />, desc: 'Lightweight, modular, and fast mod loader', color: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-700 text-indigo-700 dark:text-indigo-300' },
    ]
}

export const CreateServerModal = React.memo(function CreateServerModal({
    isOpen,
    onClose,
    onCreateServer,
    versions,
    versionsMap,
    latestRelease
}: CreateServerModalProps) {
    const [step, setStep] = useState<StepType>('category')
    const [selectedCategory, setSelectedCategory] = useState<CategoryType | null>(null)
    const [selectedType, setSelectedType] = useState<ServerType | null>(null)

    // Step 3 Form State
    const [serverName, setServerName] = useState('')
    const [selectedVersion, setSelectedVersion] = useState(latestRelease)
    const [eulaAgreed, setEulaAgreed] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [downloadProgress, setDownloadProgress] = useState(0)
    const socketRef = useRef<Socket | null>(null)
    const pendingServerNameRef = useRef<string | null>(null)

    // Reset state when modal opens - this is intentional for modal reset pattern
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        if (isOpen) {
            setStep('category')
            setSelectedCategory(null)
            setSelectedType(null)
            setServerName('')
            setEulaAgreed(false)
            setIsCreating(false)
            setDownloadProgress(0)
            setSelectedVersion(latestRelease)
        }
    }, [isOpen, latestRelease])

    // Cleanup socket on unmount
    useEffect(() => {
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect()
                socketRef.current = null
            }
        }
    }, [])

    const handleCategorySelect = useCallback((category: CategoryType) => {
        setSelectedCategory(category)
        setStep('type')
    }, [])

    const handleTypeSelect = useCallback((type: ServerType) => {
        setSelectedType(type)
        setServerName(`My ${type} Server`)
        setStep('details')
    }, [])

    const handleBack = useCallback(() => {
        if (step === 'type') {
            setStep('category')
            setSelectedCategory(null)
        } else if (step === 'details') {
            setStep('type')
            setSelectedType(null)
        }
    }, [step])

    const handleFinalCreate = useCallback(async () => {
        if (selectedType && serverName && eulaAgreed && !isCreating) {
            setIsCreating(true)
            setDownloadProgress(0)
            pendingServerNameRef.current = serverName

            // Connect to WebSocket for progress updates
            if (!socketRef.current) {
                const socket = io('http://localhost:5000', {
                    transports: ['websocket', 'polling'],
                })
                socketRef.current = socket

                socket.on('download_progress', (data: { server_name: string; progress: number }) => {
                    if (data.server_name === pendingServerNameRef.current) {
                        setDownloadProgress(data.progress)
                    }
                })
            }

            try {
                await onCreateServer({
                    type: selectedType,
                    name: serverName,
                    version: selectedVersion,
                    version_url: versionsMap.get(selectedVersion)
                })
                // Download complete - close modal
                if (socketRef.current) {
                    socketRef.current.disconnect()
                    socketRef.current = null
                }
            } catch (error) {
                console.error('Failed to create server:', error)
                setIsCreating(false)
                setDownloadProgress(0)
            }
        }
    }, [selectedType, serverName, eulaAgreed, isCreating, selectedVersion, versionsMap, onCreateServer])

    const handleVersionChange = useCallback((version: string) => {
        setSelectedVersion(version)
    }, [])

    if (!isOpen) return null

    const getStepNumber = () => {
        if (step === 'category') return '1'
        if (step === 'type') return '2'
        return '3'
    }

    const getStepTitle = () => {
        if (step === 'category') return 'Select Category'
        if (step === 'type') return `Select ${selectedCategory} Software`
        return 'Configure Server'
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 h-[500px] max-h-[90vh] flex flex-col border border-transparent dark:border-slate-700">

                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 z-10 transition-colors">
                    <div className="flex items-center gap-3">
                        {step !== 'category' && (
                            <button onClick={handleBack} className="p-1 -ml-2 rounded-full text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 transition-colors">
                                {getStepTitle()}
                            </h2>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                                Step {getStepNumber()} of 3
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className={`p-6 flex-1 ${step === 'details' ? 'overflow-visible' : 'overflow-y-auto'}`}>

                    {/* STEP 1: Categories */}
                    {step === 'category' && (
                        <div className="grid grid-cols-1 gap-6">
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => handleCategorySelect(cat.id)}
                                    className={`flex items-center gap-4 p-5 rounded-xl border border-slate-200 dark:border-slate-700 text-left transition-all duration-200 group ${cat.color} hover:shadow-md dark:hover:shadow-none dark:hover:bg-opacity-10`}
                                >
                                    <div className="p-3 bg-white dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600 shadow-sm group-hover:scale-110 transition-transform text-slate-600 dark:text-slate-300">
                                        {cat.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-lg transition-colors">{cat.label}</div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">{cat.desc}</div>
                                    </div>
                                    <ChevronRight className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* STEP 2: Server Types */}
                    {step === 'type' && selectedCategory && (
                        <div className="grid grid-cols-1 gap-3 animate-in slide-in-from-right-4 duration-200">
                            {typesByCategory[selectedCategory].map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => handleTypeSelect(type.id)}
                                    className={`flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-left transition-all duration-200 group ${type.color} hover:shadow-md dark:hover:shadow-none dark:hover:bg-opacity-10`}
                                >
                                    <div className="p-3 bg-white dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600 shadow-sm group-hover:scale-110 transition-transform text-slate-600 dark:text-slate-300">
                                        {type.icon}
                                    </div>
                                    <div>
                                        <div className="font-bold text-lg transition-colors">{type.id}</div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">{type.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* STEP 3: Details Form */}
                    {step === 'details' && selectedType && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">

                            <div className="space-y-2">
                                <label htmlFor="serverName" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Server Name</label>
                                <input
                                    type="text"
                                    id="serverName"
                                    value={serverName}
                                    onChange={(e) => setServerName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 outline-none transition-all text-slate-800 dark:text-slate-100 font-medium placeholder-slate-400 dark:placeholder-slate-500"
                                    placeholder="e.g. My Survival World"
                                />
                            </div>

                            <CustomSelect
                                label="Minecraft Version"
                                options={versions}
                                value={selectedVersion}
                                onChange={handleVersionChange}
                            />

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <div className="relative flex items-center mt-0.5">
                                        <input
                                            type="checkbox"
                                            className="peer sr-only"
                                            checked={eulaAgreed}
                                            onChange={(e) => setEulaAgreed(e.target.checked)}
                                        />
                                        <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-500 rounded peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all"></div>
                                        <Check size={14} className="absolute left-0.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
                                    </div>
                                    <div className="text-sm text-slate-600 dark:text-slate-400 leading-snug select-none transition-colors">
                                        I agree to the <span className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">Minecraft EULA</span>.
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">You must agree to the EULA to run a server.</p>
                                    </div>
                                </label>
                            </div>

                            <button
                                onClick={handleFinalCreate}
                                disabled={!serverName || !eulaAgreed || isCreating}
                                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-blue-200 dark:shadow-none disabled:shadow-none transition-all duration-200 mt-4 relative overflow-hidden"
                            >
                                {isCreating ? (
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-sm">Downloading... {downloadProgress}%</span>
                                        <div className="w-full h-2 bg-blue-400/30 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-white rounded-full transition-all duration-300 ease-out"
                                                style={{ width: `${downloadProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2">
                                        <Plus size={20} strokeWidth={3} />
                                        Create Server
                                    </div>
                                )}
                            </button>

                        </div>
                    )}
                </div>
            </div>
        </div>
    )
})
