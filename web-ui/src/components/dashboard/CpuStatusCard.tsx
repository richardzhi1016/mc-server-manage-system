import { Cpu } from 'lucide-react'
import { StatusCard } from './StatusCard'
import type { MetricStatus } from '@/types/metrics'

interface CpuStatusCardProps {
  usage: number
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
}

export function CpuStatusCard({ usage, trend, trendValue }: CpuStatusCardProps) {
  const status: MetricStatus = usage >= 90 ? 'critical' : usage >= 70 ? 'warning' : 'healthy'

  return (
    <StatusCard
      title="CPU 使用率"
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
