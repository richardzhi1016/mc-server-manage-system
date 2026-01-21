import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useServerStore } from '@/store/useServerStore'
import { useAuth } from '@/context/AuthContext'
import { ServerGrid } from '@/components/server-lobby/ServerGrid'
import { CreateServerCard } from '@/components/server-lobby/CreateServerCard'
import { EmptyState } from '@/components/server-lobby/EmptyState'
import { ServerCard } from '@/components/server-lobby/ServerCard'
import { Button } from '@/components/ui/Button'
import { RefreshCw, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ServerLobby() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { servers, loading, error, setServers, setLoading, setError } = useServerStore()

  const fetchServers = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/server-status')
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch servers')
      }
      const data = await response.json()
      const serversList = data.servers.map((server: { name: string; status: string; port?: number }) => ({
        id: server.name,
        name: server.name,
        status: server.status as 'running' | 'stopped' | 'starting' | 'stopping' | 'error',
        port: server.port,
        path: '',
        created_at: new Date().toISOString(),
      }))
      setServers(serversList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch servers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (servers.length === 0) {
      fetchServers()
    }
  }, [])

  const handleRefresh = () => {
    fetchServers()
  }

  const handleCreateServer = () => {
    navigate('/create')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            欢迎回来，{user?.username || '玩家'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            选择一个服务器进行管理，或创建新的服务器
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
          <Button onClick={handleCreateServer} className="gap-2">
            <Plus className="w-4 h-4" />
            创建服务器
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {loading && servers.length === 0 ? (
        <ServerGrid>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-6 animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
            </div>
          ))}
        </ServerGrid>
      ) : servers.length === 0 ? (
        <EmptyState onCreateServer={handleCreateServer} />
      ) : (
        <ServerGrid>
          <CreateServerCard onClick={handleCreateServer} />
          {servers.map((server) => (
            <ServerCard key={server.id} server={server} />
          ))}
        </ServerGrid>
      )}
    </div>
  )
}
