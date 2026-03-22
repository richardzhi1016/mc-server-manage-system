import { useState, useEffect, useCallback, useRef } from 'react'
import { Moon, Sun } from 'lucide-react'
import { io, Socket } from 'socket.io-client'
import { useTranslation } from 'react-i18next'
import { getServers, createServer, cloneServer, deleteServer } from '@/api/client'
import { API_BASE_URL } from '@/lib/api'
import { useServerStore } from '@/store/useServerStore'
import {
  LobbyServerCard,
  AddServerCard,
  CreateServerModal,
  CloneServerModal,
  DeleteServerModal,
  type ServerType,
  type LobbyServer,
} from '@/components/server-lobby'
import { useMinecraftVersions } from '@/hooks/useMinecraftVersions'
import { useToast } from '@/components/ui/Toast'

export default function ServerLobby() {
  const { t } = useTranslation('servers')
  const { setServers: setStoreServers, addServer: addStoreServer } = useServerStore()
  const [servers, setServers] = useState<LobbyServer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateModalOpen, setCreateModalOpen] = useState(false)
  const [isCloneModalOpen, setCloneModalOpen] = useState(false)
  const [cloneSourceServer, setCloneSourceServer] = useState<LobbyServer | null>(null)
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteTargetServer, setDeleteTargetServer] = useState<LobbyServer | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const { showToast } = useToast()

  // Use custom hook for Minecraft versions
  const { versions: mcVersions, releaseVersions: mcReleaseVersions, versionsMap, latestRelease } = useMinecraftVersions()

  // Connect to WebSocket lobby room for real-time server start/stop events
  useEffect(() => {
    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      // Join the lightweight lobby room — receives only server_started / server_stopped,
      // NOT the heavy console log stream. Rejoined automatically after reconnect.
      socket.emit('join_lobby')
    })

    socket.on('server_started', (data: { server_name: string }) => {
      // Update local card status
      setServers(prev =>
        prev.map(s => s.name === data.server_name ? { ...s, status: 'online' as const } : s)
      )
      // Keep Zustand store in sync for sidebar status dots
      const { updateServerStatusByName } = useServerStore.getState()
      updateServerStatusByName(data.server_name, 'running')
    })

    socket.on('server_stopped', (data: { server_name: string }) => {
      setServers(prev =>
        prev.map(s => s.name === data.server_name ? { ...s, status: 'offline' as const } : s)
      )
      const { updateServerStatusByName } = useServerStore.getState()
      updateServerStatusByName(data.server_name, 'stopped')
    })

    return () => {
      socket.emit('leave_lobby')
      socket.disconnect()
    }
  }, [])


  // Fetch servers from backend on mount
  useEffect(() => {
    async function fetchServers() {
      try {
        setIsLoading(true)
        const response = await getServers()
        setStoreServers(response.servers)
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

  const handleCreateServer = useCallback(async (data: { type: ServerType; name: string; version: string; version_url?: string; loader_version?: string; installer_version?: string }) => {
    try {
      const port = 25565
      const response = await createServer({
        name: data.name,
        type: data.type.toLowerCase(),
        version: data.version,
        version_url: data.version_url,
        loader_version: data.loader_version,
        installer_version: data.installer_version,
        port
      })
      const newServer: LobbyServer = {
        id: response.server.id,
        name: response.server.name,
        version: data.version,
        type: data.type,
        status: 'offline',
        port
      }
      setServers(prev => [...prev, newServer])
      addStoreServer({
        id: response.server.id,
        name: response.server.name,
        server_type: data.type.toLowerCase(),
        version: data.version,
        port,
        status: 'stopped',
      })
      setCreateModalOpen(false)
      showToast('success', t('lobby.createSuccess', { name: data.name }))
    } catch (error) {
      console.error('Failed to create server:', error)
      // Show specific backend error message if available
      const backendMsg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
      showToast('error', backendMsg || t('lobby.createFail'))
      throw error // Re-throw to let modal know creation failed
    }
  }, [showToast, t, addStoreServer])

  const handleOpenCloneModal = useCallback((server: LobbyServer) => {
    setCloneSourceServer(server)
    setCloneModalOpen(true)
  }, [])

  const handleCloseCloneModal = useCallback(() => {
    setCloneModalOpen(false)
    setCloneSourceServer(null)
  }, [])

  const handleCloneServer = useCallback(async (
    serverName: string,
    newName: string,
    newPort: number
  ) => {
    try {
      const response = await cloneServer(serverName, {
        new_name: newName,
        new_port: newPort,
      })

      const newServer: LobbyServer = {
        id: response.server.id,
        name: response.server.name,
        version: response.server.version || 'Unknown',
        type: (response.server.server_type
          ? response.server.server_type.charAt(0).toUpperCase() + response.server.server_type.slice(1)
          : 'Vanilla') as ServerType,
        status: 'offline',
        port: response.server.port || newPort,
      }
      setServers(prev => [...prev, newServer])
      addStoreServer({
        id: response.server.id,
        name: response.server.name,
        server_type: response.server.server_type,
        version: response.server.version,
        port: response.server.port || newPort,
        status: 'stopped',
      })
      setCloneModalOpen(false)
      setCloneSourceServer(null)

      if (response.warning) {
        showToast('warning', response.warning)
      }
      showToast('success', t('lobby.cloneSuccess', { name: newName }))
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      const serverMessage = axiosError?.response?.data?.error
      throw new Error(serverMessage || 'Clone failed. Please try again.')
    }
  }, [showToast, t, addStoreServer])

  const handleOpenDeleteModal = useCallback((server: LobbyServer) => {
    setDeleteTargetServer(server)
    setDeleteModalOpen(true)
  }, [])

  const handleCloseDeleteModal = useCallback(() => {
    setDeleteModalOpen(false)
    setDeleteTargetServer(null)
  }, [])

  const handleDeleteServer = useCallback(async (serverName: string) => {
    try {
      await deleteServer(serverName)
      setServers(prev => prev.filter(s => s.name !== serverName))
      setDeleteModalOpen(false)
      setDeleteTargetServer(null)
      showToast('success', t('lobby.deleteSuccess', { name: serverName }))
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      const serverMessage = axiosError?.response?.data?.error
      throw new Error(serverMessage || 'Failed to delete server. Please try again.')
    }
  }, [showToast, t])

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-mrinth-bg text-gray-900 dark:text-mrinth-text font-sans p-6 md:p-10 relative transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-mrinth-text tracking-tight">{t('lobby.title')}</h1>
            <p className="text-gray-500 dark:text-mrinth-muted mt-1">{t('lobby.subtitle')}</p>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-white dark:bg-mrinth-surface border border-gray-200 dark:border-mrinth-border text-gray-500 dark:text-mrinth-muted hover:text-mrinth-green dark:hover:text-mrinth-green transition-all shadow-sm cursor-pointer"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-mrinth-muted bg-white dark:bg-mrinth-surface px-3 py-1.5 rounded-lg border border-gray-200 dark:border-mrinth-border shadow-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              {t('lobby.systemNormal')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-mrinth-surface rounded-xl border border-gray-200 dark:border-mrinth-border h-52 animate-pulse">
                <div className="h-1 w-full bg-gray-200 dark:bg-mrinth-border" />
                <div className="p-5">
                  <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-mrinth-high mb-3" />
                  <div className="h-5 w-32 bg-gray-200 dark:bg-mrinth-high rounded mb-2" />
                  <div className="h-4 w-16 bg-gray-200 dark:bg-mrinth-high rounded" />
                </div>
              </div>
            ))
          ) : error ? (
            // Error state
            <div className="col-span-full text-center py-12">
              <p className="text-red-500 dark:text-red-400 mb-4">{t('lobby.loadError')}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('lobby.retry')}
              </button>
            </div>
          ) : (
            <>
              {servers.map((server) => (
                <LobbyServerCard key={server.id} server={server} onClone={handleOpenCloneModal} onDelete={handleOpenDeleteModal} />
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
        releaseVersions={mcReleaseVersions}
        versionsMap={versionsMap}
        latestRelease={latestRelease}
      />

      <CloneServerModal
        isOpen={isCloneModalOpen}
        onClose={handleCloseCloneModal}
        onClone={handleCloneServer}
        sourceServer={cloneSourceServer}
      />

      <DeleteServerModal
        key={deleteTargetServer?.id}
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onDelete={handleDeleteServer}
        server={deleteTargetServer}
      />
    </div>
  )
}