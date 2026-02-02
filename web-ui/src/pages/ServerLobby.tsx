import { useState, useEffect, useCallback, useRef } from 'react'
import { Moon, Sun } from 'lucide-react'
import { io, Socket } from 'socket.io-client'
import { getServers, createServer } from '@/api/client'
import {
  LobbyServerCard,
  AddServerCard,
  CreateServerModal,
  type ServerType,
  type LobbyServer,
} from '@/components/server-lobby'
import { useMinecraftVersions } from '@/hooks/useMinecraftVersions'
import { useToast } from '@/components/ui/Toast'

export default function ServerLobby() {
  const [servers, setServers] = useState<LobbyServer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateModalOpen, setCreateModalOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const { showToast } = useToast()

  // Use custom hook for Minecraft versions
  const { versions: mcVersions, versionsMap, latestRelease } = useMinecraftVersions()

  // Connect to WebSocket for server events
  useEffect(() => {
    const socket = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [])

  // Fetch servers from backend on mount
  useEffect(() => {
    async function fetchServers() {
      try {
        setIsLoading(true)
        const response = await getServers()
        const lobbyServers: LobbyServer[] = response.servers.map(server => ({
          id: server.id,
          name: server.name,
          version: server.version || 'Unknown',
          type: (server.server_type ? server.server_type.charAt(0).toUpperCase() + server.server_type.slice(1) : 'Vanilla') as ServerType,
          status: server.status === 'running' ? 'online' : 'offline',
          port: server.port || 25565,
        }))
        setServers(lobbyServers)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch servers:', err)
        setError('Failed to load servers')
      } finally {
        setIsLoading(false)
      }
    }
    fetchServers()
  }, [])

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

  const handleCreateServer = useCallback(async (data: { type: ServerType; name: string; version: string; version_url?: string }) => {
    try {
      const response = await createServer({
        name: data.name,
        type: data.type.toLowerCase(),
        version: data.version,
        version_url: data.version_url,
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
      showToast('success', `Server "${data.name}" created successfully!`)
    } catch (error) {
      console.error('Failed to create server:', error)
      showToast('error', 'Failed to create server. Please try again.')
      throw error // Re-throw to let modal know creation failed
    }
  }, [showToast])

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
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 h-52 animate-pulse">
                <div className="h-2 w-full bg-slate-200 dark:bg-slate-700" />
                <div className="p-5">
                  <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 mb-3" />
                  <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                  <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              </div>
            ))
          ) : error ? (
            // Error state
            <div className="col-span-full text-center py-12">
              <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {servers.map((server) => (
                <LobbyServerCard key={server.id} server={server} />
              ))}
              <AddServerCard onClick={handleOpenCreateModal} />
            </>
          )}
        </div>
      </div>

      <CreateServerModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onCreateServer={handleCreateServer}
        versions={mcVersions}
        versionsMap={versionsMap}
        latestRelease={latestRelease}
      />
    </div>
  )
}