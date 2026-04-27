import { useState, useEffect, useCallback, useRef } from "react"
import { useParams } from "react-router-dom"
import { Database, Plus, Download, RotateCcw, Trash2, Archive, RefreshCw, Search, Pencil, Check, X, Lock, Unlock } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNotification } from "@/hooks/useNotification"
import {
  listBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  downloadBackup,
  renameBackup,
  toggleBackupLock,
  getBackupRetention,
  setBackupRetention,
} from "@/api/client"
import { type BackupInfo } from "@/types/api"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { cn } from "@/lib/utils"
import { currentLocale } from "@/i18n/locale"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString(currentLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

/** Generate a timestamp string like "2026-04-18 12:34:56" for default backup names */
function nowTimestamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

function getTypeBadge(backup: BackupInfo): { key: string; className: string } {
  const typeStr = backup.type || ""
  const filename = backup.filename || ""

  if (typeStr === "startup" || filename.includes("_startup")) {
    return {
      key: "types.startup",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    }
  }
  if (
    typeStr === "scheduled" ||
    typeStr === "periodic" ||
    filename.includes("_scheduled") ||
    filename.includes("_periodic")
  ) {
    return {
      key: "types.scheduled",
      className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    }
  }
  return {
    key: "types.manual",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  }
}

function formatBackupName(filename: string): string {
  const match = filename.match(/backup-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/)
  if (match) {
    const [, year, month, day, hourStr, minute] = match
    const hour = parseInt(hourStr, 10)
    const ampm = hour >= 12 ? "pm" : "am"
    const formattedHour = hour % 12 === 0 ? 12 : hour % 12
    return `${year}年-${parseInt(month, 10)}月-${parseInt(day, 10)}日，${formattedHour}.${minute}${ampm}`
  }
  return filename
}

/** Display label: prefer user-set `name`, fall back to formatted filename */
function displayName(backup: BackupInfo): string {
  return backup.name?.trim() || formatBackupName(backup.filename)
}

// ─── Inline-Editing Sub-component ────────────────────────────────────────────

interface InlineTitleProps {
  backup: BackupInfo
  onSave: (backupId: string, newName: string) => Promise<void>
  placeholder: string
}

function InlineTitle({ backup, onSave, placeholder }: InlineTitleProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(backup.name || "")
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep local value in sync when backup.name changes externally
  useEffect(() => {
    if (!editing) {
      setValue(backup.name || "")
    }
  }, [backup.name, editing])

  const startEdit = () => {
    setValue(backup.name || "")
    setEditing(true)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }

  const commitSave = async () => {
    const trimmed = value.trim()
    // Only skip if the name hasn't changed
    if (trimmed === (backup.name || "")) {
      setEditing(false)
      setValue(backup.name || "")
      return
    }
    setSaving(true)
    try {
      await onSave(backup.id, trimmed)
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  const cancelEdit = () => {
    setEditing(false)
    setValue(backup.name || "")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      commitSave()
    } else if (e.key === "Escape") {
      e.preventDefault()
      cancelEdit()
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commitSave}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className="h-7 text-sm font-medium py-0 px-2 max-w-xs"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={commitSave}
          disabled={saving}
          className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
          title="Save (Enter)"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Cancel (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div
      className="group/title flex items-center gap-1.5 min-w-0 cursor-pointer"
      onClick={startEdit}
      title="Click to rename"
    >
      <span className="font-medium text-gray-900 dark:text-white truncate">
        {displayName(backup)}
      </span>
      {/* Pencil icon – hidden until hover */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); startEdit() }}
        className="opacity-0 group-hover/title:opacity-100 transition-opacity p-0.5 rounded text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 flex-shrink-0"
        title="Rename backup"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Backups() {
  const { serverName } = useParams<{ serverName: string }>()
  const { t } = useTranslation("backups")
  const { t: tc } = useTranslation("common")

  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    type: "restore" | "delete"
    backupId: string
    backupName: string
  } | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState("all")

  // ── Pre-creation name input (default = current timestamp) ──────────────────
  const [newBackupName, setNewBackupName] = useState(nowTimestamp)
  const [lockOnCreate, setLockOnCreate] = useState(false)
  const [retention, setRetention] = useState<string>("10")
  const [flashSaved, setFlashSaved] = useState(false)

  const { notify } = useNotification()

  const loadBackups = useCallback(async () => {
    if (!serverName) return
    setLoading(true)
    try {
      const response = await listBackups(serverName)
      setBackups(response.backups ?? [])
    } catch {
      notify({ type: "error", message: t("errors.load") })
    } finally {
      setLoading(false)
    }
  }, [serverName, notify, t])

  const loadRetention = useCallback(async () => {
    if (!serverName) return
    try {
      const response = await getBackupRetention(serverName)
      setRetention(response.retention.toString())
    } catch {
      console.error("Failed to load retention policy")
    }
  }, [serverName])

  useEffect(() => {
    loadBackups()
    loadRetention()
  }, [loadBackups, loadRetention])

  const handleSaveRetention = async (valueStr: string) => {
    if (!serverName) return
    let val = parseInt(valueStr, 10)
    
    // Empty input recovery
    if (isNaN(val) || valueStr.trim() === "") {
      val = 10
    }
    
    // Boundary enforcement
    if (val < 5) val = 5
    if (val > 50) val = 50
    
    setRetention(val.toString())
    
    try {
      await setBackupRetention(serverName, val)
      setFlashSaved(true)
      setTimeout(() => setFlashSaved(false), 1500)
    } catch {
      notify({ type: "error", message: t("errors.saveRetention") || "Failed to save retention policy" })
    }
  }

  const handleRetentionBlur = () => {
    handleSaveRetention(retention)
  }

  const handleRetentionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      e.currentTarget.blur() // this will trigger onBlur and save
    }
  }

  // ── Create with custom name ────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!serverName) return
    setCreating(true)
    try {
      const name = newBackupName.trim()
      await createBackup({ 
        server_name: serverName, 
        name: name || undefined,
        is_locked: lockOnCreate
      })
      notify({ type: "success", message: t("success.created") })
      // Refresh the default name so it's ready for the next backup
      setNewBackupName(nowTimestamp())
      setLockOnCreate(false)
      loadBackups()
    } catch {
      notify({ type: "error", message: t("errors.create") })
    } finally {
      setCreating(false)
    }
  }

  // ── Restore ───────────────────────────────────────────────────────────────
  const handleRestore = async (backupId: string) => {
    if (!serverName) return
    setRestoring(backupId)
    try {
      await restoreBackup({ server_name: serverName, backup_id: backupId })
      notify({ type: "success", message: t("success.restored") })
      setConfirmAction(null)
    } catch {
      notify({ type: "error", message: t("errors.restore") })
    } finally {
      setRestoring(null)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (backupId: string) => {
    if (!serverName) return
    try {
      await deleteBackup(serverName, backupId)
      notify({ type: "success", message: t("success.deleted") })
      setConfirmAction(null)
      loadBackups()
    } catch {
      notify({ type: "error", message: t("errors.delete") })
    }
  }

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = (backup: BackupInfo) => {
    downloadBackup(backup.server_name, backup.id)
  }

  // ── Inline rename ─────────────────────────────────────────────────────────
  const handleRename = async (backupId: string, newName: string) => {
    if (!serverName) return
    try {
      await renameBackup(serverName, backupId, newName)
      // Optimistic update: update local state immediately
      setBackups((prev) =>
        prev.map((b) => (b.id === backupId ? { ...b, name: newName } : b))
      )
      notify({ type: "success", message: t("success.renamed") })
    } catch {
      notify({ type: "error", message: t("errors.rename") })
      throw new Error("rename failed") // re-throw so InlineTitle can revert
    }
  }

  // ── Toggle lock ───────────────────────────────────────────────────────────
  const handleToggleLock = async (backupId: string) => {
    if (!serverName) return
    try {
      await toggleBackupLock(serverName, backupId)
      setBackups((prev) =>
        prev.map((b) => (b.id === backupId ? { ...b, is_locked: !b.is_locked } : b))
      )
      const backup = backups.find(b => b.id === backupId)
      const isNowLocked = !backup?.is_locked
      notify({ 
        type: "success", 
        message: isNowLocked ? t("success.locked") : t("success.unlocked") 
      })
    } catch {
      notify({ type: "error", message: t("errors.lock") })
    }
  }

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredBackups = backups.filter((backup) => {
    const label = displayName(backup).toLowerCase()
    const fileMatch = backup.filename.toLowerCase().includes(searchQuery.toLowerCase())
    const nameMatch = label.includes(searchQuery.toLowerCase())
    if (!fileMatch && !nameMatch) return false

    if (filterType === "all") return true
    const badge = getTypeBadge(backup)
    const typeMap: Record<string, string> = {
      "types.startup": "startup",
      "types.scheduled": "scheduled",
      "types.manual": "manual",
    }
    return typeMap[badge.key] === filterType
  })

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Database className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("title")}</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-11">{t("subtitle")}</p>
        </div>

        {/* Right Side: Controls & Quick Settings */}
        <div className="flex flex-col sm:items-end gap-2">
          {/* Create Backup controls */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2 order-2 sm:order-1">
              <Button variant="outline" size="icon" onClick={loadBackups} disabled={loading}>
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>
              <Button onClick={handleCreate} disabled={creating || !serverName} className="gap-2">
                <Plus className="w-4 h-4" />
                {creating ? t("actions.creating") : t("actions.create")}
              </Button>
            </div>

            {/* ── Pre-creation name input ── */}
            <div className="flex items-center gap-4 w-full sm:w-auto order-1 sm:order-2">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  id="lock-on-create"
                  checked={lockOnCreate}
                  onChange={(e) => setLockOnCreate(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="lock-on-create" className="cursor-pointer select-none">
                  {t("actions.lockOnCreate") || "Lock immediately"}
                </label>
              </div>
              <Input
                id="new-backup-name"
                placeholder={t("actions.namePlaceholder")}
                value={newBackupName}
                onChange={(e) => setNewBackupName(e.target.value)}
                className="h-9 text-sm sm:w-56"
                title={t("actions.nameInputTitle")}
              />
            </div>
          </div>
          
          {/* Quick Settings: Retention Policy */}
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1 sm:mt-0">
            <span>{t("retention.prefix") || "Retention Policy: Keep the last"}</span>
            <Input
              type="text"
              value={retention}
              onChange={(e) => setRetention(e.target.value)}
              onBlur={handleRetentionBlur}
              onKeyDown={handleRetentionKeyDown}
              className={cn(
                "h-7 w-14 text-center px-1 text-sm transition-colors",
                flashSaved ? "bg-green-100 border-green-500 text-green-800 dark:bg-green-900/40 dark:border-green-500 dark:text-green-300" : ""
              )}
            />
            <span>{t("retention.suffix") || "backups"}</span>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder={t("actions.search") || "Search backups..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">{t("filters.all") || "All Types"}</option>
          <option value="manual">{t("types.manual") || "Manual"}</option>
          <option value="scheduled">{t("types.scheduled") || "Scheduled"}</option>
          <option value="startup">{t("types.startup") || "Startup"}</option>
        </select>
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
            <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">{t("empty")}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">{t("emptyDesc")}</p>
          </CardContent>
        </Card>
      ) : filteredBackups.length === 0 ? (
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="py-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              {t("noSearchResults") || "No backups match your search."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredBackups.map((backup) => {
            const badge = getTypeBadge(backup)
            return (
              <Card
                key={backup.id}
                className={cn(
                  "dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-all border-l-4",
                  backup.is_locked 
                    ? "border-l-amber-500 shadow-sm bg-amber-50/30 dark:bg-amber-900/10" 
                    : "border-l-transparent"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {/* ── Inline editable title ── */}
                        <InlineTitle
                          backup={backup}
                          onSave={handleRename}
                          placeholder={t("actions.namePlaceholder")}
                        />
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0",
                            badge.className
                          )}
                        >
                          {t(badge.key)}
                        </span>
                        {backup.is_locked && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 gap-1 animate-in fade-in zoom-in duration-300">
                            <Lock className="w-3 h-3" />
                            {t("status.locked") || "Protected"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span>{formatDate(backup.created_at)}</span>
                        <span>{formatSize(backup.size)}</span>
                        {backup.name?.trim() && (
                          <span
                            className="text-xs truncate max-w-[160px] text-gray-400 dark:text-gray-500"
                            title={backup.filename}
                          >
                            {backup.filename}
                          </span>
                        )}
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
                        <span className="hidden sm:inline">{t("actions.download")}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setConfirmAction({
                            type: "restore",
                            backupId: backup.id,
                            backupName: displayName(backup),
                          })
                        }
                        className="gap-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span className="hidden sm:inline">{t("actions.restore")}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleLock(backup.id)}
                        className={cn(
                          "gap-1.5 transition-colors",
                          backup.is_locked 
                            ? "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20" 
                            : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        )}
                        title={backup.is_locked ? t("actions.unlock") : t("actions.lock")}
                      >
                        {backup.is_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setConfirmAction({
                            type: "delete",
                            backupId: backup.id,
                            backupName: displayName(backup),
                          })
                        }
                        disabled={backup.is_locked}
                        className={cn(
                          "gap-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20",
                          backup.is_locked && "opacity-40 cursor-not-allowed grayscale"
                        )}
                        title={backup.is_locked ? t("deleteLockedTooltip") || "Locked backups cannot be deleted" : ""}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">{t("actions.delete")}</span>
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
              {confirmAction.type === "restore" ? t("confirmRestore") : t("confirmDelete")}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-1">
              {confirmAction.type === "restore" ? t("restoreWarning") : t("deleteWarning")}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4 break-all">
              {confirmAction.backupName}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmAction(null)}>
                {tc("actions.cancel")}
              </Button>
              {confirmAction.type === "restore" ? (
                <Button
                  onClick={() => handleRestore(confirmAction.backupId)}
                  disabled={restoring === confirmAction.backupId}
                >
                  {restoring === confirmAction.backupId
                    ? t("actions.restoring")
                    : t("actions.restore")}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(confirmAction.backupId)}
                >
                  {t("confirmDelete")}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
