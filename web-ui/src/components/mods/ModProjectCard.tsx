import { Check, Download } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ModSearchResult } from "@/types/api"

interface ModProjectCardProps {
  mod: ModSearchResult
  viewMode: "grid" | "list"
  isInstalled: boolean
  onSelect: (mod: ModSearchResult) => void
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatRelativeTime(dateStr: string, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const diffMs = new Date(dateStr).getTime() - Date.now()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (Math.abs(diffDays) < 1) return rtf.format(0, "day")
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, "day")
  if (Math.abs(diffDays) < 30) return rtf.format(Math.round(diffDays / 7), "week")
  if (Math.abs(diffDays) < 365) return rtf.format(Math.round(diffDays / 30), "month")
  return rtf.format(Math.round(diffDays / 365), "year")
}

export function ModProjectCard({ mod, viewMode, isInstalled, onSelect }: ModProjectCardProps) {
  const { t, i18n } = useTranslation("mods")
  const visibleCategories = mod.categories.slice(0, 3)

  if (viewMode === "list") {
    return (
      <div
        className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
        onClick={() => onSelect(mod)}
      >
        {mod.icon_url ? (
          <img src={mod.icon_url} alt={mod.title} className="h-12 w-12 shrink-0 rounded" loading="lazy" />
        ) : (
          <div className="h-12 w-12 shrink-0 rounded bg-zinc-200 dark:bg-zinc-700" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{mod.title}</span>
            {isInstalled && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <Check size={10} />
                {t("market.installedBadge")}
              </span>
            )}
          </div>
          <p className="line-clamp-1 text-sm text-zinc-500 dark:text-zinc-400">{mod.description}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {visibleCategories.map((cat) => (
              <span key={cat} className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 capitalize dark:bg-zinc-700 dark:text-zinc-400">
                {cat}
              </span>
            ))}
          </div>
        </div>

        <div className="shrink-0 text-right text-xs text-zinc-400 dark:text-zinc-500">
          <div className="flex items-center gap-1 justify-end">
            <Download size={11} />
            {formatDownloads(mod.downloads)}
          </div>
          <div className="mt-0.5">{formatRelativeTime(mod.date_modified, i18n.language)}</div>
        </div>
      </div>
    )
  }

  // Grid view
  return (
    <div
      className="flex cursor-pointer flex-col rounded-lg border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
      onClick={() => onSelect(mod)}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        {mod.icon_url ? (
          <img src={mod.icon_url} alt={mod.title} className="h-14 w-14 shrink-0 rounded" loading="lazy" />
        ) : (
          <div className="h-14 w-14 shrink-0 rounded bg-zinc-200 dark:bg-zinc-700" />
        )}
        {isInstalled && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <Check size={10} />
            {t("market.installedBadge")}
          </span>
        )}
      </div>

      <p className="line-clamp-2 font-medium text-zinc-900 dark:text-zinc-100">{mod.title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{mod.description}</p>

      <div className="mt-2 flex flex-wrap gap-1">
        {visibleCategories.map((cat) => (
          <span key={cat} className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 capitalize dark:bg-zinc-700 dark:text-zinc-400">
            {cat}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-2 flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
        <span className="flex items-center gap-1">
          <Download size={11} />
          {formatDownloads(mod.downloads)}
        </span>
        <span>·</span>
        <span>{formatRelativeTime(mod.date_modified, i18n.language)}</span>
      </div>
    </div>
  )
}
