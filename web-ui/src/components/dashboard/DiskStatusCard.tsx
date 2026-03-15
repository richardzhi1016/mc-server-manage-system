import { useTranslation } from 'react-i18next'
import { Database } from 'lucide-react'
import { StatusCard } from './StatusCard'
import type { MetricStatus } from '@/types/metrics'

interface DiskStatusCardProps {
  used: number
  total: number
  trend?: 'up' | 'down' | 'stable'
}

export function DiskStatusCard({ used, total, trend }: DiskStatusCardProps) {
  const { t } = useTranslation('dashboard')
  const percentage = (used / total) * 100
  const status: MetricStatus = percentage >= 90 ? 'critical' : percentage >= 70 ? 'warning' : 'healthy'

  const formatBytes = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${bytes} B`
  }

  const freeBytes = total - used
  const freePercentage = 100 - percentage

  return (
    <StatusCard
      title={t('metrics.disk')}
      value={`${formatBytes(used)} / ${formatBytes(total)}`}
      icon={<Database className="w-6 h-6" />}
      trend={trend}
      trendValue={freePercentage > 20 ? t('metrics.available', { bytes: formatBytes(freeBytes) }) : t('metrics.low', { bytes: formatBytes(freeBytes) })}
      status={status}
      threshold={percentage}
    />
  )
}
