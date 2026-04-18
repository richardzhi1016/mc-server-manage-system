import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { DatabaseBackup, Loader2, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormToggle } from '@/components/ui/FormToggle'
import { Input } from '@/components/ui/Input'
import { useNotification } from '@/hooks/useNotification'
import * as api from '@/api/client'
import type { ScheduledTask, StartupSettings } from '@/types/api'

interface ScheduledBackupPanelProps {
  serverName: string
}

export function ScheduledBackupPanel({ serverName }: ScheduledBackupPanelProps) {
  const { t } = useTranslation('dashboard')
  const { notify } = useNotification()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [task, setTask] = useState<ScheduledTask | null>(null)
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'periodic' | 'startup'>('periodic')

  // Form state - Periodic
  const [enabled, setEnabled] = useState(false)
  const [intervalValue, setIntervalValue] = useState(2)
  const [intervalUnit, setIntervalUnit] = useState<'minutes' | 'hours'>('hours')
  const [isDirty, setIsDirty] = useState(false)

  // Form state - Startup
  const [startupSettings, setStartupSettings] = useState<StartupSettings | null>(null)
  const [backupOnStartup, setBackupOnStartup] = useState(false)
  const [isStartupDirty, setIsStartupDirty] = useState(false)

  const fetchTask = useCallback(async () => {
    if (!serverName) return

    try {
      setLoading(true)
      // Fetch periodic task
      const res = await api.listScheduledTasks(serverName)
      const backupTask = res.tasks.find(
        (t) => t.type === 'backup' && t.schedule.frequency === 'interval'
      )
      
      if (backupTask) {
        setTask(backupTask)
        setEnabled(backupTask.enabled)
        setIntervalValue(backupTask.schedule.interval_value || 2)
        setIntervalUnit(backupTask.schedule.interval_unit || 'hours')
      } else {
        setTask(null)
        setEnabled(false)
        setIntervalValue(2)
        setIntervalUnit('hours')
      }
      setIsDirty(false)

      // Fetch startup settings
      const settings = await api.getStartupSettings(serverName)
      setStartupSettings(settings)
      setBackupOnStartup(!!settings.backup_on_startup)
      setIsStartupDirty(false)

    } catch (error) {
      console.error('Failed to fetch backup settings:', error)
      notify({ type: 'error', message: t('scheduledBackup.loadError') })
    } finally {
      setLoading(false)
    }
  }, [serverName, t])

  useEffect(() => {
    fetchTask()
  }, [fetchTask])

  // Periodic Handle
  const handleToggle = (checked: boolean) => {
    setEnabled(checked)
    setIsDirty(true)
  }

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val) && val > 0) {
      setIntervalValue(val)
      setIsDirty(true)
    } else if (e.target.value === '') {
      setIntervalValue(0)
    }
  }

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIntervalUnit(e.target.value as 'minutes' | 'hours')
    setIsDirty(true)
  }

  // Startup Handle
  const handleStartupToggle = (checked: boolean) => {
    setBackupOnStartup(checked)
    setIsStartupDirty(true)
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      if (activeTab === 'periodic') {
        if (intervalValue <= 0) {
          notify({ type: 'error', message: t('scheduledBackup.saveError') })
          setSaving(false)
          return
        }
        
        if (task) {
          await api.updateScheduledTask(task.id, {
            enabled,
            schedule: {
              frequency: 'interval',
              interval_value: intervalValue,
              interval_unit: intervalUnit
            }
          })
        } else {
          await api.createScheduledTask({
            server_name: serverName,
            type: 'backup',
            schedule: {
              frequency: 'interval',
              interval_value: intervalValue,
              interval_unit: intervalUnit
            }
          })
        }
        setIsDirty(false)
      } else if (activeTab === 'startup') {
        const payload = {
          server_name: serverName,
          min_memory: startupSettings?.min_memory || 1024,
          max_memory: startupSettings?.max_memory || 4096,
          jvm_flags: startupSettings?.jvm_flags || [],
          backup_on_startup: backupOnStartup
        }
        await api.updateStartupSettings(payload)
        setIsStartupDirty(false)
      }

      notify({ type: 'success', message: t('scheduledBackup.saved') })
      await fetchTask()
    } catch (error: any) {
      console.error('Failed to save backup settings:', error)
      notify({ type: 'error', message: t('scheduledBackup.saveError') })
    } finally {
      setSaving(false)
    }
  }

  if (!serverName) return null

  const isCurrentDirty = activeTab === 'periodic' ? isDirty : isStartupDirty
  const isSaveDisabled = saving || (activeTab === 'periodic' && enabled && intervalValue <= 0)

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <DatabaseBackup className="w-4 h-4 text-blue-500" />
          {t('scheduledBackup.title')}
          {loading && <Loader2 className="w-3 h-3 animate-spin text-gray-400 ml-auto" />}
        </CardTitle>
      </CardHeader>
      
      <div className="flex border-b border-gray-100 dark:border-gray-800">
        <button
          className={`flex-1 py-2 text-sm text-center border-b-2 font-medium transition-colors ${
            activeTab === 'periodic'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('periodic')}
        >
          {t('scheduledBackup.tabPeriodic')}
        </button>
        <button
          className={`flex-1 py-2 text-sm text-center border-b-2 font-medium transition-colors ${
            activeTab === 'startup'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('startup')}
        >
          {t('scheduledBackup.tabStartup')}
        </button>
      </div>

      <CardContent className="pt-4 space-y-4">
        {!loading && (
          <>
            {activeTab === 'periodic' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <FormToggle
                  label={t('scheduledBackup.enablePeriodic')}
                  checked={enabled}
                  onChange={handleToggle}
                />

                {enabled && (
                  <div className="pt-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <span className="whitespace-nowrap">{t('scheduledBackup.every')}</span>
                      <Input 
                        type="number" 
                        min="1"
                        className="w-20 text-center h-8" 
                        value={intervalValue || ''} 
                        onChange={handleValueChange}
                      />
                      <select 
                        value={intervalUnit}
                        onChange={handleUnitChange}
                        className="h-8 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="hours">{t('scheduledBackup.hours')}</option>
                        <option value="minutes">{t('scheduledBackup.minutes')}</option>
                      </select>
                    </div>

                    {task?.next_run ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-md border border-gray-100 dark:border-gray-800">
                        {t('scheduledBackup.nextRun', { time: new Date(task.next_run).toLocaleString() })}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-md border border-gray-100 dark:border-gray-800">
                        {t('scheduledBackup.noNextRun')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'startup' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <FormToggle
                  label={t('scheduledBackup.enableStartup')}
                  checked={backupOnStartup}
                  onChange={handleStartupToggle}
                />
                
                <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-2 mt-4 rounded-md border border-gray-100 dark:border-gray-800">
                  {t('scheduledBackup.startupDesc')}
                </p>
              </div>
            )}

            {isCurrentDirty && (
              <Button 
                className="w-full mt-2" 
                size="sm" 
                onClick={handleSave} 
                disabled={isSaveDisabled}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {saving ? t('scheduledBackup.saving') : t('scheduledBackup.save')}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
