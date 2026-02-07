import { useEffect } from 'react'
import { CpuStatusCard, MemoryStatusCard, PlayersStatusCard, DiskStatusCard, ResourceChart, QuickActions } from '@/components/dashboard'
import { useServerMetrics } from '@/hooks/useServerMetrics'
import { useDashboardStore } from '@/store/useServerStore'
import { useServerStore } from '@/store/useServerStore'
import { Card, CardContent } from '@/components/ui/Card'
import { RefreshCw, AlertCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useNavigate, useParams } from 'react-router-dom'

export default function Dashboard() {
  const navigate = useNavigate()
  const { serverName: selectedServerName } = useParams<{ serverName: string }>()
  const { metrics, history, isLoading, error, lastUpdated, refresh } = useServerMetrics(selectedServerName)
  const { selectedTimeRange, setSelectedTimeRange } = useDashboardStore()
  const { servers, selectedServerId, setSelectedServer } = useServerStore()

  const server = servers.find((s) => s.id === selectedServerId) || servers[0]
  const serverStatus = server?.status || 'stopped'

  useEffect(() => {
    if (servers.length > 0 && !selectedServerId) {
      setSelectedServer(servers[0].id)
    }
  }, [servers, selectedServerId, setSelectedServer])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">仪表盘</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            服务器实时状态监控
            {lastUpdated && (
              <span className="ml-2">
                · 更新于 {new Date(lastUpdated).toLocaleTimeString('zh-CN')}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/create')} className="gap-2">
            <Plus className="w-4 h-4" />
            创建服务器
          </Button>

          {servers.length > 1 && (
            <select
              value={selectedServerId || servers[0]?.id || ''}
              onChange={(e) => setSelectedServer(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <Button variant="outline" size="icon" onClick={refresh} disabled={isLoading}>
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics ? (
          <>
            <CpuStatusCard
              usage={metrics.cpu}
              trend="stable"
              trendValue="较稳定"
            />
            <MemoryStatusCard
              used={metrics.memory_used}
              total={metrics.memory_total}
              trend="stable"
              trendValue="较稳定"
            />
            <PlayersStatusCard
              online={metrics.players_online}
              max={metrics.players_max}
            />
            <DiskStatusCard
              used={metrics.disk_used}
              total={metrics.disk_total}
            />
          </>
        ) : (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ResourceChart
            data={history}
            metric="cpu"
            timeRange={selectedTimeRange}
            onTimeRangeChange={setSelectedTimeRange}
          />
        </div>

        <div>
          <QuickActions
            serverName={selectedServerName || ''}
            serverStatus={serverStatus}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ResourceChart
          data={history}
          metric="memory"
          timeRange={selectedTimeRange}
          onTimeRangeChange={setSelectedTimeRange}
        />

        <ResourceChart
          data={history}
          metric="players"
          timeRange={selectedTimeRange}
          onTimeRangeChange={setSelectedTimeRange}
        />
      </div>
    </div>
  )
}
