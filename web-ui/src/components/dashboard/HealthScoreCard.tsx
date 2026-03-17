import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useHealthStore } from '@/store/useHealthStore'
import { cn } from '@/lib/utils'
import { Heart } from 'lucide-react'

const gradeConfig = {
  green:  { label: '良好', color: 'text-emerald-400', bg: 'bg-emerald-400/10', ring: 'ring-emerald-500/40' },
  yellow: { label: '警告', color: 'text-yellow-400',  bg: 'bg-yellow-400/10',  ring: 'ring-yellow-500/40'  },
  red:    { label: '危险', color: 'text-red-400',     bg: 'bg-red-400/10',     ring: 'ring-red-500/40'     },
}

export function HealthScoreCard() {
  const { health } = useHealthStore()

  if (!health) return null

  const cfg = gradeConfig[health.grade as keyof typeof gradeConfig] ?? gradeConfig.yellow

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-mrinth-muted flex items-center gap-1">
          <Heart className="w-3.5 h-3.5" />
          服务器健康
          <span className="ml-1 text-xs text-mrinth-muted/60">（宿主机资源）</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'flex h-16 w-16 items-center justify-center rounded-full ring-2',
              cfg.bg, cfg.ring
            )}
          >
            <span className={cn('text-2xl font-bold', cfg.color)}>{health.score}</span>
          </div>
          <div className="space-y-1 text-xs text-mrinth-muted">
            <div className={cn('font-semibold text-sm', cfg.color)}>{cfg.label}</div>
            <div>CPU {health.cpu.toFixed(0)}%</div>
            <div>内存 {health.memory_pct.toFixed(0)}%</div>
            {health.tps !== null && <div>TPS {health.tps.toFixed(1)}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
