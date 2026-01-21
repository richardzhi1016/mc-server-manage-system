import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { LogMessage } from "../types/console";
import type { ConsoleState, ConsoleActions } from "../types/store";
import { useConsoleStore } from "../store/useConsoleStore";

const SOCKET_URL = "http://localhost:5000";

export function useConsoleSocket(serverName: string | null): {
  state: ConsoleState;
  actions: ConsoleActions;
} {
  const socketRef = useRef<Socket | null>(null);
  const state = useConsoleStore();
  const { setIsConnected, setConnectionStatus, addLog, addCommandToHistory } = useConsoleStore();

  const connect = useCallback((name: string) => {
    if (socketRef.current?.connected) {
      return;
    }

    setConnectionStatus("connecting");

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setConnectionStatus("connected");
      socket.emit("join_console", { server_name: name });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      setConnectionStatus("disconnected");
    });

    socket.on("connect_error", () => {
      setConnectionStatus("disconnected");
    });

    socket.on("reconnecting", () => {
      setConnectionStatus("reconnecting");
    });

    socket.on("log_message", (log: LogMessage) => {
      addLog(log);
    });

    socket.on("console_joined", (data: { server_name: string }) => {
      console.log("Joined console:", data);
    });

    socket.on("server_started", (data: { server_name: string; pid: number }) => {
      console.log("Server started:", data);
    });

    socket.on("server_stopped", (data: { server_name: string }) => {
      console.log("Server stopped:", data);
      setIsConnected(false);
      setConnectionStatus("disconnected");
    });

    socket.on("command_sent", (data: { server_name: string; command: string }) => {
      console.log("Command sent:", data);
    });

    socket.on("command_error", (data: { error: string }) => {
      console.error("Command error:", data);
    });
  }, [setIsConnected, setConnectionStatus, addLog]);

  const disconnect = useCallback(() => {
    if (socketRef.current && serverName) {
      socketRef.current.emit("leave_console", { server_name: serverName });
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
    setIsConnected(false);
    setConnectionStatus("disconnected");
  }, [serverName, setIsConnected, setConnectionStatus]);

  const sendCommand = useCallback((command: string) => {
    if (!socketRef.current || !serverName || !command.trim()) {
      return;
    }
    socketRef.current.emit("send_command", {
      server_name: serverName,
      command: command.trim(),
    });
    addCommandToHistory(command);
  }, [serverName, addCommandToHistory]);

  useEffect(() => {
    let mounted = true;
    if (serverName && mounted) {
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

  const actions: ConsoleActions = {
    connect,
    disconnect,
    sendCommand,
    setFilterLevels: useConsoleStore.getState().setFilterLevels,
    addCommandToHistory: useConsoleStore.getState().addCommandToHistory,
    navigateHistory: useConsoleStore.getState().navigateHistory,
    toggleAutoScroll: useConsoleStore.getState().toggleAutoScroll,
    setAutoScroll: useConsoleStore.getState().setAutoScroll,
    clearLogs: useConsoleStore.getState().clearLogs,
  };

  return { state, actions };
}
