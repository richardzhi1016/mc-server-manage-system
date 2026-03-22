import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useTpsStore } from '@/store/useTpsStore'
import { useAlertStore } from '@/store/useAlertStore'
import { useServerStore } from '@/store/useServerStore'
import { API_BASE_URL } from '@/lib/api'

/**
 * Maintains a persistent SocketIO connection for server-level events:
 * - tps_update    → useTpsStore
 * - pending_restart / pending_restart_cancelled → useAlertStore
 * - server_started / server_stopped → useServerStore (via lobby room)
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
      // Join this server's console room for log streaming / TPS
      socket.emit('join_console', { server_name: serverName })
      // Also join the global lobby room so the sidebar status dots stay live
      // for ALL servers, not just the one whose panel is open.
      // Note: joining inside 'connect' ensures this is re-done on reconnect.
      socket.emit('join_lobby')
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

    // Lobby room events — update the global server list status reactively
    socket.on('server_started', (data: { server_name: string }) => {
      useServerStore.getState().updateServerStatusByName(data.server_name, 'running')
    })

    socket.on('server_stopped', (data: { server_name: string }) => {
      useServerStore.getState().updateServerStatusByName(data.server_name, 'stopped')
    })

    return () => {
      socket.emit('leave_lobby')
      socket.disconnect()
      socketRef.current = null
    }
  }, [serverName])
}

