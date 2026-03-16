import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useNotification } from "@/hooks/useNotification"
import { getServerProperties, updateServerProperties } from "@/api/client"
import { FormInput } from "@/components/ui/FormInput"
import { FormToggle } from "@/components/ui/FormToggle"
import { type ServerPropertySchema } from "@/types/api"

export function ServerProperties({ serverName }: { serverName: string }) {
  const { t } = useTranslation("settings")
  const [properties, setProperties] = useState<Record<string, string>>({})
  const [schema, setSchema] = useState<Record<string, ServerPropertySchema>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const { notify } = useNotification()

  useEffect(() => {
    if (serverName) {
      loadProperties()
    }
  }, [serverName])

  const loadProperties = async () => {
    setLoading(true)
    try {
      const data = await getServerProperties(serverName)
      setProperties(data.properties || {})
      setSchema(data.schema || {})
    } catch {
      notify({ type: "error", message: t("properties.loadError") })
    } finally {
      setLoading(false)
      setHasChanges(false)
    }
  }

  const handlePropertyChange = (key: string, value: string | number | boolean) => {
    setProperties((prev) => ({
      ...prev,
      [key]: String(value),
    }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateServerProperties({
        server_name: serverName,
        properties,
      })
      notify({ type: "success", message: t("properties.saveSuccess") })
      setHasChanges(false)
    } catch {
      notify({ type: "error", message: t("properties.saveError") })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    loadProperties()
    notify({ type: "info", message: t("properties.resetInfo") })
  }

  const renderPropertyInput = (key: string, field: ServerPropertySchema) => {
    const value = properties[key] !== undefined ? properties[key] : String(field.default)

    switch (field.type) {
      case "boolean":
        return (
          <FormToggle
            checked={value === "true"}
            onChange={(checked) => handlePropertyChange(key, checked)}
          />
        )
      case "select":
        return (
          <select
            value={value}
            onChange={(e) => handlePropertyChange(key, e.target.value)}
            className="form-select"
          >
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )
      case "number":
        return (
          <FormInput
            type="number"
            value={value}
            onChange={(e) => handlePropertyChange(key, e.target.value)}
          />
        )
      default:
        return (
          <FormInput
            type="text"
            value={value}
            onChange={(e) => handlePropertyChange(key, e.target.value)}
          />
        )
    }
  }

  const booleanFields = Object.entries(schema).filter(([, field]) => field.type === "boolean")
  const textFields = Object.entries(schema).filter(([, field]) => field.type === "text")
  const numberFields = Object.entries(schema).filter(([, field]) => field.type === "number")
  const selectFields = Object.entries(schema).filter(([, field]) => field.type === "select")

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="text-center py-8 text-gray-500">{t("properties.loading")}</div>
      ) : (
        <>
          {booleanFields.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {t("properties.booleanSettings")}
              </h3>
              <div className="space-y-4">
                {booleanFields.map(([key, field]) => (
                  <div key={key} className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {field.label}
                    </label>
                    {renderPropertyInput(key, field)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectFields.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {t("properties.gameModeSettings")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectFields.map(([key, field]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {field.label}
                    </label>
                    {renderPropertyInput(key, field)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {numberFields.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {t("properties.networkLimits")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {numberFields.map(([key, field]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {field.label}
                    </label>
                    {renderPropertyInput(key, field)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {textFields.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {t("properties.serverInfo")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {textFields.map(([key, field]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {field.label}
                    </label>
                    {renderPropertyInput(key, field)}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={!hasChanges || saving}
              className="btn btn-secondary"
            >
              {t("properties.resetToCurrent")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="btn btn-primary"
            >
              {saving ? t("properties.saving") : t("properties.save")}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
