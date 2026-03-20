import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BarChart2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { PlaytimeChart } from '@/components/analytics/PlaytimeChart'
import { PeakHoursHeatmap } from '@/components/analytics/PeakHoursHeatmap'
import { PlayerRetention } from '@/components/analytics/PlayerRetention'
import { useAnalyticsStore } from '@/store/useAnalyticsStore'
import { getPlaytime, getHeatmap, getRetention } from '@/api/client'

function toIso(date: string): string {
  return new Date(date).toISOString()
}

export default function Analytics() {
  const { serverName } = useParams<{ serverName: string }>()
  const { playtime, heatmap, retention, loading, setPlaytime, setHeatmap, setRetention, setLoading, setError } = useAnalyticsStore()

  const today = new Date()
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
  const [fromDate, setFromDate] = useState(thirtyDaysAgo.toISOString().slice(0, 10))
  const [toDate, setToDate] = useState(today.toISOString().slice(0, 10))

  const load = async () => {
    if (!serverName) return
    setLoading(true)
    setError(null)
    try {
      const [pt, hm, rt] = await Promise.all([
        getPlaytime(serverName, toIso(fromDate), toIso(toDate + "T23:59:59")),
        getHeatmap(serverName, toIso(fromDate), toIso(toDate + "T23:59:59")),
        getRetention(serverName, toIso(fromDate), toIso(toDate + "T23:59:59")),
      ])
      setPlaytime(pt)
      setHeatmap(hm)
      setRetention(rt)
    } catch {
      setError("加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [serverName])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-mrinth-text">数据分析</h1>
      </div>

      <Card>
        <CardContent className="py-4 flex flex-wrap items-center gap-4">
          <label className="text-sm text-mrinth-muted">起始日期</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="bg-mrinth-high border border-mrinth-border rounded px-2 py-1 text-sm text-mrinth-text"
          />
          <label className="text-sm text-mrinth-muted">截止日期</label>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="bg-mrinth-high border border-mrinth-border rounded px-2 py-1 text-sm text-mrinth-text"
          />
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "加载中…" : "查询"}
          </button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="py-4">
            <PlaytimeChart data={playtime} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <PlayerRetention data={retention} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-4">
          <PeakHoursHeatmap data={heatmap} />
        </CardContent>
      </Card>
    </div>
  )
}
