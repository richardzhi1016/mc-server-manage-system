import type { Server } from '@/types/api'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'
import { Play, Square, Settings, Server as ServerIcon, Users, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface ServerCardProps {
  server: Server
}

export function ServerCard({ server }: ServerCardProps) {
  const navigate = useNavigate()
  const [actionLoading, setActionLoading] = useState<'start' | 'stop' | null>(null)

  const isRunning = server.status === 'running'
  const isStopped = server.status === 'stopped'
  const isLoading = actionLoading !== null

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setActionLoading('start')
    try {
      const response = await fetch('/api/start-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_name: server.name }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start server')
      }
    } catch (error) {
      console.error('Failed to start server:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setActionLoading('stop')
    try {
      const response = await fetch('/api/stop-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_name: server.name }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to stop server')
      }
    } catch (error) {
      console.error('Failed to stop server:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleManage = () => {
    navigate(`/panel?server=${encodeURIComponent(server.name)}`)
  }

  const handleCardClick = () => {
    handleManage()
  }

  const getStatusColor = () => {
    switch (server.status) {
      case 'running':
        return 'bg-green-500'
      case 'stopped':
        return 'bg-gray-400'
      case 'starting':
        return 'bg-yellow-500'
      case 'stopping':
        return 'bg-orange-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  const getStatusText = () => {
    switch (server.status) {
      case 'running':
        return '运行中'
      case 'stopped':
        return '已停止'
      case 'starting':
        return '启动中'
      case 'stopping':
        return '停止中'
      case 'error':
        return '错误'
      default:
        return server.status
    }
  }

  return (
    <Card
      className="cursor-pointer transition-all duration-200 hover:shadow-lg"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              'bg-gray-100 dark:bg-gray-700'
            )}>
              <ServerIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {server.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn(
                  'w-2 h-2 rounded-full',
                  getStatusColor()
                )} />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {getStatusText()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Users className="w-4 h-4" />
            <span>0/20</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="w-4 h-4" />
            <span>v1.21.1</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleStart}
          disabled={!isStopped || isLoading}
          className="flex-1 gap-1"
        >
          <Play className="w-3.5 h-3.5" />
          启动
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleStop}
          disabled={!isRunning || isLoading}
          className="flex-1 gap-1"
        >
          <Square className="w-3.5 h-3.5" />
          停止
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            handleManage()
          }}
          className="flex-1 gap-1"
        >
          <Settings className="w-3.5 h-3.5" />
          管理
        </Button>
      </CardFooter>
    </Card>
  )
}
