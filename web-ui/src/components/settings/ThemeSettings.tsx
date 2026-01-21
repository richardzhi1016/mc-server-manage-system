import { useTheme } from "@/context/useTheme"
import { saveTheme } from "@/api/client"
import { Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"

export function ThemeSettings() {
  const { theme, toggleTheme } = useTheme()

  const handleThemeChange = async (newTheme: "light" | "dark") => {
    try {
      await saveTheme({ theme: newTheme })
    } catch {
      console.error("Failed to save theme preference")
    }
    toggleTheme()
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Appearance
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Choose your preferred theme for the interface
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleThemeChange("light")}
            className={cn(
              "relative p-4 rounded-xl border-2 transition-all",
              "hover:border-gray-300 dark:hover:border-gray-600",
              theme === "light"
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                : "border-gray-200 dark:border-gray-700"
            )}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                <Sun className="w-6 h-6 text-amber-500" />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Light
              </span>
            </div>
            {theme === "light" && (
              <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-indigo-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange("dark")}
            className={cn(
              "relative p-4 rounded-xl border-2 transition-all",
              "hover:border-gray-300 dark:hover:border-gray-600",
              theme === "dark"
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                : "border-gray-200 dark:border-gray-700"
            )}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center">
                <Moon className="w-6 h-6 text-indigo-400" />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Dark
              </span>
            </div>
            {theme === "dark" && (
              <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-indigo-500" />
            )}
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          System Preference
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          If you don't select a theme, the interface will follow your system's color scheme preference.
        </p>
      </div>
    </div>
  )
}
