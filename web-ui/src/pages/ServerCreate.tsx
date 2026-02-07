import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

      showNotification('success', '服务器包上传成功')

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
        showNotification('success', '服务器创建成功')
      }

      showNotification('success', '服务器创建成功！')

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
      { id: 'method', label: '选择', icon: Server },
    ]

    if (creationMethod === 'auto') {
      baseSteps.push(
        { id: 'config', label: '配置', icon: Settings },
        { id: 'confirm', label: '确认', icon: CheckCircle }
      )
    } else if (creationMethod === 'upload') {
      baseSteps.push(
        { id: 'upload', label: '上传', icon: Upload },
        { id: 'config', label: '配置', icon: Settings },
        { id: 'confirm', label: '确认', icon: CheckCircle }
      )
    }

    return baseSteps
  }

  const steps = getSteps()

  const renderMethodStep = () => (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold font-heading text-gray-900 dark:text-white mb-2">选择创建方式</h2>
        <p className="text-gray-600 dark:text-gray-400 font-body">请选择您想要的服务器创建方式</p>
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">自动创建</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              系统将自动下载 Minecraft 服务器文件并创建基础配置
            </p>
            <ul className="text-left text-sm text-gray-500 dark:text-gray-400 space-y-1">
              <li>• 自动下载指定版本的服务器</li>
              <li>• 生成默认配置文件</li>
              <li>• 一键完成设置</li>
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">上传文件</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              上传您已有的 Minecraft 服务器压缩包
            </p>
            <ul className="text-left text-sm text-gray-500 dark:text-gray-400 space-y-1">
              <li>• 支持 .7z 和 .7zip 格式</li>
              <li>• 保留现有配置和世界</li>
              <li>• 完整迁移现有服务器</li>
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
          {creationMethod === 'auto' ? '下一步' : '上传文件'}
        </Button>
      </div>
    </div>
  )

  const renderConfigStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold font-heading text-gray-900 dark:text-white mb-2">服务器配置</h2>
        <p className="text-gray-600 dark:text-gray-400 font-body">
          设置您的新 Minecraft 服务器的基本信息
          {creationMethod === 'upload' && (
            <span className="block text-sm mt-1 text-blue-600 dark:text-blue-400">
              您已经上传了服务器文件，现在请配置服务器参数
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormInput
          label="服务器名称"
          value={config.name}
          onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
          placeholder="my-awesome-server"
          error={config.name && config.name.includes(' ') ? '不能包含空格' : undefined}
        />

        <FormInput
          label="服务器描述"
          value={config.description}
          onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
          placeholder="我的 Minecraft 服务器"
        />

        <FormInput
          label="Minecraft 版本"
          value={config.version}
          onChange={(e) => setConfig(prev => ({ ...prev, version: e.target.value }))}
          placeholder="1.21.1"
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            难度
          </label>
          <select
            value={config.difficulty}
            onChange={(e) => setConfig(prev => ({ ...prev, difficulty: e.target.value }))}
            className="w-full py-3 px-4 text-base font-inherit border-2 border-gray-300 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white cursor-pointer transition-all duration-150 appearance-none bg-no-repeat bg-right-3 bg-center bg-5 pr-10 hover:not(:disabled):border-blue-500 focus:outline-none focus:border-blue-500 focus:shadow-lg"
          >
            <option value="peaceful">和平</option>
            <option value="easy">简单</option>
            <option value="normal">普通</option>
            <option value="hard">困难</option>
          </select>
        </div>

        <FormInput
          label="最大玩家数"
          type="number"
          value={config.maxPlayers}
          onChange={(e) => setConfig(prev => ({ ...prev, maxPlayers: parseInt(e.target.value) || 20 }))}
          min="1"
          max="100"
        />

        <FormInput
          label="服务器端口"
          type="number"
          value={config.port}
          onChange={(e) => setConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 25565 }))}
          min="1024"
          max="65535"
        />
      </div>

      <FormInput
        label="服务器消息 (MOTD)"
        value={config.motd}
        onChange={(e) => setConfig(prev => ({ ...prev, motd: e.target.value }))}
        placeholder="欢迎来到我的 Minecraft 服务器！"
      />

      <div className="flex justify-between">
        <Button variant="outline" onClick={handlePreviousStep}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          上一步
        </Button>
        <Button
          onClick={() => setCurrentStep('confirm')}
          disabled={!config.name.trim()}
          className="px-8"
        >
          下一步
        </Button>
      </div>
    </div>
  )

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold font-heading text-gray-900 dark:text-white mb-2">上传服务器文件</h2>
        <p className="text-gray-600 dark:text-gray-400 font-body">上传您的 Minecraft 服务器包 (.7z 或 .7zip 格式)</p>
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
                  ? '释放文件以上传'
                  : uploadedFile
                    ? uploadedFile.name
                    : '拖拽文件到此处或点击选择'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {uploadedFile
                  ? `${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB`
                  : '支持 .7z 和 .7zip 格式'}
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
              {isLoading ? '上传中...' : '选择文件'}
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handlePreviousStep}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          上一步
        </Button>
        <Button
          onClick={() => setCurrentStep('config')}
          disabled={!uploadedFile || isLoading}
          className="px-8"
        >
          {isLoading ? '上传中...' : '下一步'}
        </Button>
      </div>
    </div>
  )

  const renderConfirmStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold font-heading text-gray-900 dark:text-white mb-2">确认创建</h2>
        <p className="text-gray-600 dark:text-gray-400 font-body">请确认以下服务器配置</p>
      </div>

          <Card className="bg-gray-50 dark:bg-gray-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            服务器信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">名称</p>
              <p className="text-gray-900 dark:text-white">{config.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">创建方式</p>
              <p className="text-gray-900 dark:text-white">
                {creationMethod === 'auto' ? '自动创建' : '上传文件'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">版本</p>
              <p className="text-gray-900 dark:text-white">{config.version}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">难度</p>
              <p className="text-gray-900 dark:text-white">{config.difficulty}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">最大玩家数</p>
              <p className="text-gray-900 dark:text-white">{config.maxPlayers}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">端口</p>
              <p className="text-gray-900 dark:text-white">{config.port}</p>
            </div>
            {creationMethod === 'upload' && (
              <div className="col-span-2">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">上传文件</p>
                <p className="text-gray-900 dark:text-white">{uploadedFile?.name}</p>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">服务器消息 (MOTD)</p>
            <p className="text-gray-900 dark:text-white">{config.motd}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handlePreviousStep}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          上一步
        </Button>
        <Button
          onClick={handleCreateServer}
          disabled={isLoading}
          className="px-8"
        >
          {isLoading ? '创建中...' : '创建服务器'}
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
        <h2 className="text-2xl font-bold font-heading text-gray-900 dark:text-white mb-2">服务器创建成功！</h2>
        <p className="text-gray-600 dark:text-gray-400 font-body mb-2">
          您的服务器 "{config.name}" 已成功创建
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          创建方式：{creationMethod === 'auto' ? '自动创建' : '文件上传'} · 版本：{config.version}
        </p>
        <p className="text-gray-600 dark:text-gray-400 font-body mt-4">
          即将跳转到管理面板...
        </p>
      </div>
      <Button onClick={() => navigate('/panel')} className="px-8">
        返回仪表盘
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
            返回仪表盘
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