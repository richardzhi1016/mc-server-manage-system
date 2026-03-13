import { Trash2, Power, PowerOff } from "lucide-react"
import type { InstalledMod } from "@/types/api"

interface ModCardProps {
  mod: InstalledMod
  onToggle: (filename: string) => void
  onDelete: (filename: string) => void
}

export function ModCard({ mod, onToggle, onDelete }: ModCardProps) {
  const sizeKB = Math.round(mod.file_size / 1024)
  const sizeLabel = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
      mod.enabled
        ? "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
        : "border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-700 dark:bg-zinc-800/50"
    }`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
            {mod.name}
          </span>
          {mod.version && (
            <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
              v{mod.version}
            </span>
          )}
        </div>
        {mod.description && (
          <p className="mt-0.5 line-clamp-1 text-sm text-zinc-500 dark:text-zinc-400">
            {mod.description}
          </p>
        )}
        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
          <span>{sizeLabel}</span>
          {mod.authors.length > 0 && <span>{mod.authors.join(", ")}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => onToggle(mod.filename)}
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          title={mod.enabled ? "Disable" : "Enable"}
        >
          {mod.enabled ? <Power size={16} /> : <PowerOff size={16} />}
        </button>
        <button
          onClick={() => onDelete(mod.filename)}
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}
