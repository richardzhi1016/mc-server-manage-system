import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { StatusCardProps } from '@/types/metrics'

function TrendIcon({ trend }: { trend?: 'up' | 'down' | 'stable' }) {
  if (!trend) return null

  const iconClass = cn(
    'w-4 h-4',
    trend === 'up' && 'text-green-500',
    trend === 'down' && 'text-red-500',
    trend === 'stable' && 'text-gray-500'
  )

  if (trend === 'up') return <TrendingUp className={iconClass} />
  if (trend === 'down') return <TrendingDown className={iconClass} />
  return <Minus className={iconClass} />
}

export function StatusCard({
  title,
  value,
  unit,
  icon,
  trend,
  trendValue,
  status = 'healthy',
  threshold,
}: StatusCardProps) {
  const statusColors = {
    healthy: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    critical: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
  }

  const iconColors = {
    healthy: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    critical: 'text-red-600 dark:text-red-400',
  }

  return (
    <Card className={cn('border-2', statusColors[status])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              {title}
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {value}
              </span>
              {unit && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {unit}
                </span>
              )}
            </div>

            {(trend || trendValue) && (
              <div className="flex items-center gap-1 mt-2">
                <TrendIcon trend={trend} />
                {trendValue && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {trendValue}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className={cn('p-2 rounded-lg bg-opacity-10', iconColors[status])}>
            {icon}
          </div>
        </div>

        {threshold !== undefined && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>使用率</span>
              <span>{threshold.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  threshold >= 90
                    ? 'bg-red-500'
                    : threshold >= 70
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                )}
                style={{ width: `${Math.min(threshold, 100)}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
