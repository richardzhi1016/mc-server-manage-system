import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useTpsStore } from '@/store/useTpsStore'
import { cn } from '@/lib/utils'

export function TpsChart() {
  const { history, currentTps, status } = useTpsStore()

  const isVanilla = status === 'unknown'
  const isWarmingUp = status === 'warming_up'

  const tpsColor =
    currentTps === null ? '#6b7280'
    : currentTps < 10 ? '#ef4444'
    : currentTps < 15 ? '#f59e0b'
    : '#22c55e'

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-mrinth-muted">TPS</CardTitle>
          {isVanilla ? (
            <span className="text-xs text-mrinth-muted">仅支持卡顿事件检测</span>
          ) : isWarmingUp ? (
            <span className="text-xs text-yellow-400">服务器启动中…</span>
          ) : (
            <span className={cn('text-2xl font-bold')} style={{ color: tpsColor }}>
              {currentTps?.toFixed(1) ?? '—'}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isVanilla ? (
          <div className="flex h-24 items-center justify-center text-sm text-mrinth-muted">
            Vanilla 服务器不支持 TPS 数值采集
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={96}>
            <LineChart data={history} margin={{ top: 0, right: 0, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" />
              <XAxis dataKey="timestamp" hide />
              <YAxis domain={[0, 20]} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(val: number | string | undefined) => [val != null ? `${Number(val).toFixed(1)} TPS` : '—']}
                labelFormatter={() => ''}
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333' }}
              />
              <ReferenceLine y={15} stroke="#f59e0b" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="tps"
                stroke={tpsColor}
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
