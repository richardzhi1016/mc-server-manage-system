import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { PlaytimeEntry } from '@/types/api'

interface Props {
  data: PlaytimeEntry[]
}

function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function PlaytimeChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-mrinth-muted text-sm text-center py-8">数据积累中，玩家活动后将显示统计</p>
  }
  const chartData = data.map(d => ({ ...d, label: formatSeconds(d.total_seconds) }))
  return (
    <div>
      <h3 className="font-semibold text-mrinth-text mb-3">游玩时长 Top 10</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
          <XAxis type="number" tickFormatter={formatSeconds} tick={{ fill: 'var(--color-mrinth-muted)', fontSize: 12 }} />
          <YAxis dataKey="username" type="category" tick={{ fill: 'var(--color-mrinth-text)', fontSize: 12 }} width={70} />
          <Tooltip formatter={(val: number | undefined) => (val !== undefined ? formatSeconds(val) : '—')} />
          <Bar dataKey="total_seconds" fill="var(--color-mrinth-green)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
