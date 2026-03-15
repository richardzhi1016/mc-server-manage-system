import { useTranslation } from 'react-i18next'
import { Cpu } from 'lucide-react'
import { StatusCard } from './StatusCard'
import type { MetricStatus } from '@/types/metrics'

interface CpuStatusCardProps {
  usage: number
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
}

export function CpuStatusCard({ usage, trend, trendValue }: CpuStatusCardProps) {
  const { t } = useTranslation('dashboard')
  const status: MetricStatus = usage >= 90 ? 'critical' : usage >= 70 ? 'warning' : 'healthy'

  return (
    <StatusCard
      title={t('metrics.cpu')}
      value={usage.toFixed(1)}
      unit="%"
      icon={<Cpu className="w-6 h-6" />}
      trend={trend}
      trendValue={trendValue}
      status={status}
      threshold={usage}
    />
  )
}
