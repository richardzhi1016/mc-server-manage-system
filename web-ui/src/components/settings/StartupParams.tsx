import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useNotification } from "@/hooks/useNotification"
import { getStartupSettings, updateStartupSettings } from "@/api/client"
import { Slider } from "@/components/ui/Slider"
import { FormInput } from "@/components/ui/FormInput"
import { type StartupSettings as StartupSettingsType } from "@/types/api"

export function StartupParams({ serverName }: { serverName: string }) {
  const { t } = useTranslation("settings")
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
    if (serverName) {
      loadSettings()
    }
  }, [serverName])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await getStartupSettings(serverName)
      setSettings(data)
    } catch {
      notify({ type: "error", message: t("startup.loadError") })
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
        backup_on_startup: settings.backup_on_startup,
      })
      notify({ type: "success", message: t("startup.saveSuccess") })
    } catch {
      notify({ type: "error", message: t("startup.saveError") })
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
      {loading ? (
        <div className="text-center py-8 text-gray-500">{t("startup.loading")}</div>
      ) : (
        <>
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {t("startup.memoryAllocation")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Slider
                  label={t("startup.minMemory")}
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
                  label={t("startup.maxMemory")}
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
              {t("startup.jvmFlags")}
            </h3>
            <div className="space-y-4">
              <div className="flex gap-2">
                <FormInput
                  placeholder={t("startup.jvmPlaceholder")}
                  value={newFlag}
                  onChange={(e) => setNewFlag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFlag())}
                />
                <button
                  type="button"
                  onClick={addFlag}
                  className="btn btn-secondary whitespace-nowrap"
                >
                  {t("startup.addFlag")}
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
              {saving ? t("startup.saving") : t("startup.save")}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
