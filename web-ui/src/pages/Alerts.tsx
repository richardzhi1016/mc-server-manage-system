import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Bell, Plus, Trash2, RotateCcw, Bot } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  getAlertConfigs, saveAlertConfig, deleteAlertConfig,
  getAutoRestartRules, deleteAutoRestartRule,
  cancelAutoRestart,
  getDiscordBotConfig, saveDiscordBotConfig, startDiscordBot, stopDiscordBot, getDiscordBotStatus,
  type AlertConfig, type AutoRestartRule,
} from '@/api/client'
import { useAlertStore } from '@/store/useAlertStore'

export default function Alerts() {
  const { serverName } = useParams<{ serverName: string }>()
  const { alertConfigs, setAlertConfigs, autoRestartRules, setAutoRestartRules, pendingRestart } = useAlertStore()
  const [webhookUrl, setWebhookUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [botToken, setBotToken] = useState('')
  const [botChannelId, setBotChannelId] = useState('')
  const [botState, setBotState] = useState<string>('stopped')
  const [savingBot, setSavingBot] = useState(false)

  useEffect(() => {
    if (!serverName) return
    getAlertConfigs(serverName).then(setAlertConfigs)
    getAutoRestartRules(serverName).then(setAutoRestartRules)
  }, [serverName])

  useEffect(() => {
    getDiscordBotConfig().then(({ config }) => {
      if (config) setBotChannelId(config.channel_id)
    })
    getDiscordBotStatus().then(({ state }) => setBotState(state))
    const interval = setInterval(() => {
      getDiscordBotStatus().then(({ state }) => setBotState(state))
    }, 5000)
    return () => clearInterval(interval)
  }, [])

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

  const handleSaveBotConfig = async () => {
    if (!botToken.trim() || !botChannelId.trim()) return
    setSavingBot(true)
    try {
      await saveDiscordBotConfig({ token: botToken.trim(), channel_id: botChannelId.trim() })
      setBotToken('')
    } finally {
      setSavingBot(false)
    }
  }

  const handleStartBot = async () => {
    const { state } = await startDiscordBot()
    setBotState(state)
  }

  const handleStopBot = async () => {
    await stopDiscordBot()
    setBotState('stopped')
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

      {/* Discord Bot */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="w-4 h-4" /> Discord Bot 双向集成
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-mrinth-muted mb-1 block">Bot Token</label>
              <input
                type="password"
                placeholder="填写新 Token（留空=不修改）"
                value={botToken}
                onChange={e => setBotToken(e.target.value)}
                className="w-full bg-mrinth-high border border-mrinth-border rounded px-3 py-2 text-sm text-mrinth-text"
              />
            </div>
            <div>
              <label className="text-xs text-mrinth-muted mb-1 block">Channel ID</label>
              <input
                type="text"
                placeholder="Discord 频道 ID"
                value={botChannelId}
                onChange={e => setBotChannelId(e.target.value)}
                className="w-full bg-mrinth-high border border-mrinth-border rounded px-3 py-2 text-sm text-mrinth-text"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleSaveBotConfig} disabled={savingBot || !botChannelId.trim()}>
              保存配置
            </Button>
            <Button
              size="sm"
              onClick={handleStartBot}
              disabled={botState === 'running' || botState === 'retrying' || !botChannelId.trim()}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              启动 Bot
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStopBot}
              disabled={botState === 'stopped'}
            >
              停止 Bot
            </Button>
            <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
              botState === 'running' ? 'bg-green-500/20 text-green-400' :
              botState === 'retrying' ? 'bg-yellow-500/20 text-yellow-400' :
              botState === 'crashed' ? 'bg-red-500/20 text-red-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {botState === 'running' ? '● 运行中' :
               botState === 'retrying' ? '⚠ 重试中' :
               botState === 'crashed' ? '✕ 已崩溃（重试耗尽）' : '○ 已停止'}
            </span>
          </div>
          {botState === 'crashed' && (
            <p className="text-sm text-red-400">Bot 已停止（重试耗尽），点击「启动 Bot」可手动重启。</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
