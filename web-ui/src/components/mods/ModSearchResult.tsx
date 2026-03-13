import { Download, Check, Loader2 } from "lucide-react"
import type { ModSearchResult as ModSearchResultType } from "@/types/api"

interface ModSearchResultProps {
  mod: ModSearchResultType
  isInstalled: boolean
  isInstalling: boolean
  onSelect: (projectId: string) => void
}

export function ModSearchResult({ mod, isInstalled, isInstalling, onSelect }: ModSearchResultProps) {
  const downloads = mod.downloads > 1_000_000
    ? `${(mod.downloads / 1_000_000).toFixed(1)}M`
    : mod.downloads > 1_000
    ? `${(mod.downloads / 1_000).toFixed(1)}K`
    : `${mod.downloads}`

  return (
    <div
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
      onClick={() => !isInstalled && !isInstalling && onSelect(mod.project_id)}
    >
      {mod.icon_url ? (
        <img
          src={mod.icon_url}
          alt={mod.title}
          className="h-10 w-10 shrink-0 rounded"
          loading="lazy"
        />
      ) : (
        <div className="h-10 w-10 shrink-0 rounded bg-zinc-200 dark:bg-zinc-700" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
            {mod.title}
          </span>
          {isInstalled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <Check size={12} />
              Installed
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
          {mod.description}
        </p>
        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
          <span className="flex items-center gap-1">
            <Download size={12} />
            {downloads}
          </span>
        </div>
      </div>

      {!isInstalled && (
        <button
          disabled={isInstalling}
          className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(mod.project_id)
          }}
        >
          {isInstalling ? <Loader2 size={16} className="animate-spin" /> : "Install"}
        </button>
      )}
    </div>
  )
}
