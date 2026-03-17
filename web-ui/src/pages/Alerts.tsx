import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Bell, Plus, Trash2, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  getAlertConfigs, saveAlertConfig, deleteAlertConfig,
  getAutoRestartRules, deleteAutoRestartRule,
  cancelAutoRestart,
  type AlertConfig, type AutoRestartRule,
} from '@/api/client'
import { useAlertStore } from '@/store/useAlertStore'

export default function Alerts() {
  const { serverName } = useParams<{ serverName: string }>()
  const { alertConfigs, setAlertConfigs, autoRestartRules, setAutoRestartRules, pendingRestart } = useAlertStore()
  const [webhookUrl, setWebhookUrl] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!serverName) return
    getAlertConfigs(serverName).then(setAlertConfigs)
    getAutoRestartRules(serverName).then(setAutoRestartRules)
  }, [serverName])

  const handleAddWebhook = async () => {
    if (!serverName || !webhookUrl.trim()) return
    setSaving(true)
    try {
      await saveAlertConfig(serverName, {
        type: 'discord_webhook',
        config: { webhook_url: webhookUrl.trim() },
      })
      setWebhookUrl('')
      const updated = await getAlertConfigs(serverName)
      setAlertConfigs(updated)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfig = async (id: number) => {
    if (!serverName) return
    await deleteAlertConfig(serverName, id)
    setAlertConfigs(alertConfigs.filter((c: AlertConfig) => c.id !== id))
  }

  const handleCancelRestart = async () => {
    if (!serverName) return
    await cancelAutoRestart(serverName)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-mrinth-text">告警设置</h1>

      {/* Pending Restart Banner */}
      {pendingRestart && pendingRestart.serverName === serverName && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-yellow-300 text-sm font-medium">
              ⚠️ 服务器将因 <code>{pendingRestart.reason}</code> 在 60 秒内自动重启
            </span>
            <Button variant="outline" size="sm" onClick={handleCancelRestart}>
              <RotateCcw className="w-4 h-4 mr-1" /> 取消重启
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Discord Webhook */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-4 h-4" /> Discord Webhook 告警
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded bg-mrinth-surface border border-mrinth-border px-3 py-2 text-sm text-mrinth-text placeholder:text-mrinth-muted focus:outline-none focus:ring-1 focus:ring-mrinth-primary"
              placeholder="https://discord.com/api/webhooks/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <Button onClick={handleAddWebhook} disabled={saving || !webhookUrl.trim()}>
              <Plus className="w-4 h-4 mr-1" /> 添加
            </Button>
          </div>
          <div className="space-y-2">
            {alertConfigs
              .filter((c: AlertConfig) => c.type === 'discord_webhook')
              .map((c: AlertConfig) => (
                <div key={c.id} className="flex items-center justify-between rounded bg-mrinth-surface/50 px-3 py-2 text-sm">
                  <span className="text-mrinth-muted truncate max-w-sm">{c.config.webhook_url}</span>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteConfig(c.id)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              ))}
            {alertConfigs.filter((c: AlertConfig) => c.type === 'discord_webhook').length === 0 && (
              <p className="text-sm text-mrinth-muted">尚未配置 Webhook</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Auto-Restart Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">自动重启规则</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {autoRestartRules.map((rule: AutoRestartRule) => (
              <div key={rule.id} className="flex items-center justify-between rounded bg-mrinth-surface/50 px-3 py-2 text-sm">
                <span className="text-mrinth-text">
                  {rule.trigger_type} {rule.threshold} — 持续 {rule.duration_seconds}s，冷却 {rule.cooldown_minutes}min
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (!serverName) return
                    await deleteAutoRestartRule(serverName, rule.id)
                    setAutoRestartRules(autoRestartRules.filter((r: AutoRestartRule) => r.id !== rule.id))
                  }}
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </Button>
              </div>
            ))}
            {autoRestartRules.length === 0 && (
              <p className="text-sm text-mrinth-muted">尚未设置自动重启规则</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
