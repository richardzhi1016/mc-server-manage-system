import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { getModCategories, getPluginCategories } from "@/api/client"
import type { ModCategory } from "@/types/api"

interface MarketSidebarProps {
  type: "mod" | "plugin"
  selectedCategories: string[]
  onCategoriesChange: (cats: string[]) => void
}

export function MarketSidebar({ type, selectedCategories, onCategoriesChange }: MarketSidebarProps) {
  const { t } = useTranslation("mods")
  const [categories, setCategories] = useState<ModCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    const fetcher = type === "mod" ? getModCategories() : getPluginCategories()
    fetcher
      .then((data) => { setCategories(data); setError(false) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [type])

  const grouped = categories.reduce<Record<string, ModCategory[]>>((acc, cat) => {
    const header = cat.header || "Other"
    return { ...acc, [header]: [...(acc[header] ?? []), cat] }
  }, {})

  const toggleCategory = (name: string) => {
    if (selectedCategories.includes(name)) {
      onCategoriesChange(selectedCategories.filter((c) => c !== name))
    } else {
      onCategoriesChange([...selectedCategories, name])
    }
  }

  return (
    <div className="w-40 shrink-0">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t("market.categories")}
        </span>
        {selectedCategories.length > 0 && (
          <button
            onClick={() => onCategoriesChange([])}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            {t("market.clearFilters")}
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          ))}
        </div>
      ) : error ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{t("market.categoriesError")}</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([header, cats]) => (
            <div key={header}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {header}
              </p>
              <div className="space-y-1">
                {cats.map((cat) => (
                  <label key={cat.name} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.name)}
                      onChange={() => toggleCategory(cat.name)}
                      className="rounded border-zinc-300 text-blue-600"
                    />
                    <span className="text-sm capitalize text-zinc-600 dark:text-zinc-400">
                      {cat.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
