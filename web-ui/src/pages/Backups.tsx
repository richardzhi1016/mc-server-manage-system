import { useState, useEffect, useCallback } from "react"
import { useParams } from "react-router-dom"
import { Database, Plus, Download, RotateCcw, Trash2, Archive, RefreshCw } from "lucide-react"
import { useNotification } from "@/hooks/useNotification"
import {
  listBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  downloadBackup,
} from "@/api/client"
import { type BackupInfo } from "@/types/api"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { cn } from "@/lib/utils"

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function getTypeBadge(filename: string): { label: string; className: string } {
  if (filename.includes("_startup")) {
    return {
      label: "启动备份",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    }
  }
  if (filename.includes("_periodic")) {
    return {
      label: "定时备份",
      className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    }
  }
  return {
    label: "手动备份",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  }
}

export default function Backups() {
  const { serverName } = useParams<{ serverName: string }>()
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    type: "restore" | "delete"
    backupId: string
    backupName: string
  } | null>(null)
  const { notify } = useNotification()

  const loadBackups = useCallback(async () => {
    if (!serverName) return
    setLoading(true)
    try {
      const response = await listBackups(serverName)
      setBackups(response.backups ?? [])
    } catch {
      notify({ type: "error", message: "加载备份列表失败" })
    } finally {
      setLoading(false)
    }
  }, [serverName, notify])

  useEffect(() => {
    loadBackups()
  }, [loadBackups])

  const handleCreate = async () => {
    if (!serverName) return
    setCreating(true)
    try {
      await createBackup({ server_name: serverName })
      notify({ type: "success", message: "备份创建成功" })
      loadBackups()
    } catch {
      notify({ type: "error", message: "创建备份失败" })
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = async (backupId: string) => {
    if (!serverName) return
    setRestoring(backupId)
    try {
      await restoreBackup({ server_name: serverName, backup_id: backupId })
      notify({ type: "success", message: "备份恢复成功" })
      setConfirmAction(null)
    } catch {
      notify({ type: "error", message: "恢复备份失败" })
    } finally {
      setRestoring(null)
    }
  }

  const handleDelete = async (backupId: string) => {
    if (!serverName) return
    try {
      await deleteBackup(serverName, backupId)
      notify({ type: "success", message: "备份已删除" })
      setConfirmAction(null)
      loadBackups()
    } catch {
      notify({ type: "error", message: "删除备份失败" })
    }
  }

  const handleDownload = (backup: BackupInfo) => {
    downloadBackup(backup.server_name, backup.id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Database className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">备份管理</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-11">
            管理服务器备份，支持创建、恢复和下载
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadBackups} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button onClick={handleCreate} disabled={creating || !serverName} className="gap-2">
            <Plus className="w-4 h-4" />
            {creating ? "创建中..." : "创建备份"}
          </Button>
        </div>
      </div>

      {/* Backup List */}
      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                  </div>
                  <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : backups.length === 0 ? (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="py-12 text-center">
            <Archive className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">暂无备份</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              点击"创建备份"为当前服务器创建第一个备份
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {backups.map((backup) => {
            const badge = getTypeBadge(backup.filename)
            return (
              <Card
                key={backup.id}
                className="dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {backup.filename}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0",
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span>{formatDate(backup.created_at)}</span>
                        <span>{formatSize(backup.size)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(backup)}
                        className="gap-1.5 text-gray-600 dark:text-gray-400"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">下载</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setConfirmAction({
                            type: "restore",
                            backupId: backup.id,
                            backupName: backup.filename,
                          })
                        }
                        className="gap-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span className="hidden sm:inline">恢复</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setConfirmAction({
                            type: "delete",
                            backupId: backup.id,
                            backupName: backup.filename,
                          })
                        }
                        className="gap-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">删除</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {confirmAction.type === "restore" ? "确认恢复" : "确认删除"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-1">
              {confirmAction.type === "restore"
                ? "恢复此备份将覆盖当前服务器数据，服务器将在恢复期间停止运行。"
                : "确定要删除此备份吗？此操作无法撤销。"}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4 break-all">
              {confirmAction.backupName}
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setConfirmAction(null)}
              >
                取消
              </Button>
              {confirmAction.type === "restore" ? (
                <Button
                  onClick={() => handleRestore(confirmAction.backupId)}
                  disabled={restoring === confirmAction.backupId}
                >
                  {restoring === confirmAction.backupId ? "恢复中..." : "确认恢复"}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(confirmAction.backupId)}
                >
                  确认删除
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
