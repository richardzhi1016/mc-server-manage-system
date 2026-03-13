import { useState, useEffect } from "react"
import { X, Loader2, Download } from "lucide-react"
import { getModVersions } from "@/api/client"
import type { ModVersion } from "@/types/api"

interface ModDetailPanelProps {
  projectId: string
  title: string
  description: string
  iconUrl: string | null
  serverVersion: string
  serverLoader: string
  onInstall: (versionId: string) => void
  onClose: () => void
  installing: boolean
}

export function ModDetailPanel({
  projectId,
  title,
  description,
  iconUrl,
  serverVersion,
  serverLoader,
  onInstall,
  onClose,
  installing,
}: ModDetailPanelProps) {
  const [versions, setVersions] = useState<ModVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getModVersions(projectId, serverVersion, serverLoader)
      .then((data) => {
        if (!cancelled) {
          setVersions(data)
          if (data.length > 0) {
            setSelectedVersion(data[0].id)
          }
        }
      })
      .catch(() => {
        if (!cancelled) setVersions([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [projectId, serverVersion, serverLoader])

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {iconUrl ? (
            <img src={iconUrl} alt={title} className="h-12 w-12 rounded" />
          ) : (
            <div className="h-12 w-12 rounded bg-zinc-200 dark:bg-zinc-700" />
          )}
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={20} className="animate-spin text-zinc-400" />
          </div>
        ) : versions.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-500">
            No compatible versions found for {serverVersion} ({serverLoader})
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Version
              </label>
              <select
                value={selectedVersion || ""}
                onChange={(e) => setSelectedVersion(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.version_number} — {v.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => selectedVersion && onInstall(selectedVersion)}
              disabled={!selectedVersion || installing}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {installing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {installing ? "Installing..." : "Install"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
