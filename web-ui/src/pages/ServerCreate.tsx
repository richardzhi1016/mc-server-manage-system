import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormInput } from '@/components/ui/FormInput'
import { ArrowLeft, Server, Upload, Settings, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { API_BASE_URL } from '@/lib/api'

interface ServerConfig {
  name: string
  description: string
  version: string
  difficulty: string
  maxPlayers: number
  port: number
  motd: string
}

type CreationMethod = 'auto' | 'upload'
type CreationStep = 'method' | 'config' | 'upload' | 'confirm' | 'success'
type NotificationType = 'success' | 'error' | null

interface Notification {
  type: NotificationType
  message: string
}

export default function ServerCreate() {
  const navigate = useNavigate()
  const { t } = useTranslation('servers')
  const { t: tc } = useTranslation('common')
  const [currentStep, setCurrentStep] = useState<CreationStep>('method')
  const [creationMethod, setCreationMethod] = useState<CreationMethod | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [notification, setNotification] = useState<Notification>({ type: null, message: '' })

  const [config, setConfig] = useState<ServerConfig>({
    name: '',
    description: '',
    version: '1.21.1',
    difficulty: 'normal',
    maxPlayers: 20,
    port: 25565,
    motd: 'A Minecraft Server'
  })

  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const getPreviousStep = (currentStep: CreationStep): CreationStep => {
    switch (currentStep) {
      case 'config':
        return creationMethod === 'auto' ? 'method' : 'upload'
      case 'upload':
        return 'method'
      case 'confirm':
        return 'config'
      default:
        return currentStep
    }
  }

  const handlePreviousStep = () => {
    setCurrentStep(getPreviousStep(currentStep))
  }

  const showNotification = (type: NotificationType, message: string) => {
    setNotification({ type, message })
    if (type === 'success') {
      setTimeout(() => {
        setNotification({ type: null, message: '' })
      }, 5000)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      await processFile(file)
    }
  }

  const processFile = async (file: File) => {
    if (file.type !== 'application/x-7z-compressed' && !file.name.endsWith('.7z') && !file.name.endsWith('.7zip')) {
      showNotification('error', 'Please upload a .7z or .7zip file')
      return
    }

    setIsLoading(true)
    setNotification({ type: null, message: '' })

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_BASE_URL}/api/upload-package`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload server package')
      }

        await response.json()

      // Extract server name from filename (remove extension)
      const serverName = file.name.replace(/\.(7z|7zip)$/i, '')

      // Update config with server name
      setConfig(prev => ({ ...prev, name: serverName }))
      setUploadedFile(file)

      showNotification('success', t('toast.uploadSuccess'))

      // Auto-advance to config step
      setCurrentStep('config')

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload file'
      showNotification('error', message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      await processFile(files[0])
    }
  }

  const validateConfig = (): string | null => {
    if (!config.name.trim()) return 'Server name is required'
    if (config.name.length < 3) return 'Server name must be at least 3 characters'
    if (config.name.includes(' ')) return 'Server name cannot contain spaces'
    if (config.maxPlayers < 1 || config.maxPlayers > 100) return 'Max players must be between 1 and 100'
    if (config.port < 1024 || config.port > 65535) return 'Port must be between 1024 and 65535'
    return null
  }

  const handleCreateServer = async () => {
    const validationError = validateConfig()
    if (validationError) {
      showNotification('error', validationError)
      return
    }

    setIsLoading(true)
    setNotification({ type: null, message: '' })

    try {
      if (creationMethod === 'upload') {
        // Server package already uploaded, just update server properties
        const propertiesResponse = await fetch(`${API_BASE_URL}/api/settings/server-properties`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            server_name: config.name,
            properties: {
              'difficulty': config.difficulty,
              'max-players': config.maxPlayers,
              'server-port': config.port,
              'motd': config.motd,
            }
          }),
        })

        if (!propertiesResponse.ok) {
          const errorData = await propertiesResponse.json()
          throw new Error(errorData.error || 'Failed to configure server properties')
        }

      } else if (creationMethod === 'auto') {
        // Auto-create server
        const createResponse = await fetch(`${API_BASE_URL}/api/servers/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            server_name: config.name,
            version: config.version,
            difficulty: config.difficulty,
            max_players: config.maxPlayers,
            server_port: config.port,
            motd: config.motd,
          }),
        })

        if (!createResponse.ok) {
          const errorData = await createResponse.json()
          throw new Error(errorData.error || 'Failed to create server')
        }

        await createResponse.json()
      }

      showNotification('success', t('toast.createSuccess'))

      // Redirect to panel immediately
      navigate('/panel')

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create server'
      showNotification('error', message)
    } finally {
      setIsLoading(false)
    }
  }

  const getSteps = () => {
    const baseSteps = [
      { id: 'method', label: t('steps.select'), icon: Server },
    ]

    if (creationMethod === 'auto') {
      baseSteps.push(
        { id: 'config', label: t('steps.configure'), icon: Settings },
        { id: 'confirm', label: t('steps.confirm'), icon: CheckCircle }
      )
    } else if (creationMethod === 'upload') {
      baseSteps.push(
        { id: 'upload', label: t('steps.upload'), icon: Upload },
        { id: 'config', label: t('steps.configure'), icon: Settings },
        { id: 'confirm', label: t('steps.confirm'), icon: CheckCircle }
      )
    }

    return baseSteps
  }

  const steps = getSteps()

  const renderMethodStep = () => (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold font-heading text-gray-900 dark:text-white mb-2">{t('method.title')}</h2>
        <p className="text-gray-600 dark:text-gray-400 font-body">{t('method.desc')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Auto Create Option */}
        <Card
          className={cn(
            "cursor-pointer transition-all duration-200 hover:shadow-lg border-2",
            creationMethod === 'auto'
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
          )}
          onClick={() => setCreationMethod('auto')}
        >
          <CardContent className="p-6 text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-4">
              <Server className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('auto.name')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('auto.desc')}
            </p>
            <ul className="text-left text-sm text-gray-500 dark:text-gray-400 space-y-1">
              <li>• {t('auto.feature1')}</li>
              <li>• {t('auto.feature2')}</li>
              <li>• {t('auto.feature3')}</li>
            </ul>
          </CardContent>
        </Card>

        {/* Upload Option */}
        <Card
          className={cn(
            "cursor-pointer transition-all duration-200 hover:shadow-lg border-2",
            creationMethod === 'upload'
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
          )}
          onClick={() => setCreationMethod('upload')}
        >
          <CardContent className="p-6 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('upload.name')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('upload.desc')}
            </p>
            <ul className="text-left text-sm text-gray-500 dark:text-gray-400 space-y-1">
              <li>• {t('upload.feature1')}</li>
              <li>• {t('upload.feature2')}</li>
              <li>• {t('upload.feature3')}</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => setCurrentStep(creationMethod === 'auto' ? 'config' : 'upload')}
          disabled={!creationMethod}
          className="px-8"
        >
          {tc('actions.next')}
        </Button>
      </div>
    </div>
  )

  const renderConfigStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold font-heading text-gray-900 dark:text-white mb-2">{t('configure.title')}</h2>
        <p className="text-gray-600 dark:text-gray-400 font-body">
          {creationMethod === 'upload' ? t('configure.uploadDesc') : t('configure.desc')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormInput
          label={t('fields.name')}
          value={config.name}
          onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
          placeholder="my-awesome-server"
          error={config.name && config.name.includes(' ') ? '不能包含空格' : undefined}
        />

        <FormInput
          label={t('fields.description')}
          value={config.description}
          onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
          placeholder="my-awesome-server"
        />

        <FormInput
          label={t('fields.version')}
          value={config.version}
          onChange={(e) => setConfig(prev => ({ ...prev, version: e.target.value }))}
          placeholder="1.21.1"
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('fields.difficulty')}
          </label>
          <select
            value={config.difficulty}
            onChange={(e) => setConfig(prev => ({ ...prev, difficulty: e.target.value }))}
            className="w-full py-3 px-4 text-base font-inherit border-2 border-gray-300 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white cursor-pointer transition-all duration-150 appearance-none bg-no-repeat bg-right-3 bg-center bg-5 pr-10 hover:not(:disabled):border-blue-500 focus:outline-none focus:border-blue-500 focus:shadow-lg"
          >
            <option value="peaceful">{t('difficulties.peaceful')}</option>
            <option value="easy">{t('difficulties.easy')}</option>
            <option value="normal">{t('difficulties.normal')}</option>
            <option value="hard">{t('difficulties.hard')}</option>
          </select>
        </div>

        <FormInput
          label={t('fields.maxPlayers')}
          type="number"
          value={config.maxPlayers}
          onChange={(e) => setConfig(prev => ({ ...prev, maxPlayers: parseInt(e.target.value) || 20 }))}
          min="1"
          max="100"
        />

        <FormInput
          label={t('fields.port')}
          type="number"
          value={config.port}
          onChange={(e) => setConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 25565 }))}
          min="1024"
          max="65535"
        />
      </div>

      <FormInput
        label={t('fields.motd')}
        value={config.motd}
        onChange={(e) => setConfig(prev => ({ ...prev, motd: e.target.value }))}
        placeholder="A Minecraft Server"
      />

      <div className="flex justify-between">
        <Button variant="outline" onClick={handlePreviousStep}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {tc('actions.previous')}
        </Button>
        <Button
          onClick={() => setCurrentStep('confirm')}
          disabled={!config.name.trim()}
          className="px-8"
        >
          {tc('actions.next')}
        </Button>
      </div>
    </div>
  )

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold font-heading text-gray-900 dark:text-white mb-2">{t('uploadFile.title')}</h2>
        <p className="text-gray-600 dark:text-gray-400 font-body">{t('uploadFile.subtitle')}</p>
      </div>

      <Card
        className={cn(
          "border-2 border-dashed transition-colors",
          isDragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-gray-300 dark:border-gray-600 hover:border-blue-400"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="p-8">
          <div className="text-center">
            <Upload className={cn(
              "mx-auto h-12 w-12 mb-4 transition-colors",
              isDragOver ? "text-blue-500" : "text-gray-400"
            )} />
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {isDragOver
                  ? t('uploadFile.dropActive')
                  : uploadedFile
                    ? uploadedFile.name
                    : t('uploadFile.dropIdle')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {uploadedFile
                  ? `${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB`
                  : t('uploadFile.format')}
              </p>
            </div>
            <input
              type="file"
              accept=".7z,.7zip"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              disabled={isLoading}
            />
            <label
              htmlFor="file-upload"
              className={cn(
                "mt-4 inline-block px-6 py-3 rounded-md cursor-pointer transition-colors",
                isLoading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              )}
            >
              {isLoading ? tc('actions.uploading') : t('upload.name')}
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handlePreviousStep}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {tc('actions.previous')}
        </Button>
        <Button
          onClick={() => setCurrentStep('config')}
          disabled={!uploadedFile || isLoading}
          className="px-8"
        >
          {isLoading ? tc('actions.uploading') : tc('actions.next')}
        </Button>
      </div>
    </div>
  )

  const renderConfirmStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold font-heading text-gray-900 dark:text-white mb-2">{t('confirmCreate.title')}</h2>
        <p className="text-gray-600 dark:text-gray-400 font-body">{t('confirmCreate.subtitle')}</p>
      </div>

          <Card className="bg-gray-50 dark:bg-gray-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            {t('confirmCreate.info')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('confirmCreate.nameLabel')}</p>
              <p className="text-gray-900 dark:text-white">{config.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('confirmCreate.method')}</p>
              <p className="text-gray-900 dark:text-white">
                {creationMethod === 'auto' ? t('auto.name') : t('upload.name')}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('confirmCreate.version')}</p>
              <p className="text-gray-900 dark:text-white">{config.version}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('confirmCreate.difficulty')}</p>
              <p className="text-gray-900 dark:text-white">{config.difficulty}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('confirmCreate.maxPlayers')}</p>
              <p className="text-gray-900 dark:text-white">{config.maxPlayers}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('confirmCreate.port')}</p>
              <p className="text-gray-900 dark:text-white">{config.port}</p>
            </div>
            {creationMethod === 'upload' && (
              <div className="col-span-2">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('confirmCreate.uploadedFile')}</p>
                <p className="text-gray-900 dark:text-white">{uploadedFile?.name}</p>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('confirmCreate.motd')}</p>
            <p className="text-gray-900 dark:text-white">{config.motd}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handlePreviousStep}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {tc('actions.previous')}
        </Button>
        <Button
          onClick={handleCreateServer}
          disabled={isLoading}
          className="px-8"
        >
          {isLoading ? tc('actions.creating') : t('confirmCreate.confirm')}
        </Button>
      </div>
    </div>
  )

  const renderSuccessStep = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
      </div>
      <div>
        <h2 className="text-2xl font-bold font-heading text-gray-900 dark:text-white mb-2">{t('success.title')}</h2>
        <p className="text-gray-600 dark:text-gray-400 font-body mb-2">
          {t('success.desc', { name: config.name })}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          {t('success.meta', { method: creationMethod === 'auto' ? t('auto.name') : t('upload.name'), version: config.version })}
        </p>
        <p className="text-gray-600 dark:text-gray-400 font-body mt-4">
          {t('success.redirect')}
        </p>
      </div>
      <Button onClick={() => navigate('/panel')} className="px-8">
        {t('success.backToDashboard')}
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/panel')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('success.backToDashboard')}
          </Button>

          {/* Progress Steps */}
          <div className="flex items-center justify-center space-x-8 mb-8">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = step.id === currentStep
              const isCompleted = steps.findIndex(s => s.id === currentStep) > index

              return (
                <div key={step.id} className="flex items-center">
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                    isActive && "border-blue-500 bg-blue-50 dark:bg-blue-900/20",
                    isCompleted && "border-green-500 bg-green-50 dark:bg-green-900/20",
                    !isActive && !isCompleted && "border-gray-300 dark:border-gray-600"
                  )}>
                    <Icon className={cn(
                      "w-5 h-5",
                      isActive && "text-blue-500",
                      isCompleted && "text-green-500",
                      !isActive && !isCompleted && "text-gray-400 dark:text-gray-500"
                    )} />
                  </div>
                  <span className={cn(
                    "ml-2 text-sm font-medium",
                    isActive && "text-blue-600 dark:text-blue-400",
                    isCompleted && "text-green-600 dark:text-green-400",
                    !isActive && !isCompleted && "text-gray-500 dark:text-gray-400"
                  )}>
                    {step.label}
                  </span>
                  {index < steps.length - 1 && (
                    <div className={cn(
                      "w-16 h-0.5 mx-4",
                      isCompleted ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                    )} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <Card className="shadow-xl">
          <CardContent className="p-8">
            {currentStep === 'method' && renderMethodStep()}
            {currentStep === 'config' && renderConfigStep()}
            {currentStep === 'upload' && renderUploadStep()}
            {currentStep === 'confirm' && renderConfirmStep()}
            {currentStep === 'success' && renderSuccessStep()}

            {/* Notification */}
            {notification.type && (
              <div className={cn(
                "mt-6 p-4 rounded-md border flex items-center gap-3",
                notification.type === 'success'
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
                  : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
              )}>
                {notification.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                )}
                <span className="text-sm font-medium">{notification.message}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
