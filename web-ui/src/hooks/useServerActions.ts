import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDashboardStore } from '@/store/useServerStore'
import { useUIStore } from '@/store/useUIStore'
import { startServer, stopServer } from '@/api/client'
import type { QuickActionState } from '@/types/metrics'

export function useServerActions(serverName: string) {
  const { t } = useTranslation('dashboard')
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
      addToast({ type: 'success', message: t('control.startSuccess', { server: serverName }) })
      clearActionState(serverName)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('control.startFail')
      setActionState(serverName, {
        serverName,
        action: 'start',
        loading: false,
        error: message,
      })
      addToast({ type: 'error', message: t('control.startFail') })
    }
  }, [serverName, setActionState, clearActionState, addToast, t])

  const stop = useCallback(async () => {
    setActionState(serverName, {
      serverName,
      action: 'stop',
      loading: true,
      error: null,
    })

    try {
      await stopServer({ server_name: serverName })
      addToast({ type: 'success', message: t('control.stopSuccess', { server: serverName }) })
      clearActionState(serverName)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('control.stopFail')
      setActionState(serverName, {
        serverName,
        action: 'stop',
        loading: false,
        error: message,
      })
      addToast({ type: 'error', message: t('control.stopFail') })
    }
  }, [serverName, setActionState, clearActionState, addToast, t])

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
      addToast({ type: 'success', message: t('control.restartSuccess', { server: serverName }) })
      clearActionState(serverName)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('control.restartFail')
      setActionState(serverName, {
        serverName,
        action: 'restart',
        loading: false,
        error: message,
      })
      addToast({ type: 'error', message: t('control.restartFail') })
    }
  }, [serverName, setActionState, clearActionState, addToast, t])

  return {
    actionState,
    start,
    stop,
    restart,
  }
}
