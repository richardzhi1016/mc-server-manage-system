export interface Server {
  id: string
  name: string
  server_type: string | null
  version: string | null
  port: number | null
  status: "running" | "stopped"
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
  backup_on_startup?: boolean
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
  backup_on_startup?: boolean
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
  type?: string
  /** User-defined display name / alias */
  name?: string
}

export interface BackupListResponse {
  backups: BackupInfo[]
}

export interface CreateBackupRequest {
  server_name: string
  /** Optional custom alias for the backup */
  name?: string
}

export interface CreateBackupResponse {
  message: string
  backup: BackupInfo
}

export interface RestoreBackupRequest {
  server_name: string
  backup_id: string
}

export interface RenameBackupRequest {
  name: string
}

export interface BackupRetentionResponse {
  retention: number
}

export interface ScheduledTaskSchedule {
  frequency: "daily" | "weekly" | "interval"
  hour?: number
  minute?: number
  days?: string[]
  interval_value?: number
  interval_unit?: "minutes" | "hours"
}

export interface ScheduledTask {
  id: string
  server_name: string
  type: "restart" | "backup"
  schedule: ScheduledTaskSchedule
  enabled: boolean
  next_run?: string
  last_run?: string
  created_at?: string
}

export interface ScheduledTaskListResponse {
  tasks: ScheduledTask[]
}

export interface CreateScheduledTaskRequest {
  server_name: string
  type: "restart" | "backup"
  schedule: ScheduledTaskSchedule
}

export interface UpdateScheduledTaskRequest {
  enabled?: boolean
  schedule?: Partial<ScheduledTaskSchedule>
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
  version_url?: string  // URL to version metadata JSON (Vanilla)
  loader_version?: string  // Fabric loader version
  installer_version?: string  // Fabric installer version
  port?: number
  // min_memory?: number
  // max_memory?: number
}

export interface CreateServerResponse {
  message: string
  server: Server
}

export interface CloneServerRequest {
  new_name: string
  new_port?: number
}

export interface CloneServerResponse {
  message: string
  server: Server
  warning?: string
}

export interface NextAvailablePortResponse {
  port: number
}

// -- Mod Management --

export interface InstalledMod {
  filename: string
  enabled: boolean
  mod_id: string | null
  name: string
  version: string | null
  description: string | null
  authors: string[]
  file_size: number
  modified_at: string
  modrinth_project_id: string | null
}

export interface InstalledModsResponse {
  mods: InstalledMod[]
  server_name: string
}

export interface ModSearchResult {
  project_id: string
  slug: string
  title: string
  description: string
  icon_url: string | null
  downloads: number
  date_modified: string
  categories: string[]
}

export interface ModSearchResponse {
  hits: ModSearchResult[]
  total_hits: number
  limit: number
  offset: number
}

export interface ModVersion {
  id: string
  name: string
  version_number: string
  game_versions: string[]
  loaders: string[]
  files: Array<{
    filename: string
    size: number
    url: string
    primary: boolean
  }>
  dependencies: ModDependency[]
}

export interface ModDependency {
  project_id: string
  version_id: string | null
  dependency_type: "required" | "optional"
  name: string
}

export interface DependencyCheckRequest {
  version_id: string
}

export interface DependencyCheckResult {
  missing: ModDependency[]
  satisfied: string[]
}

export interface ModInstallRequest {
  project_id: string
  version_id: string
}

export interface ModInstallResponse {
  success: boolean
  filename: string
  restart_required: boolean
}

export interface ModToggleResponse {
  success: boolean
  filename: string
  enabled: boolean
  restart_required: boolean
}

export interface ModDeleteResponse {
  success: boolean
  restart_required: boolean
}

export interface ModCategory {
  name: string
  icon: string
  header: string
}

// -- Plugin Management --

export interface InstalledPlugin {
  filename: string
  enabled: boolean
  name: string
  version: string | null
  description: string | null
  authors: string[]
  file_size: number
  modified_at: string
  modrinth_project_id: string | null
}

export interface InstalledPluginsResponse {
  plugins: InstalledPlugin[]
  server_name: string
}

// Analytics
export interface PlaytimeEntry {
  username: string
  total_seconds: number
}
export interface HeatmapCell {
  dow: number
  hour: number
  avg: number
}
export interface RetentionData {
  retention_pct: number
  sample_size: number
}

// Status Page
export interface StatusPageConfig {
  token: string | null
  url: string | null
}
export interface PublicServerStatus {
  server_name: string
  status: "running" | "stopped"
  version: string | null
  players_online: number | null
  players_max: number | null
  uptime_seconds: number | null
  health_score: number | null
  tps: number | null
}

// Discord Bot
export interface DiscordBotConfig {
  token: string
  channel_id: string
  enabled: boolean
}
export interface DiscordBotState {
  state: "stopped" | "running" | "retrying" | "crashed"
}
