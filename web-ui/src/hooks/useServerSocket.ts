import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useTpsStore } from '@/store/useTpsStore'
import { useAlertStore } from '@/store/useAlertStore'
import { API_BASE_URL } from '@/lib/api'

/**
 * Maintains a persistent SocketIO connection for server-level events:
 * - tps_update    → useTpsStore
 * - pending_restart / pending_restart_cancelled → useAlertStore
 *
 * Mount this hook in Layout so it stays alive across all pages.
 */
export function useServerSocket(serverName: string | null) {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!serverName) return

    if (socketRef.current) {
      socketRef.current.disconnect()
    }

    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join_console', { server_name: serverName })
    })

    socket.on('tps_update', (data) => {
      if (data.server_name === serverName) {
        useTpsStore.getState().appendPoint(data)
      }
    })

    socket.on('pending_restart', (data) => {
      useAlertStore.getState().setPendingRestart({
        serverName: data.server_name,
        reason: data.reason,
        cancelDeadline: data.cancel_deadline,
      })
    })

    socket.on('pending_restart_cancelled', (data) => {
      const current = useAlertStore.getState().pendingRestart
      if (current?.serverName === data.server_name) {
        useAlertStore.getState().setPendingRestart(null)
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [serverName])
}
