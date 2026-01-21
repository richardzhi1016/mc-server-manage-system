import { useState, useEffect } from "react"
import { useNotification } from "@/hooks/useNotification"
import {
  listBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  downloadBackup,
  getServers,
} from "@/api/client"
import { type BackupInfo, type Server } from "@/types/api"

export function BackupManagement() {
  const [serverName, setServerName] = useState("")
  const [servers, setServers] = useState<Server[]>([])
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const { notify } = useNotification()

  useEffect(() => {
    loadServers()
  }, [])

  useEffect(() => {
    loadBackups()
  }, [serverName])

  const loadServers = async () => {
    try {
      const response = await getServers()
      setServers(response.servers || [])
      if (response.servers?.length > 0 && !serverName) {
        setServerName(response.servers[0].name)
      }
    } catch {
      notify({ type: "error", message: "Failed to load servers" })
    }
  }

  const loadBackups = async () => {
    setLoading(true)
    try {
      const response = await listBackups(serverName || undefined)
      setBackups(response.backups || [])
    } catch {
      notify({ type: "error", message: "Failed to load backups" })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBackup = async () => {
    if (!serverName) return
    setCreating(true)
    try {
      await createBackup({ server_name: serverName })
      notify({ type: "success", message: "Backup created successfully" })
      loadBackups()
    } catch {
      notify({ type: "error", message: "Failed to create backup" })
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = async (backupId: string) => {
    setRestoring(backupId)
    try {
      await restoreBackup({ server_name: serverName, backup_id: backupId })
      notify({ type: "success", message: "Backup restored successfully" })
      setShowRestoreConfirm(null)
    } catch {
      notify({ type: "error", message: "Failed to restore backup" })
    } finally {
      setRestoring(null)
    }
  }

  const handleDelete = async (backupId: string) => {
    try {
      await deleteBackup(serverName, backupId)
      notify({ type: "success", message: "Backup deleted" })
      setShowDeleteConfirm(null)
      loadBackups()
    } catch {
      notify({ type: "error", message: "Failed to delete backup" })
    }
  }

  const handleDownload = (backup: BackupInfo) => {
    downloadBackup(backup.server_name, backup.id)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Server
          </label>
          <select
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            className="form-select"
            disabled={loading}
          >
            <option value="">All Servers</option>
            {servers.map((server) => (
              <option key={server.name} value={server.name}>
                {server.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleCreateBackup}
            disabled={creating || !serverName}
            className="btn btn-primary"
          >
            {creating ? "Creating..." : "Create Backup"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading backups...</div>
      ) : backups.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No backups available</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Click "Create Backup" to create your first backup
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Backup
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {backups.map((backup) => (
                <tr key={backup.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {backup.server_name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {backup.id}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(backup.created_at)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatSize(backup.size)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownload(backup)}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRestoreConfirm(backup.id)}
                        className="text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(backup.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showRestoreConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Confirm Restore
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              This will overwrite the current server state with the backup. The server will be stopped during restoration. Continue?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRestoreConfirm(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRestore(showRestoreConfirm)}
                disabled={restoring === showRestoreConfirm}
                className="btn btn-primary"
              >
                {restoring === showRestoreConfirm ? "Restoring..." : "Restore"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Confirm Delete
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Are you sure you want to delete this backup? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(showDeleteConfirm)}
                className="btn btn-error"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
