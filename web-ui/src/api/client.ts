import { apiClient } from "@/lib/api"
import type {
  ServerListResponse,
  UploadPackageResponse,
  StartServerRequest,
  StartServerResponse,
  StopServerRequest,
  StopServerResponse,
  ServerStatusResponse,
  ServerMetricsResponse,
  ServerPlayersResponse,
  KickPlayerRequest,
  KickPlayerResponse,
  BanPlayerRequest,
  BanPlayerResponse,
  UnbanPlayerRequest,
  UnbanPlayerResponse,
  OpPlayerRequest,
  OpPlayerResponse,
  TeleportPlayerRequest,
  TeleportPlayerResponse,
  WhitelistResponse,
  AddToWhitelistRequest,
  AddToWhitelistResponse,
  RemoveFromWhitelistRequest,
  RemoveFromWhitelistResponse,
  BanListResponse,
  StartupSettings,
  UpdateStartupRequest,
  ServerPropertiesResponse,
  UpdateServerPropertiesRequest,
  ThemeRequest,
  BackupListResponse,
  CreateBackupRequest,
  CreateBackupResponse,
  RestoreBackupRequest,
  ScheduledTask,
  ScheduledTaskListResponse,
  CreateScheduledTaskRequest,
  UpdateScheduledTaskRequest,
  SchedulerStatusResponse,
  CreateServerRequest,
  CreateServerResponse,
  CloneServerRequest,
  CloneServerResponse,
  NextAvailablePortResponse,
  ModSearchResponse,
  InstalledModsResponse,
  ModVersion,
  DependencyCheckResult,
  ModInstallRequest,
  ModInstallResponse,
  ModToggleResponse,
  ModDeleteResponse,
  InstalledPluginsResponse,
  ModCategory,
  PlaytimeEntry,
  HeatmapCell,
  RetentionData,
  StatusPageConfig,
  PublicServerStatus,
  DiscordBotConfig,
  DiscordBotState,
} from "@/types/api"

export async function getServers(): Promise<ServerListResponse> {
  const response = await apiClient.get<ServerListResponse>("/api/servers")
  return response.data
}

export async function createServer(data: CreateServerRequest): Promise<CreateServerResponse> {
  // Forge installation can take several minutes — use a 15-minute timeout
  const response = await apiClient.post<CreateServerResponse>("/api/servers", data, {
    timeout: 900000,
  })
  return response.data
}

export async function uploadPackage(file: File): Promise<UploadPackageResponse> {
  const formData = new FormData()
  formData.append("file", file)
  const response = await apiClient.post<UploadPackageResponse>("/api/upload-package", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return response.data
}

export async function startServer(data: StartServerRequest): Promise<StartServerResponse> {
  const response = await apiClient.post<StartServerResponse>("/api/start-server", data)
  return response.data
}

export async function stopServer(data: StopServerRequest): Promise<StopServerResponse> {
  const response = await apiClient.post<StopServerResponse>("/api/stop-server", data)
  return response.data
}

export async function getServerStatus(): Promise<ServerStatusResponse> {
  const response = await apiClient.get<ServerStatusResponse>("/api/server-status")
  return response.data
}

export async function getServerMetrics(serverName?: string): Promise<ServerMetricsResponse> {
  const params = serverName ? { server_name: serverName } : {}
  const response = await apiClient.get<ServerMetricsResponse>("/api/server-metrics", { params })
  return response.data
}

export async function getOnlinePlayers(serverName?: string): Promise<ServerPlayersResponse> {
  const params = serverName ? { server_name: serverName } : {}
  const response = await apiClient.get<ServerPlayersResponse>("/api/players/online", { params })
  return response.data
}

export async function kickPlayer(data: KickPlayerRequest): Promise<KickPlayerResponse> {
  const response = await apiClient.post<KickPlayerResponse>("/api/players/kick", data)
  return response.data
}

export async function banPlayer(data: BanPlayerRequest): Promise<BanPlayerResponse> {
  const response = await apiClient.post<BanPlayerResponse>("/api/players/ban", data)
  return response.data
}

export async function unbanPlayer(data: UnbanPlayerRequest): Promise<UnbanPlayerResponse> {
  const response = await apiClient.post<UnbanPlayerResponse>("/api/players/unban", data)
  return response.data
}

export async function opPlayer(data: OpPlayerRequest): Promise<OpPlayerResponse> {
  const response = await apiClient.post<OpPlayerResponse>("/api/players/op", data)
  return response.data
}

export async function deopPlayer(data: OpPlayerRequest): Promise<OpPlayerResponse> {
  const response = await apiClient.post<OpPlayerResponse>("/api/players/deop", data)
  return response.data
}

export async function teleportPlayer(data: TeleportPlayerRequest): Promise<TeleportPlayerResponse> {
  const response = await apiClient.post<TeleportPlayerResponse>("/api/players/teleport", data)
  return response.data
}

export async function getWhitelist(serverName?: string): Promise<WhitelistResponse> {
  const params = serverName ? { server_name: serverName } : {}
  const response = await apiClient.get<WhitelistResponse>("/api/whitelist", { params })
  return response.data
}

export async function addToWhitelist(data: AddToWhitelistRequest): Promise<AddToWhitelistResponse> {
  const response = await apiClient.post<AddToWhitelistResponse>("/api/whitelist/add", data)
  return response.data
}

export async function removeFromWhitelist(data: RemoveFromWhitelistRequest): Promise<RemoveFromWhitelistResponse> {
  const response = await apiClient.post<RemoveFromWhitelistResponse>("/api/whitelist/remove", data)
  return response.data
}

export async function getBans(serverName?: string): Promise<BanListResponse> {
  const params = serverName ? { server_name: serverName } : {}
  const response = await apiClient.get<BanListResponse>("/api/bans", { params })
  return response.data
}

export async function getStartupSettings(serverName: string): Promise<StartupSettings> {
  const params = { server_name: serverName, _t: Date.now() }
  const response = await apiClient.get<StartupSettings>("/api/settings/startup", { params })
  return response.data
}

export async function updateStartupSettings(data: UpdateStartupRequest): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>("/api/settings/startup", data)
  return response.data
}

export async function getServerProperties(serverName: string): Promise<ServerPropertiesResponse> {
  const params = { server_name: serverName }
  const response = await apiClient.get<ServerPropertiesResponse>("/api/settings/server-properties", { params })
  return response.data
}

export async function updateServerProperties(data: UpdateServerPropertiesRequest): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>("/api/settings/server-properties", data)
  return response.data
}

export async function saveTheme(data: ThemeRequest): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>("/api/settings/theme", data)
  return response.data
}

export async function listBackups(serverName?: string): Promise<BackupListResponse> {
  const params = serverName ? { server_name: serverName } : {}
  const response = await apiClient.get<BackupListResponse>("/api/backups", { params })
  return response.data
}

export async function createBackup(data: CreateBackupRequest): Promise<CreateBackupResponse> {
  const response = await apiClient.post<CreateBackupResponse>("/api/backups", data)
  return response.data
}

export async function restoreBackup(data: RestoreBackupRequest): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(
    `/api/backups/${encodeURIComponent(data.server_name)}/${encodeURIComponent(data.backup_id)}/restore`
  )
  return response.data
}

export async function deleteBackup(serverName: string, backupId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(
    `/api/backups/${encodeURIComponent(serverName)}/${encodeURIComponent(backupId)}`
  )
  return response.data
}

export async function downloadBackup(serverName: string, backupId: string): Promise<void> {
  const url = `${apiClient.defaults.baseURL}/api/backups/${serverName}/${backupId}/download`
  window.open(url, "_blank")
}

export async function listScheduledTasks(serverName?: string): Promise<ScheduledTaskListResponse> {
  const params = serverName ? { server_name: serverName } : {}
  const response = await apiClient.get<ScheduledTaskListResponse>("/api/scheduled-tasks", { params })
  return response.data
}

export async function createScheduledTask(data: CreateScheduledTaskRequest): Promise<{ message: string; task: ScheduledTask }> {
  const response = await apiClient.post<{ message: string; task: ScheduledTask }>("/api/scheduled-tasks", data)
  return response.data
}

export async function updateScheduledTask(
  taskId: string,
  data: UpdateScheduledTaskRequest
): Promise<{ message: string }> {
  const response = await apiClient.put<{ message: string }>(`/api/scheduled-tasks/${taskId}`, data)
  return response.data
}

export async function deleteScheduledTask(taskId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/api/scheduled-tasks/${taskId}`)
  return response.data
}

export async function getSchedulerStatus(): Promise<SchedulerStatusResponse> {
  const response = await apiClient.get<SchedulerStatusResponse>("/api/scheduler/status")
  return response.data
}

export async function cloneServer(
  serverName: string,
  data: CloneServerRequest
): Promise<CloneServerResponse> {
  const response = await apiClient.post<CloneServerResponse>(
    `/api/servers/${encodeURIComponent(serverName)}/clone`,
    data
  )
  return response.data
}

export async function deleteServer(serverName: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(
    `/api/servers/${encodeURIComponent(serverName)}/delete`
  )
  return response.data
}

export async function getNextAvailablePort(): Promise<NextAvailablePortResponse> {
  const response = await apiClient.get<NextAvailablePortResponse>(
    "/api/servers/next-available-port"
  )
  return response.data
}

// -- Mod Management --

export async function searchMods(
  query: string,
  version: string,
  loader: string,
  page: number = 0,
  limit: number = 20,
  categories?: string[],
  index?: string
): Promise<ModSearchResponse> {
  const response = await apiClient.get<ModSearchResponse>("/api/mods/search", {
    params: {
      query, version, loader, page, limit,
      ...(categories?.length ? { "categories[]": categories } : {}),
      ...(index ? { index } : {}),
    },
  })
  return response.data
}

export async function getModCategories(): Promise<ModCategory[]> {
  const response = await apiClient.get<ModCategory[]>("/api/mods/categories")
  return response.data
}

export async function getModDetails(projectId: string): Promise<Record<string, unknown>> {
  const response = await apiClient.get(`/api/mods/${encodeURIComponent(projectId)}`)
  return response.data
}

export async function getModVersions(
  projectId: string,
  gameVersion?: string,
  loader?: string
): Promise<ModVersion[]> {
  const response = await apiClient.get<ModVersion[]>(
    `/api/mods/${encodeURIComponent(projectId)}/versions`,
    { params: { game_version: gameVersion, loader } }
  )
  return response.data
}

export async function getInstalledMods(serverName: string): Promise<InstalledModsResponse> {
  const response = await apiClient.get<InstalledModsResponse>(
    `/api/servers/${encodeURIComponent(serverName)}/mods`
  )
  return response.data
}

export async function installMod(
  serverName: string,
  data: ModInstallRequest
): Promise<ModInstallResponse> {
  const response = await apiClient.post<ModInstallResponse>(
    `/api/servers/${encodeURIComponent(serverName)}/mods/install`,
    data
  )
  return response.data
}

export async function toggleMod(
  serverName: string,
  filename: string
): Promise<ModToggleResponse> {
  const response = await apiClient.post<ModToggleResponse>(
    `/api/servers/${encodeURIComponent(serverName)}/mods/${encodeURIComponent(filename)}/toggle`
  )
  return response.data
}

export async function deleteMod(
  serverName: string,
  filename: string
): Promise<ModDeleteResponse> {
  const response = await apiClient.delete<ModDeleteResponse>(
    `/api/servers/${encodeURIComponent(serverName)}/mods/${encodeURIComponent(filename)}`
  )
  return response.data
}

export async function checkModDependencies(
  serverName: string,
  versionId: string
): Promise<DependencyCheckResult> {
  const response = await apiClient.post<DependencyCheckResult>(
    `/api/servers/${encodeURIComponent(serverName)}/mods/check-deps`,
    { version_id: versionId }
  )
  return response.data
}

// -- Plugin Management --

export async function searchPlugins(
  query: string,
  version: string,
  page: number = 0,
  limit: number = 20,
  categories?: string[],
  index?: string
): Promise<ModSearchResponse> {
  const response = await apiClient.get<ModSearchResponse>("/api/plugins/search", {
    params: {
      query, version, page, limit,
      ...(categories?.length ? { "categories[]": categories } : {}),
      ...(index ? { index } : {}),
    },
  })
  return response.data
}

export async function getPluginCategories(): Promise<ModCategory[]> {
  const response = await apiClient.get<ModCategory[]>("/api/plugins/categories")
  return response.data
}

export async function getPluginDetails(projectId: string): Promise<Record<string, unknown>> {
  const response = await apiClient.get(`/api/plugins/${encodeURIComponent(projectId)}`)
  return response.data
}

export async function getPluginVersions(
  projectId: string,
  gameVersion?: string,
  loader: string = "paper"
): Promise<ModVersion[]> {
  const response = await apiClient.get<ModVersion[]>(
    `/api/plugins/${encodeURIComponent(projectId)}/versions`,
    { params: { game_version: gameVersion, loader } }
  )
  return response.data
}

export async function getInstalledPlugins(serverName: string): Promise<InstalledPluginsResponse> {
  const response = await apiClient.get<InstalledPluginsResponse>(
    `/api/servers/${encodeURIComponent(serverName)}/plugins`
  )
  return response.data
}

export async function installPlugin(
  serverName: string,
  data: ModInstallRequest
): Promise<ModInstallResponse> {
  const response = await apiClient.post<ModInstallResponse>(
    `/api/servers/${encodeURIComponent(serverName)}/plugins/install`,
    data
  )
  return response.data
}

export async function togglePlugin(
  serverName: string,
  filename: string
): Promise<ModToggleResponse> {
  const response = await apiClient.post<ModToggleResponse>(
    `/api/servers/${encodeURIComponent(serverName)}/plugins/${encodeURIComponent(filename)}/toggle`
  )
  return response.data
}

export async function deletePlugin(
  serverName: string,
  filename: string
): Promise<ModDeleteResponse> {
  const response = await apiClient.delete<ModDeleteResponse>(
    `/api/servers/${encodeURIComponent(serverName)}/plugins/${encodeURIComponent(filename)}`
  )
  return response.data
}

export async function checkPluginDependencies(
  serverName: string,
  versionId: string
): Promise<DependencyCheckResult> {
  const response = await apiClient.post<DependencyCheckResult>(
    `/api/servers/${encodeURIComponent(serverName)}/plugins/check-deps`,
    { version_id: versionId }
  )
  return response.data
}

// --- TPS & Health ---
export interface TpsDataPoint {
  tps: number | null
  status: 'ok' | 'lagging' | 'warming_up' | 'unknown'
  timestamp: string
}

export async function getTpsHistory(
  serverName: string,
  hours = 1
): Promise<{ server_name: string; history: TpsDataPoint[] }> {
  const res = await apiClient.get(`/api/servers/${encodeURIComponent(serverName)}/tps/history`, { params: { hours } })
  return res.data
}

export interface HealthData {
  server_name: string
  score: number
  grade: 'green' | 'yellow' | 'red'
  cpu: number
  memory_pct: number
  tps: number | null
  timestamp: string
}

export async function getHealth(serverName: string): Promise<HealthData> {
  const res = await apiClient.get(`/api/servers/${encodeURIComponent(serverName)}/health`)
  return res.data
}

// --- Alert Configs ---
export interface AlertConfig {
  id: number
  type: 'discord_webhook' | 'email'
  config: Record<string, string>
  enabled: boolean
}

export async function getAlertConfigs(serverName: string): Promise<AlertConfig[]> {
  const res = await apiClient.get(`/api/servers/${encodeURIComponent(serverName)}/alerts/config`)
  return res.data.configs
}

export async function saveAlertConfig(
  serverName: string,
  data: { type: string; config: Record<string, string>; enabled?: boolean }
): Promise<{ id: number; message: string }> {
  const res = await apiClient.post(`/api/servers/${encodeURIComponent(serverName)}/alerts/config`, data)
  return res.data
}

export async function deleteAlertConfig(serverName: string, configId: number): Promise<void> {
  await apiClient.delete(`/api/servers/${encodeURIComponent(serverName)}/alerts/config/${configId}`)
}

// --- Auto-Restart Rules ---
export interface AutoRestartRule {
  id: number
  trigger_type: 'tps_below' | 'memory_above' | 'empty_server'
  threshold: number
  duration_seconds: number
  cooldown_minutes: number
  enabled: boolean
}

export async function getAutoRestartRules(serverName: string): Promise<AutoRestartRule[]> {
  const res = await apiClient.get(`/api/servers/${encodeURIComponent(serverName)}/auto-restart/rules`)
  return res.data.rules
}

export async function createAutoRestartRule(
  serverName: string,
  data: Omit<AutoRestartRule, 'id' | 'enabled'>
): Promise<{ id: number }> {
  const res = await apiClient.post(`/api/servers/${encodeURIComponent(serverName)}/auto-restart/rules`, data)
  return res.data
}

export async function deleteAutoRestartRule(serverName: string, ruleId: number): Promise<void> {
  await apiClient.delete(`/api/servers/${encodeURIComponent(serverName)}/auto-restart/rules/${ruleId}`)
}

export async function cancelAutoRestart(serverName: string): Promise<void> {
  await apiClient.post(`/api/servers/${encodeURIComponent(serverName)}/auto-restart/cancel`)
}

// Analytics
export async function getPlaytime(serverName: string, from?: string, to?: string): Promise<PlaytimeEntry[]> {
  const params = new URLSearchParams()
  if (from) params.set("from", from)
  if (to) params.set("to", to)
  const qs = params.toString() ? `?${params}` : ""
  const resp = await apiClient.get<{ playtime: PlaytimeEntry[] }>(`/api/servers/${serverName}/analytics/playtime${qs}`)
  return resp.data.playtime
}

export async function getHeatmap(serverName: string, from?: string, to?: string): Promise<HeatmapCell[]> {
  const params = new URLSearchParams()
  if (from) params.set("from", from)
  if (to) params.set("to", to)
  const qs = params.toString() ? `?${params}` : ""
  const resp = await apiClient.get<{ heatmap: HeatmapCell[] }>(`/api/servers/${serverName}/analytics/heatmap${qs}`)
  return resp.data.heatmap
}

export async function getRetention(serverName: string, from?: string, to?: string): Promise<RetentionData> {
  const params = new URLSearchParams()
  if (from) params.set("from", from)
  if (to) params.set("to", to)
  const qs = params.toString() ? `?${params}` : ""
  const resp = await apiClient.get<RetentionData>(`/api/servers/${serverName}/analytics/retention${qs}`)
  return resp.data
}

// Status Page
export async function enableStatusPage(serverName: string): Promise<StatusPageConfig> {
  const resp = await apiClient.post<StatusPageConfig>(`/api/servers/${serverName}/status-page/enable`)
  return resp.data
}

export async function disableStatusPage(serverName: string): Promise<void> {
  await apiClient.post(`/api/servers/${serverName}/status-page/disable`)
}

export async function resetStatusPageToken(serverName: string): Promise<StatusPageConfig> {
  const resp = await apiClient.post<StatusPageConfig>(`/api/servers/${serverName}/status-page/token/reset`)
  return resp.data
}

export async function getStatusPageConfig(serverName: string): Promise<StatusPageConfig> {
  const resp = await apiClient.get<StatusPageConfig>(`/api/servers/${serverName}/status-page/config`)
  return resp.data
}

export async function getPublicStatus(token: string): Promise<PublicServerStatus> {
  const resp = await apiClient.get<PublicServerStatus>(`/api/public/status/${token}`)
  return resp.data
}

// Discord Bot
export async function getDiscordBotConfig(): Promise<{ config: DiscordBotConfig | null }> {
  const resp = await apiClient.get<{ config: DiscordBotConfig | null }>("/api/discord-bot/config")
  return resp.data
}

export async function saveDiscordBotConfig(config: { token: string; channel_id: string }): Promise<void> {
  await apiClient.post("/api/discord-bot/config", config)
}

export async function startDiscordBot(): Promise<DiscordBotState> {
  const resp = await apiClient.post<DiscordBotState>("/api/discord-bot/start")
  return resp.data
}

export async function stopDiscordBot(): Promise<void> {
  await apiClient.post("/api/discord-bot/stop")
}

export async function getDiscordBotStatus(): Promise<DiscordBotState> {
  const resp = await apiClient.get<DiscordBotState>("/api/discord-bot/status")
  return resp.data
}
