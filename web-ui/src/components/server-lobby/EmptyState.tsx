import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Server, Plus } from 'lucide-react'

interface EmptyStateProps {
  onCreateServer: () => void
}

export function EmptyState({ onCreateServer }: EmptyStateProps) {
  return (
    <Card className="border-2 border-dashed border-gray-300 dark:border-gray-700">
      <CardContent className="flex flex-col items-center justify-center p-12 text-center">
        <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
          <Server className="w-10 h-10 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          创建您的第一个服务器
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
          您还没有任何 Minecraft 服务器。点击下方按钮开始创建您的第一个服务器，
          您可以选择自动下载或上传现有的服务器文件。
        </p>
        <Button onClick={onCreateServer} size="lg" className="gap-2">
          <Plus className="w-5 h-5" />
          创建服务器
        </Button>
      </CardContent>
    </Card>
  )
}
