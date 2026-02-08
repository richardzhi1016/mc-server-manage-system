import { useState } from "react"
import { Settings, Cpu, FileText, Clock, Palette } from "lucide-react"
import { StartupParams } from "@/components/settings/StartupParams"
import { ServerProperties } from "@/components/settings/ServerProperties"
import { ScheduledTasks } from "@/components/settings/ScheduledTasks"
import { ThemeSettings } from "@/components/settings/ThemeSettings"
import { cn } from "@/lib/utils"

type SettingsTab = "startup" | "properties" | "scheduler" | "theme"

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "startup", label: "Startup", icon: <Cpu className="w-5 h-5" /> },
  { id: "properties", label: "Server Properties", icon: <FileText className="w-5 h-5" /> },
  { id: "scheduler", label: "Scheduled Tasks", icon: <Clock className="w-5 h-5" /> },
  { id: "theme", label: "Theme", icon: <Palette className="w-5 h-5" /> },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("startup")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <nav className="lg:w-64 flex-shrink-0">
          <div className="card p-2 lg:sticky lg:top-4">
            <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors",
                    "whitespace-nowrap lg:whitespace-normal",
                    activeTab === tab.id
                      ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  {tab.icon}
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="flex-1 min-w-0">
          <div className="card p-6">
            {activeTab === "startup" && <StartupParams />}
            {activeTab === "properties" && <ServerProperties />}
            {activeTab === "scheduler" && <ScheduledTasks />}
            {activeTab === "theme" && <ThemeSettings />}
          </div>
        </div>
      </div>
    </div>
  )
}
