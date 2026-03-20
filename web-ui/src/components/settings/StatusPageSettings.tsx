import { useEffect, useState } from 'react'
import { Globe, Copy, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { enableStatusPage, disableStatusPage, resetStatusPageToken, getStatusPageConfig } from '@/api/client'

interface Props {
  serverName: string
}

export function StatusPageSettings({ serverName }: Props) {
  const [enabled, setEnabled] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getStatusPageConfig(serverName).then(cfg => {
      setToken(cfg.token)
      setEnabled(!!cfg.token)
    })
  }, [serverName])

  const publicUrl = token ? `${window.location.origin}/public/${token}` : null

  const handleToggle = async () => {
    setLoading(true)
    try {
      if (enabled) {
        await disableStatusPage(serverName)
        setToken(null)
        setEnabled(false)
      } else {
        const cfg = await enableStatusPage(serverName)
        setToken(cfg.token)
        setEnabled(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    setLoading(true)
    try {
      const cfg = await resetStatusPageToken(serverName)
      setToken(cfg.token)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (publicUrl) navigator.clipboard.writeText(publicUrl)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-mrinth-text">公开状态页</p>
          <p className="text-sm text-mrinth-muted">无需登录即可访问的服务器状态展示页</p>
        </div>
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-indigo-600' : 'bg-mrinth-high'
          }`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {enabled && publicUrl && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-mrinth-high rounded-lg px-3 py-2">
            <Globe className="w-4 h-4 text-mrinth-muted flex-shrink-0" />
            <span className="text-sm text-mrinth-text truncate flex-1">{publicUrl}</span>
            <button onClick={handleCopy} className="flex-shrink-0">
              <Copy className="w-4 h-4 text-mrinth-muted hover:text-mrinth-text" />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" /> 重置 Token（旧链接立即失效）
          </Button>
        </div>
      )}
    </div>
  )
}
