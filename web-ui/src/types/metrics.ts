export interface ServerMetrics {
  cpu: number
  memory_used: number
  memory_total: number
  disk_used: number
  disk_total: number
  players_online: number
  players_max: number
  timestamp: string
}

export interface ChartDataPoint {
  timestamp: string
  cpu: number
  memory: number
  players: number
}

export type TimeRange = '1h' | '6h' | '24h'

export type MetricStatus = 'healthy' | 'warning' | 'critical'

export type TrendDirection = 'up' | 'down' | 'stable'

export interface StatusCardProps {
  title: string
  value: string | number
  unit?: string
  icon: React.ReactNode
  trend?: TrendDirection
  trendValue?: string
  status?: MetricStatus
  threshold?: number
}

export interface ResourceChartProps {
  data: ChartDataPoint[]
  metric: 'cpu' | 'memory' | 'players'
  timeRange: TimeRange
  onTimeRangeChange?: (range: TimeRange) => void
}

export interface QuickActionState {
  serverName: string
  action: 'start' | 'stop' | 'restart'
  loading: boolean
  error: string | null
}

export interface ServerActionResult {
  success: boolean
  message: string
  error?: string
}
