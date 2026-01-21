import { useCallback } from 'react'
import { useDashboardStore } from '@/store/useServerStore'
import { useUIStore } from '@/store/useUIStore'
import { startServer, stopServer } from '@/api/client'
import type { QuickActionState } from '@/types/metrics'

export function useServerActions(serverName: string) {
  const { actionStates, setActionState, clearActionState } = useDashboardStore()
  const { addToast } = useUIStore()

  const actionState = (actionStates[serverName] || {
    serverName,
    action: 'start' as const,
    loading: false,
    error: null,
  }) satisfies QuickActionState

  const start = useCallback(async () => {
    setActionState(serverName, {
      serverName,
      action: 'start',
      loading: true,
      error: null,
    })

    try {
      await startServer({ server_name: serverName })
      addToast({ type: 'success', message: `服务器 ${serverName} 已启动` })
      clearActionState(serverName)
    } catch (error) {
      const message = error instanceof Error ? error.message : '启动失败'
      setActionState(serverName, {
        serverName,
        action: 'start',
        loading: false,
        error: message,
      })
      addToast({ type: 'error', message })
    }
  }, [serverName, setActionState, clearActionState, addToast])

  const stop = useCallback(async () => {
    setActionState(serverName, {
      serverName,
      action: 'stop',
      loading: true,
      error: null,
    })

    try {
      await stopServer({ server_name: serverName })
      addToast({ type: 'success', message: `服务器 ${serverName} 已停止` })
      clearActionState(serverName)
    } catch (error) {
      const message = error instanceof Error ? error.message : '停止失败'
      setActionState(serverName, {
        serverName,
        action: 'stop',
        loading: false,
        error: message,
      })
      addToast({ type: 'error', message })
    }
  }, [serverName, setActionState, clearActionState, addToast])

  const restart = useCallback(async () => {
    setActionState(serverName, {
      serverName,
      action: 'restart',
      loading: true,
      error: null,
    })

    try {
      await stopServer({ server_name: serverName })
      await new Promise(resolve => setTimeout(resolve, 2000))
      await startServer({ server_name: serverName })
      addToast({ type: 'success', message: `服务器 ${serverName} 已重启` })
      clearActionState(serverName)
    } catch (error) {
      const message = error instanceof Error ? error.message : '重启失败'
      setActionState(serverName, {
        serverName,
        action: 'restart',
        loading: false,
        error: message,
      })
      addToast({ type: 'error', message })
    }
  }, [serverName, setActionState, clearActionState, addToast])

  return {
    actionState,
    start,
    stop,
    restart,
  }
}
