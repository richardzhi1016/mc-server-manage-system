export interface LogMessage {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  message: string;
  server: string;
}

export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG" | "ALL";
