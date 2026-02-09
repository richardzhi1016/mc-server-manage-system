import { useEffect, useRef, useCallback, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import type { LogMessage } from "../types/console";

import { useConsoleStore } from "../store/useConsoleStore";
import { API_BASE_URL } from "@/lib/api";

export function useConsoleSocket(serverName: string | null) {
  const socketRef = useRef<Socket | null>(null);

  // Individual selectors to avoid full-store re-render on every log message
  const isConnected = useConsoleStore((s) => s.isConnected);
  const connectionStatus = useConsoleStore((s) => s.connectionStatus);
  const filteredLogs = useConsoleStore((s) => s.filteredLogs);
  const selectedLevels = useConsoleStore((s) => s.selectedLevels);
  const commandHistory = useConsoleStore((s) => s.commandHistory);
  const historyIndex = useConsoleStore((s) => s.historyIndex);
  const autoScroll = useConsoleStore((s) => s.autoScroll);
  const serverRunning = useConsoleStore((s) => s.serverRunning);

  const connect = useCallback((name: string) => {
    if (socketRef.current?.connected) {
      return;
    }

    const store = useConsoleStore.getState();
    store.setConnectionStatus("connecting");

    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      const s = useConsoleStore.getState();
      s.setIsConnected(true);
      s.setConnectionStatus("connected");
      socket.emit("join_console", { server_name: name });
    });

    socket.on("disconnect", () => {
      const s = useConsoleStore.getState();
      s.setIsConnected(false);
      s.setConnectionStatus("disconnected");
    });

    socket.on("connect_error", () => {
      useConsoleStore.getState().setConnectionStatus("disconnected");
    });

    socket.on("reconnecting", () => {
      useConsoleStore.getState().setConnectionStatus("reconnecting");
    });

    socket.on("log_message", (log: LogMessage) => {
      useConsoleStore.getState().addLog(log);
    });

    socket.on("console_joined", (data: { server_name: string; is_running?: boolean }) => {
      if (typeof data.is_running === "boolean") {
        useConsoleStore.getState().setServerRunning(data.is_running);
      }
    });

    socket.on("server_started", () => {
      useConsoleStore.getState().setServerRunning(true);
    });

    socket.on("server_stopped", () => {
      useConsoleStore.getState().setServerRunning(false);
    });
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current && serverName) {
      socketRef.current.emit("leave_console", { server_name: serverName });
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
    const s = useConsoleStore.getState();
    s.setIsConnected(false);
    s.setConnectionStatus("disconnected");
  }, [serverName]);

  const sendCommand = useCallback((command: string) => {
    if (!socketRef.current || !serverName || !command.trim()) {
      return;
    }
    socketRef.current.emit("send_command", {
      server_name: serverName,
      command: command.trim(),
    });
    useConsoleStore.getState().addCommandToHistory(command);
  }, [serverName]);

  useEffect(() => {
    let mounted = true;
    if (serverName && mounted) {
      useConsoleStore.getState().setCurrentServer(serverName);
      requestAnimationFrame(() => {
        if (mounted) {
          connect(serverName);
        }
      });
    }
    return () => {
      mounted = false;
      if (serverName) {
        disconnect();
      }
    };
  }, [serverName, connect, disconnect]);

  const state = useMemo(() => ({
    isConnected,
    connectionStatus,
    filteredLogs,
    selectedLevels,
    commandHistory,
    historyIndex,
    autoScroll,
    serverRunning,
  }), [isConnected, connectionStatus, filteredLogs, selectedLevels, commandHistory, historyIndex, autoScroll, serverRunning]);

  const actions = useMemo(() => ({
    connect,
    disconnect,
    sendCommand,
    setFilterLevels: useConsoleStore.getState().setFilterLevels,
    addCommandToHistory: useConsoleStore.getState().addCommandToHistory,
    navigateHistory: useConsoleStore.getState().navigateHistory,
    toggleAutoScroll: useConsoleStore.getState().toggleAutoScroll,
    setAutoScroll: useConsoleStore.getState().setAutoScroll,
    clearLogs: useConsoleStore.getState().clearLogs,
    addLog: useConsoleStore.getState().addLog,
  }), [connect, disconnect, sendCommand]);

  return { state, actions };
}
