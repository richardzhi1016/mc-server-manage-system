import { useTranslation } from 'react-i18next'
import { HardDrive } from 'lucide-react'
import { StatusCard } from './StatusCard'
import type { MetricStatus } from '@/types/metrics'

interface MemoryStatusCardProps {
  used: number
  total: number
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
}

export function MemoryStatusCard({ used, total, trend, trendValue }: MemoryStatusCardProps) {
  const { t } = useTranslation('dashboard')
  const percentage = (used / total) * 100
  const status: MetricStatus = percentage >= 90 ? 'critical' : percentage >= 70 ? 'warning' : 'healthy'

  const formatBytes = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${bytes} B`
  }

  return (
    <StatusCard
      title={t('metrics.memory')}
      value={`${formatBytes(used)} / ${formatBytes(total)}`}
      icon={<HardDrive className="w-6 h-6" />}
      trend={trend}
      trendValue={trendValue}
      status={status}
      threshold={percentage}
    />
  )
}
