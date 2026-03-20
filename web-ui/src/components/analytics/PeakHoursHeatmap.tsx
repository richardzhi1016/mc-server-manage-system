import type { HeatmapCell } from '@/types/api'

interface Props {
  data: HeatmapCell[]
}

const DOW_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function PeakHoursHeatmap({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-mrinth-muted text-sm text-center py-8">数据积累中，玩家活动后将显示统计</p>
  }

  const maxVal = Math.max(...data.map(c => c.avg), 1)
  const lookup = new Map(data.map(c => [`${c.dow}-${c.hour}`, c.avg]))

  return (
    <div>
      <h3 className="font-semibold text-mrinth-text mb-3">在线高峰热图</h3>
      <div className="overflow-x-auto">
        <div className="flex gap-1 mb-1 ml-8">
          {HOURS.map(h => (
            <div key={h} className="w-5 text-center text-xs text-mrinth-muted">{h}</div>
          ))}
        </div>
        {DOW_LABELS.map((label, dow) => (
          <div key={dow} className="flex items-center gap-1 mb-1">
            <div className="w-7 text-xs text-mrinth-muted text-right">周{label}</div>
            {HOURS.map(hour => {
              const val = lookup.get(`${dow}-${hour}`) ?? 0
              const opacity = maxVal > 0 ? val / maxVal : 0
              return (
                <div
                  key={hour}
                  title={`周${label} ${hour}:00 — 平均 ${val.toFixed(1)} 人`}
                  className="w-5 h-5 rounded-sm"
                  style={{ backgroundColor: `rgba(0, 204, 68, ${opacity})`, minWidth: '1.25rem' }}
                />
              )
            })}
          </div>
        ))}
        <p className="text-xs text-mrinth-muted mt-2">颜色深浅表示该时段平均在线人数（仅统计已离线会话）</p>
      </div>
    </div>
  )
}
