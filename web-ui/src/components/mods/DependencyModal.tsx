import { AlertTriangle } from "lucide-react"
import type { ModDependency } from "@/types/api"

interface DependencyModalProps {
  modName: string
  missing: ModDependency[]
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

export function DependencyModal({ modName, missing, onConfirm, onCancel, loading }: DependencyModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Missing Dependencies</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {modName} requires the following mods:
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {missing.map((dep) => (
            <li
              key={dep.project_id}
              className="rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            >
              {dep.name}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Installing..." : "Install All"}
          </button>
        </div>
      </div>
    </div>
  )
}
