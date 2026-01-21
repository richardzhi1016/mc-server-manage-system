import { useState, useEffect } from "react"
import { useNotification } from "@/hooks/useNotification"
import { getStartupSettings, updateStartupSettings, getServers } from "@/api/client"
import { Slider } from "@/components/ui/Slider"
import { FormInput } from "@/components/ui/FormInput"
import { type StartupSettings as StartupSettingsType, type Server } from "@/types/api"

export function StartupParams() {
  const [serverName, setServerName] = useState("")
  const [servers, setServers] = useState<Server[]>([])
  const [settings, setSettings] = useState<StartupSettingsType>({
    min_memory: 1024,
    max_memory: 2048,
    jvm_flags: ["-nogui"],
  })
  const [newFlag, setNewFlag] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { notify } = useNotification()

  useEffect(() => {
    loadServers()
  }, [])

  useEffect(() => {
    if (serverName) {
      loadSettings()
    }
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

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await getStartupSettings(serverName)
      setSettings(data)
    } catch {
      notify({ type: "error", message: "Failed to load startup settings" })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateStartupSettings({
        server_name: serverName,
        min_memory: settings.min_memory,
        max_memory: settings.max_memory,
        jvm_flags: settings.jvm_flags,
      })
      notify({ type: "success", message: "Startup settings saved" })
    } catch {
      notify({ type: "error", message: "Failed to save settings" })
    } finally {
      setSaving(false)
    }
  }

  const addFlag = () => {
    if (newFlag.trim() && !settings.jvm_flags.includes(newFlag.trim())) {
      setSettings({
        ...settings,
        jvm_flags: [...settings.jvm_flags, newFlag.trim()],
      })
      setNewFlag("")
    }
  }

  const removeFlag = (flag: string) => {
    setSettings({
      ...settings,
      jvm_flags: settings.jvm_flags.filter((f) => f !== flag),
    })
  }

  const memoryOptions = [
    { value: 512, label: "512 MB" },
    { value: 1024, label: "1 GB" },
    { value: 2048, label: "2 GB" },
    { value: 4096, label: "4 GB" },
    { value: 8192, label: "8 GB" },
    { value: 16384, label: "16 GB" },
  ]

  return (
    <div className="space-y-6">
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
          {servers.map((server) => (
            <option key={server.name} value={server.name}>
              {server.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : (
        <>
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Memory Allocation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Slider
                  label="Minimum Memory"
                  min={256}
                  max={16384}
                  step={256}
                  value={settings.min_memory}
                  onChange={(e) =>
                    setSettings({ ...settings, min_memory: parseInt(e.target.value) })
                  }
                  unit=" MB"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {memoryOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSettings({ ...settings, min_memory: opt.value })}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        settings.min_memory === opt.value
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Slider
                  label="Maximum Memory"
                  min={512}
                  max={32768}
                  step={256}
                  value={settings.max_memory}
                  onChange={(e) =>
                    setSettings({ ...settings, max_memory: parseInt(e.target.value) })
                  }
                  unit=" MB"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {memoryOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSettings({ ...settings, max_memory: opt.value })}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        settings.max_memory === opt.value
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              JVM Flags
            </h3>
            <div className="space-y-4">
              <div className="flex gap-2">
                <FormInput
                  placeholder="Enter JVM flag (e.g., -XX:+UseG1GC)"
                  value={newFlag}
                  onChange={(e) => setNewFlag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFlag())}
                />
                <button
                  type="button"
                  onClick={addFlag}
                  className="btn btn-secondary whitespace-nowrap"
                >
                  Add Flag
                </button>
              </div>
              {settings.jvm_flags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {settings.jvm_flags.map((flag) => (
                    <span
                      key={flag}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                    >
                      {flag}
                      <button
                        type="button"
                        onClick={() => removeFlag(flag)}
                        className="hover:text-indigo-900 dark:hover:text-indigo-100"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? "Saving..." : "Save Startup Parameters"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
