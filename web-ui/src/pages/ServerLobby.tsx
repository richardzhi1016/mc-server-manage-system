import { useState, useEffect, useCallback } from 'react'
import { Moon, Sun } from 'lucide-react'
import { createServer } from '@/api/client'
import {
  LobbyServerCard,
  AddServerCard,
  CreateServerModal,
  type ServerType,
  type LobbyServer,
} from '@/components/server-lobby'
import { useMinecraftVersions } from '@/hooks/useMinecraftVersions'

// --- Mock Data ---
const initialServers: LobbyServer[] = [
  { id: '1', name: 'Survival World', version: '1.20.4', type: 'Vanilla', status: 'online', port: 25565 },
  { id: '2', name: 'Tech Modpack', version: '1.19.2', type: 'Forge', status: 'offline', port: 25566 },
  { id: '3', name: 'Friends SMP', version: '1.20.1', type: 'Fabric', status: 'online', port: 25567 },
  { id: '4', name: 'Creative Plot', version: '1.20.4', type: 'Paper', status: 'offline', port: 25568 },
]

export default function ServerLobby() {
  const [servers, setServers] = useState<LobbyServer[]>(initialServers)
  const [isCreateModalOpen, setCreateModalOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Use custom hook for Minecraft versions
  const { versions: mcVersions, latestRelease } = useMinecraftVersions()

  // Detect system dark mode preference on initial load
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true)
    }
  }, [])

  // Apply dark mode class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  const handleOpenCreateModal = useCallback(() => {
    setCreateModalOpen(true)
  }, [])

  const handleCloseCreateModal = useCallback(() => {
    setCreateModalOpen(false)
  }, [])

  const handleCreateServer = useCallback(async (data: { type: ServerType; name: string; version: string }) => {
    try {
      const response = await createServer({
        name: data.name,
        type: data.type.toLowerCase(),
        version: data.version,
        port: 25565
      })
      const newServer: LobbyServer = {
        id: response.server.id,
        name: response.server.name,
        version: data.version,
        type: data.type,
        status: 'offline',
        port: 25565
      }
      setServers(prev => [...prev, newServer])
      setCreateModalOpen(false)
    } catch (error) {
      console.error('Failed to create server:', error)
      alert('Failed to create server. Please try again.')
    }
  }, [])

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev)
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans p-6 md:p-10 relative transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors">Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 transition-colors">Manage your Minecraft server instances</p>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              System Normal
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {servers.map((server) => (
            <LobbyServerCard key={server.id} server={server} />
          ))}
          <AddServerCard onClick={handleOpenCreateModal} />
        </div>
      </div>

      <CreateServerModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onCreateServer={handleCreateServer}
        versions={mcVersions}
        latestRelease={latestRelease}
      />
    </div>
  )
}