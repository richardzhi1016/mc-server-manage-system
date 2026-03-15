import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { currentLocale } from '@/i18n/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { ResourceChartProps, TimeRange } from '@/types/metrics'

const METRIC_STATIC: Record<string, { color: string; gradientId: string; unit?: string; dataKey: string }> = {
  cpu: { color: '#6366f1', gradientId: 'cpuGradient', unit: '%', dataKey: 'cpu' },
  memory: { color: '#10b981', gradientId: 'memoryGradient', unit: '%', dataKey: 'memory' },
  players: { color: '#f59e0b', gradientId: 'playersGradient', dataKey: 'players' },
}

function CustomTooltip({ active, payload, label, metric }: {
  active?: boolean
  payload?: ReadonlyArray<{ value: number; dataKey: string }>
  label?: string | number
  metric: 'cpu' | 'memory' | 'players'
}) {
  const { t } = useTranslation('dashboard')
  if (!active || !payload || payload.length === 0) return null

  const staticCfg = METRIC_STATIC[metric]
  const data = payload[0]
  const unit = metric === 'players' ? t('metrics.playersUnit') : staticCfg.unit

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-lg font-semibold text-gray-900 dark:text-white">
        {data.value.toFixed(1)}
        {unit}
      </p>
    </div>
  )
}

export function ResourceChart({
  data,
  metric,
  timeRange,
  onTimeRangeChange,
}: ResourceChartProps) {
  const { t } = useTranslation('dashboard')
  const [selectedMetric, setSelectedMetric] = useState<typeof metric>(metric)

  const staticCfg = METRIC_STATIC[selectedMetric]

  const metricLabels = {
    cpu: t('metrics.cpu'),
    memory: t('metrics.memoryRate'),
    players: t('metrics.players'),
  }

  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: '1h', label: t('timeRanges.hour1') },
    { value: '6h', label: t('timeRanges.hour6') },
    { value: '24h', label: t('timeRanges.hour24') },
  ]

  const formatXAxis = (value: string) => {
    const date = new Date(value)
    return date.toLocaleTimeString(currentLocale(), {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            {metricLabels[selectedMetric]}
          </CardTitle>
          <div className="flex items-center gap-1">
            {(['cpu', 'memory', 'players'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMetric(m)}
                className={cn(
                  'px-2 py-1 text-xs rounded-md transition-colors',
                  selectedMetric === m
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
              >
                {metricLabels[m]}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {onTimeRangeChange && (
          <div className="flex justify-end gap-1 mb-2">
            {timeRanges.map((range) => (
              <Button
                key={range.value}
                variant={timeRange === range.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onTimeRangeChange(range.value)}
                className="h-7 text-xs"
              >
                {range.label}
              </Button>
            ))}
          </div>
        )}

        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id={staticCfg.gradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={staticCfg.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={staticCfg.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                className="dark:stroke-gray-700"
              />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxis}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                className="dark:fill-gray-400"
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                className="dark:fill-gray-400"
                domain={[0, 'auto']}
              />
              <Tooltip
                content={(props) => <CustomTooltip {...props} metric={selectedMetric} />}
                labelFormatter={formatXAxis}
              />
              <Area
                type="monotone"
                dataKey={staticCfg.dataKey}
                stroke={staticCfg.color}
                strokeWidth={2}
                fill={`url(#${staticCfg.gradientId})`}
                dot={false}
                activeDot={{ r: 4, fill: staticCfg.color }}
                isAnimationActive={true}
                animationDuration={300}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
