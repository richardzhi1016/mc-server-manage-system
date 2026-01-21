import { useState, useEffect } from "react"
import { useNotification } from "@/hooks/useNotification"
import { getServerProperties, updateServerProperties, getServers } from "@/api/client"
import { FormInput } from "@/components/ui/FormInput"
import { FormToggle } from "@/components/ui/FormToggle"
import { type Server, type ServerPropertySchema } from "@/types/api"

export function ServerProperties() {
  const [serverName, setServerName] = useState("")
  const [servers, setServers] = useState<Server[]>([])
  const [properties, setProperties] = useState<Record<string, string>>({})
  const [schema, setSchema] = useState<Record<string, ServerPropertySchema>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const { notify } = useNotification()

  useEffect(() => {
    loadServers()
  }, [])

  useEffect(() => {
    if (serverName) {
      loadProperties()
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

  const loadProperties = async () => {
    setLoading(true)
    try {
      const data = await getServerProperties(serverName)
      setProperties(data.properties || {})
      setSchema(data.schema || {})
    } catch {
      notify({ type: "error", message: "Failed to load server properties" })
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
      notify({ type: "success", message: "Server properties saved" })
      setHasChanges(false)
    } catch {
      notify({ type: "error", message: "Failed to save server properties" })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    loadProperties()
    notify({ type: "info", message: "Changes reset to last saved state" })
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
          {booleanFields.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Boolean Settings
              </h3>
              <div className="space-y-4">
                {booleanFields.map(([key, field]) => (
                  <div key={key}>
                    {renderPropertyInput(key, field)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectFields.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Game Mode & Settings
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
                Network & Limits
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
                Server Information
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
              Reset to Current
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="btn btn-primary"
            >
              {saving ? "Saving..." : "Save Server Properties"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
