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
  ScheduledTaskListResponse,
  CreateScheduledTaskRequest,
  UpdateScheduledTaskRequest,
  SchedulerStatusResponse,
} from "@/types/api"

export async function getServers(): Promise<ServerListResponse> {
  const response = await apiClient.get<ServerListResponse>("/api/servers")
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
  const params = { server_name: serverName }
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
  const response = await apiClient.post<{ message: string }>("/api/backups/restore", data)
  return response.data
}

export async function deleteBackup(serverName: string, backupId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/api/backups/${backupId}`, {
    data: { server_name: serverName },
  })
  return response.data
}

export async function downloadBackup(serverName: string, backupId: string): Promise<void> {
  const url = `${apiClient.defaults.baseURL}/api/backups/${serverName}/${backupId}/download`
  window.open(url, "_blank")
}

export async function listScheduledTasks(): Promise<ScheduledTaskListResponse> {
  const response = await apiClient.get<ScheduledTaskListResponse>("/api/scheduled-tasks")
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
