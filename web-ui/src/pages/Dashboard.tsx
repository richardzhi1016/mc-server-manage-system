import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CpuStatusCard, MemoryStatusCard, PlayersStatusCard, DiskStatusCard, ResourceChart, QuickActions, ScheduledBackupPanel } from '@/components/dashboard'
import { TpsChart } from '@/components/dashboard/TpsChart'
import { HealthScoreCard } from '@/components/dashboard/HealthScoreCard'
import { useServerMetrics } from '@/hooks/useServerMetrics'
import { useDashboardStore } from '@/store/useServerStore'
import { useServerStore } from '@/store/useServerStore'
import { useHealthStore } from '@/store/useHealthStore'
import { useTpsStore } from '@/store/useTpsStore'
import { Card, CardContent } from '@/components/ui/Card'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useParams } from 'react-router-dom'
import { currentLocale } from '@/i18n/locale'
import { getHealth, getTpsHistory } from '@/api/client'

export default function Dashboard() {
  const { t } = useTranslation('dashboard')
  const { t: tc } = useTranslation('common')
  const { serverName: selectedServerName } = useParams<{ serverName: string }>()
  const { metrics, history, isLoading, error, lastUpdated, refresh } = useServerMetrics(selectedServerName)
  const { selectedTimeRange, setSelectedTimeRange } = useDashboardStore()
  const { servers } = useServerStore()
  const { setHealth } = useHealthStore()
  const { setHistory } = useTpsStore()

  const server = servers.find((s) => s.name === selectedServerName)
  const serverStatus = server?.status || 'stopped'

  useEffect(() => {
    if (!selectedServerName) return
    getHealth(selectedServerName).then(setHealth).catch(() => {})
    getTpsHistory(selectedServerName, 1).then((r) => setHistory(r.history)).catch(() => {})
  }, [selectedServerName])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-mrinth-text">{t('title')}</h1>
          <p className="text-sm text-gray-500 dark:text-mrinth-muted">
            {t('subtitle')}
            {lastUpdated && (
              <span className="ml-2">
                · {t('updatedAt')} {new Date(lastUpdated).toLocaleTimeString(currentLocale())}
              </span>
            )}
          </p>
        </div>

        <Button variant="outline" size="icon" onClick={refresh} disabled={isLoading}>
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </Button>
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
              trendValue={tc('status.stable')}
            />
            <MemoryStatusCard
              used={metrics.memory_used}
              total={metrics.memory_total}
              trend="stable"
              trendValue={tc('status.stable')}
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
                  <div className="h-4 bg-gray-200 dark:bg-mrinth-high rounded w-1/3 mb-3" />
                  <div className="h-8 bg-gray-200 dark:bg-mrinth-high rounded w-2/3 mb-2" />
                  <div className="h-3 bg-gray-200 dark:bg-mrinth-high rounded w-1/2" />
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

        <div className="space-y-4">
          <QuickActions
            serverName={selectedServerName || ''}
            serverStatus={serverStatus}
          />
          <ScheduledBackupPanel serverName={selectedServerName || ''} />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <TpsChart />
        <HealthScoreCard />
      </div>
    </div>
  )
}
