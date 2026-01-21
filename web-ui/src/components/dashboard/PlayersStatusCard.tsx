import { Users } from 'lucide-react'
import { StatusCard } from './StatusCard'
import type { MetricStatus } from '@/types/metrics'

interface PlayersStatusCardProps {
  online: number
  max: number
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
}

export function PlayersStatusCard({ online, max, trend, trendValue }: PlayersStatusCardProps) {
  const percentage = max > 0 ? (online / max) * 100 : 0
  const status: MetricStatus = percentage >= 90 ? 'critical' : percentage >= 70 ? 'warning' : 'healthy'

  return (
    <StatusCard
      title="在线玩家"
      value={online}
      unit={`/ ${max}`}
      icon={<Users className="w-6 h-6" />}
      trend={trend}
      trendValue={trendValue}
      status={status}
      threshold={percentage}
    />
  )
}
