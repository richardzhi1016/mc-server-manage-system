import { Card, CardContent } from '@/components/ui/Card'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreateServerCardProps {
  onClick: () => void
  className?: string
}

export function CreateServerCard({ onClick, className }: CreateServerCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200',
        'border-2 border-dashed border-gray-300 dark:border-gray-600',
        'hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10',
        'flex flex-col items-center justify-center min-h-[200px]',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="flex flex-col items-center justify-center p-6 text-center">
        <div className={cn(
          'w-16 h-16 rounded-full flex items-center justify-center',
          'bg-blue-100 dark:bg-blue-900/30',
          'transition-colors duration-200',
          'group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50'
        )}>
          <Plus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="mt-4 font-semibold text-gray-900 dark:text-white">
          创建新服务器
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          点击添加新的 Minecraft 服务器
        </p>
      </CardContent>
    </Card>
  )
}
