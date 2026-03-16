import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { currentLocale } from "@/i18n/locale"
import { useNotification } from "@/hooks/useNotification"
import {
  listScheduledTasks,
  createScheduledTask,
  deleteScheduledTask,
  updateScheduledTask,
} from "@/api/client"
import { type ScheduledTask, type ScheduledTaskSchedule } from "@/types/api"
import { FormInput } from "@/components/ui/FormInput"
import { FormToggle } from "@/components/ui/FormToggle"

const DEFAULT_SCHEDULE: ScheduledTaskSchedule = {
  frequency: "daily",
  hour: 3,
  minute: 0,
  days: ["mon"],
  interval_value: 30,
  interval_unit: "minutes",
}

export function ScheduledTasks() {
  const { t } = useTranslation("settings")
  const { serverName } = useParams<{ serverName: string }>()
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTask, setNewTask] = useState<{
    type: "restart" | "backup"
    schedule: ScheduledTaskSchedule
  }>({
    type: "restart",
    schedule: { ...DEFAULT_SCHEDULE },
  })
  const { notify } = useNotification()

  useEffect(() => {
    loadTasks()
  }, [serverName])

  const loadTasks = async () => {
    setLoading(true)
    try {
      const response = await listScheduledTasks(serverName)
      setTasks(response.tasks || [])
    } catch {
      notify({ type: "error", message: t("tasks.loadError") })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTask = async () => {
    if (!serverName) return
    setCreating(true)
    try {
      await createScheduledTask({ ...newTask, server_name: serverName })
      notify({ type: "success", message: t("tasks.createSuccess") })
      setShowCreateForm(false)
      setNewTask({ type: "restart", schedule: { ...DEFAULT_SCHEDULE } })
      loadTasks()
    } catch {
      notify({ type: "error", message: t("tasks.createError") })
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteScheduledTask(taskId)
      notify({ type: "success", message: t("tasks.deleteSuccess") })
      loadTasks()
    } catch {
      notify({ type: "error", message: t("tasks.deleteError") })
    }
  }

  const handleToggleTask = async (task: ScheduledTask) => {
    try {
      await updateScheduledTask(task.id, { enabled: !task.enabled })
      loadTasks()
    } catch {
      notify({ type: "error", message: t("tasks.updateError") })
    }
  }

  const formatDateTime = (isoString: string | undefined) => {
    if (!isoString) return t("tasks.nextUnknown")
    try {
      return new Date(isoString).toLocaleString(currentLocale())
    } catch {
      return t("tasks.nextUnknown")
    }
  }

  const formatScheduleDesc = (task: ScheduledTask) => {
    const s = task.schedule
    if (s.frequency === "interval") {
      if (s.interval_unit === "minutes") {
        return t("tasks.everyNMinutes", { value: s.interval_value })
      }
      return t("tasks.everyNHours", { value: s.interval_value })
    }
    if (s.frequency === "weekly") {
      const daysLabel = (s.days ?? [])
        .map((d) => t(`tasks.days.${d}`))
        .join(", ")
      return `${t("tasks.weekly_on", { days: daysLabel })} ${t("tasks.at")} ${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`
    }
    return `${t("tasks.daily")} ${t("tasks.at")} ${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`
  }

  const taskTypeLabels: Record<string, { label: string; icon: string }> = {
    restart: { label: t("tasks.typeRestart"), icon: "↻" },
    backup: { label: t("tasks.typeBackup"), icon: "💾" },
  }

  const updateSchedule = (patch: Partial<ScheduledTaskSchedule>) => {
    setNewTask((prev) => ({
      ...prev,
      schedule: { ...prev.schedule, ...patch },
    }))
  }

  const weekDays = [
    { value: "mon", label: t("tasks.days.mon") },
    { value: "tue", label: t("tasks.days.tue") },
    { value: "wed", label: t("tasks.days.wed") },
    { value: "thu", label: t("tasks.days.thu") },
    { value: "fri", label: t("tasks.days.fri") },
    { value: "sat", label: t("tasks.days.sat") },
    { value: "sun", label: t("tasks.days.sun") },
  ]

  const freq = newTask.schedule.frequency

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">
          {t("tasks.title")}
        </h2>
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="btn btn-primary"
        >
          {t("tasks.add")}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">{t("tasks.loading")}</div>
      ) : tasks.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">{t("tasks.noTasks")}</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {t("tasks.noTasksDesc")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-2xl">{taskTypeLabels[task.type]?.icon}</div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {taskTypeLabels[task.type]?.label}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatScheduleDesc(task)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {t("tasks.next", { time: formatDateTime(task.next_run) })}
                    </p>
                    {task.last_run && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {t("tasks.lastRun", { time: formatDateTime(task.last_run) })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <FormToggle
                    checked={task.enabled}
                    onChange={() => handleToggleTask(task)}
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                  >
                    {t("tasks.delete")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg mx-4 w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {t("tasks.createTask")}
            </h3>

            <div className="space-y-4">
              {/* Task type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t("tasks.taskType")}
                </label>
                <select
                  value={newTask.type}
                  onChange={(e) =>
                    setNewTask((prev) => ({
                      ...prev,
                      type: e.target.value as "restart" | "backup",
                    }))
                  }
                  className="form-select"
                >
                  <option value="restart">{t("tasks.typeRestart")}</option>
                  <option value="backup">{t("tasks.typeBackup")}</option>
                </select>
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t("tasks.frequency")}
                </label>
                <select
                  value={freq}
                  onChange={(e) =>
                    updateSchedule({
                      frequency: e.target.value as "daily" | "weekly" | "interval",
                    })
                  }
                  className="form-select"
                >
                  <option value="daily">{t("tasks.daily")}</option>
                  <option value="weekly">{t("tasks.weekly")}</option>
                  <option value="interval">{t("tasks.intervalFreq")}</option>
                </select>
              </div>

              {/* Interval inputs */}
              {freq === "interval" && (
                <div className="grid grid-cols-2 gap-4">
                  <FormInput
                    type="number"
                    label={t("tasks.intervalValue")}
                    value={newTask.schedule.interval_value ?? 30}
                    onChange={(e) =>
                      updateSchedule({ interval_value: parseInt(e.target.value) || 1 })
                    }
                    min={1}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t("tasks.intervalUnit")}
                    </label>
                    <select
                      value={newTask.schedule.interval_unit ?? "minutes"}
                      onChange={(e) =>
                        updateSchedule({
                          interval_unit: e.target.value as "minutes" | "hours",
                        })
                      }
                      className="form-select"
                    >
                      <option value="minutes">{t("tasks.intervalMinutes")}</option>
                      <option value="hours">{t("tasks.intervalHours")}</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Hour / Minute for daily and weekly */}
              {freq !== "interval" && (
                <div className="grid grid-cols-2 gap-4">
                  <FormInput
                    type="number"
                    label={t("tasks.hour")}
                    value={newTask.schedule.hour ?? 3}
                    onChange={(e) =>
                      updateSchedule({ hour: parseInt(e.target.value) || 0 })
                    }
                    min={0}
                    max={23}
                  />
                  <FormInput
                    type="number"
                    label={t("tasks.minute")}
                    value={newTask.schedule.minute ?? 0}
                    onChange={(e) =>
                      updateSchedule({ minute: parseInt(e.target.value) || 0 })
                    }
                    min={0}
                    max={59}
                  />
                </div>
              )}

              {/* Days of week for weekly */}
              {freq === "weekly" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t("tasks.daysOfWeek")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {weekDays.map((day) => {
                      const isSelected = (newTask.schedule.days ?? []).includes(day.value)
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            const days = isSelected
                              ? (newTask.schedule.days ?? []).filter((d) => d !== day.value)
                              : [...(newTask.schedule.days ?? []), day.value]
                            updateSchedule({ days })
                          }}
                          className={`px-3 py-1 text-sm rounded-full transition-colors ${
                            isSelected
                              ? "bg-indigo-600 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                          }`}
                        >
                          {day.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false)
                  setNewTask({ type: "restart", schedule: { ...DEFAULT_SCHEDULE } })
                }}
                className="btn btn-secondary"
              >
                {t("tasks.cancel")}
              </button>
              <button
                type="button"
                onClick={handleCreateTask}
                disabled={creating}
                className="btn btn-primary"
              >
                {creating ? t("tasks.creating") : t("tasks.createTask")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
