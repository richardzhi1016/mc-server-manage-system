export interface LogMessage {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  message: string;
  server: string;
}

export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG" | "ALL";

export interface ConsoleState {
  isConnected: boolean;
  connectionStatus: "connecting" | "connected" | "reconnecting" | "disconnected";
  logs: LogMessage[];
  filteredLogs: LogMessage[];
  selectedLevels: LogLevel[];
  commandHistory: string[];
  historyIndex: number;
  autoScroll: boolean;
}

export interface ConsoleActions {
  connect: (serverName: string) => void;
  disconnect: () => void;
  sendCommand: (command: string) => void;
  setFilterLevels: (levels: LogLevel[]) => void;
  addCommandToHistory: (command: string) => void;
  navigateHistory: (direction: "up" | "down") => void;
  toggleAutoScroll: () => void;
  setAutoScroll: (value: boolean) => void;
  clearLogs: () => void;
}
