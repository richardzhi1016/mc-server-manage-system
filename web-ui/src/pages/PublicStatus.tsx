import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { PublicServerStatus } from '@/types/api'
import { getPublicStatus } from '@/api/client'

function formatUptime(seconds: number | null): string {
  if (seconds === null) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function PublicStatus() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PublicServerStatus | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!token) return
    getPublicStatus(token)
      .then(setData)
      .catch(() => setNotFound(true))
  }, [token])

  if (notFound) {
    return (
      <div className="min-h-screen bg-mrinth-bg flex items-center justify-center">
        <p className="text-mrinth-muted text-lg">状态页不存在或已禁用。</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-mrinth-bg flex items-center justify-center">
        <p className="text-mrinth-muted">加载中…</p>
      </div>
    )
  }

  const isRunning = data.status === 'running'

  return (
    <div className="min-h-screen bg-mrinth-bg text-mrinth-text p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">{data.server_name}</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          isRunning ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
        }`}>
          {isRunning ? '● 运行中' : '○ 已停止'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-mrinth-muted text-sm mb-1">在线玩家</p>
          <p className="text-2xl font-semibold">
            {data.players_online !== null ? `${data.players_online} / ${data.players_max ?? '?'}` : '—'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-mrinth-muted text-sm mb-1">TPS</p>
          <p className="text-2xl font-semibold">{data.tps !== null ? data.tps.toFixed(1) : '—'}</p>
        </div>
        <div className="card p-4">
          <p className="text-mrinth-muted text-sm mb-1">运行时长</p>
          <p className="text-2xl font-semibold">{formatUptime(data.uptime_seconds)}</p>
        </div>
        <div className="card p-4">
          <p className="text-mrinth-muted text-sm mb-1">版本</p>
          <p className="text-2xl font-semibold">{data.version ?? '—'}</p>
        </div>
      </div>

      {data.health_score !== null && (
        <div className="card p-4">
          <p className="text-mrinth-muted text-sm mb-1">健康评分</p>
          <div className={`text-3xl font-bold ${
            data.health_score >= 80 ? 'text-emerald-400' :
            data.health_score >= 60 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {data.health_score}
            <span className="text-base font-normal text-mrinth-muted ml-1">/ 100</span>
          </div>
        </div>
      )}

      <p className="text-xs text-mrinth-muted mt-6 text-center">
        由 MC Server Manager 提供 · 数据每次访问时实时获取
      </p>
    </div>
  )
}
