import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useServerActions } from '@/hooks/useServerActions'
import { Play, Square, RotateCcw, Loader2 } from 'lucide-react'

interface QuickActionsProps {
  serverName: string
  serverStatus: string
}

export function QuickActions({ serverName, serverStatus }: QuickActionsProps) {
  const { actionState, start, stop, restart } = useServerActions(serverName)

  const isLoading = actionState.loading
  const isTransitional = serverStatus === 'starting' || serverStatus === 'stopping'

  const isRunning = serverStatus === 'running'
  const isStopped = serverStatus === 'stopped'
  const canStart = isStopped && !isLoading
  const canStop = isRunning && !isLoading
  const canRestart = isRunning && !isLoading

  const getStatusBadge = () => {
    if (isLoading) {
      const actionText = actionState.action === 'start' ? '启动中' :
                        actionState.action === 'stop' ? '停止中' : '重启中'
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs rounded-full">
          <Loader2 className="w-3 h-3 animate-spin" />
          {actionText}
        </span>
      )
    }

    if (isTransitional) {
      const statusText = serverStatus === 'starting' ? '启动中' : '停止中'
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs rounded-full">
          <Loader2 className="w-3 h-3 animate-spin" />
          {statusText}
        </span>
      )
    }

    if (isRunning) {
      return (
        <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs rounded-full">
          运行中
        </span>
      )
    }

    if (isStopped) {
      return (
        <span className="px-2 py-1 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 text-xs rounded-full">
          已停止
        </span>
      )
    }

    return (
      <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs rounded-full">
        {serverStatus}
      </span>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">服务器控制</CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={start}
            disabled={!canStart}
            className="gap-1"
          >
            <Play className="w-4 h-4" />
            启动
          </Button>

          <Button
            onClick={stop}
            disabled={!canStop}
            variant="destructive"
            className="gap-1"
          >
            <Square className="w-4 h-4" />
            停止
          </Button>

          <Button
            onClick={restart}
            disabled={!canRestart}
            variant="secondary"
            className="gap-1"
          >
            <RotateCcw className="w-4 h-4" />
            重启
          </Button>
        </div>

        {actionState.error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            操作失败: {actionState.error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
