export interface Server {
  id: string
  name: string
  status: "running" | "stopped" | "starting" | "stopping" | "error"
  port?: number
  path: string
  created_at: string
}

export interface ServerListResponse {
  servers: Server[]
}

export interface UploadPackageResponse {
  message: string
  server_name: string
}

export interface StartServerRequest {
  server_name: string
}

export interface StartServerResponse {
  message: string
}

export interface StopServerRequest {
  server_name: string
}

export interface StopServerResponse {
  message: string
}

export interface ServerStatusResponse {
  servers: Array<{
    name: string
    status: Server["status"]
    port?: number
  }>
}

export interface ServerMetricsResponse {
  cpu: number
  memory_used: number
  memory_total: number
  disk_used: number
  disk_total: number
  players_online: number
  players_max: number
  timestamp: string
}

export interface Player {
  username: string
  uuid: string
  latency: number
  isOp: boolean
}

export interface ServerPlayersResponse {
  server_name: string
  players: Player[]
}

export interface AllServersPlayersResponse {
  servers: Array<{
    server_name: string
    players: Player[]
  }>
}

export interface KickPlayerRequest {
  server_name: string
  username: string
  reason?: string
}

export interface KickPlayerResponse {
  message: string
}

export interface BanPlayerRequest {
  server_name: string
  username: string
  reason: string
}

export interface BanPlayerResponse {
  message: string
}

export interface UnbanPlayerRequest {
  server_name: string
  username: string
}

export interface UnbanPlayerResponse {
  message: string
}

export interface OpPlayerRequest {
  server_name: string
  username: string
}

export interface OpPlayerResponse {
  message: string
}

export interface TeleportPlayerRequest {
  server_name: string
  player: string
  target: string
}

export interface TeleportPlayerResponse {
  message: string
}

export interface WhitelistResponse {
  server_name: string
  whitelist_enabled: boolean
  players: WhitelistEntry[]
}

export interface WhitelistEntry {
  username: string
  uuid: string
  added_at: string
}

export interface AddToWhitelistRequest {
  server_name: string
  username: string
}

export interface AddToWhitelistResponse {
  message: string
}

export interface RemoveFromWhitelistRequest {
  server_name: string
  username: string
}

export interface RemoveFromWhitelistResponse {
  message: string
}

export interface BanListResponse {
  server_name: string
  banned_players: BanEntry[]
}

export interface BanEntry {
  username: string
  uuid: string
  reason: string
  banned_by: string
  banned_at: string
}

export interface ApiError {
  error: string
}

export function isApiError(data: unknown): data is ApiError {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as Record<string, unknown>).error === "string"
  )
}

export interface StartupSettings {
  min_memory: number
  max_memory: number
  jvm_flags: string[]
}

export interface ServerPropertySchema {
  type: "text" | "number" | "boolean" | "select"
  default: string | number | boolean
  label: string
  min?: number
  max?: number
  options?: string[]
}

export interface ServerPropertiesResponse {
  properties: Record<string, string>
  schema: Record<string, ServerPropertySchema>
}

export interface UpdateStartupRequest {
  server_name: string
  min_memory: number
  max_memory: number
  jvm_flags: string[]
}

export interface UpdateServerPropertiesRequest {
  server_name: string
  properties: Record<string, string>
}

export interface ThemeRequest {
  theme: "light" | "dark"
}

export interface BackupInfo {
  id: string
  server_name: string
  created_at: string
  size: number
  filename: string
}

export interface BackupListResponse {
  backups: BackupInfo[]
}

export interface CreateBackupRequest {
  server_name: string
}

export interface CreateBackupResponse {
  message: string
  backup: BackupInfo
}

export interface RestoreBackupRequest {
  server_name: string
  backup_id: string
}

export interface ScheduledTask {
  id: string
  type: "restart" | "backup"
  schedule: {
    hour: number
    minute: number
    days?: string[]
    frequency?: "daily" | "weekly"
    day?: number
  }
  enabled: boolean
  next_run?: string
}

export interface ScheduledTaskListResponse {
  tasks: ScheduledTask[]
}

export interface CreateScheduledTaskRequest {
  type: "restart" | "backup"
  schedule: ScheduledTask["schedule"]
}

export interface UpdateScheduledTaskRequest {
  enabled?: boolean
  schedule?: ScheduledTask["schedule"]
}

export interface SchedulerStatusResponse {
  running: boolean
  task_count: number
  next_tasks: Array<{
    id: string
    type: string
    next_run: string
  }>
}

export interface CreateServerRequest {
  name: string
  type?: string
  version: string
  version_url?: string  // URL to version metadata JSON
  port?: number
  // min_memory?: number
  // max_memory?: number
}

export interface CreateServerResponse {
  message: string
  server: Server
}
