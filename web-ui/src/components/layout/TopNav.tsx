import { Menu, Bell, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/useTheme'

interface TopNavProps {
  onMenuToggle: () => void
  serverName?: string
  serverStatus?: string
}

export function TopNav({ onMenuToggle, serverName, serverStatus }: TopNavProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header
      className={cn(
        'h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800',
        'flex items-center justify-between px-4 lg:px-6'
      )}
    >
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuToggle}
          className="lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </Button>

        {serverName && (
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">服务器:</span>
            <span className="font-medium text-gray-900 dark:text-white">{serverName}</span>
            {serverStatus && (
              <span
                className={cn(
                  'px-2 py-0.5 text-xs rounded-full font-medium',
                  serverStatus === 'running'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : serverStatus === 'stopped'
                    ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                )}
              >
                {serverStatus === 'running' ? '运行中' : serverStatus === 'stopped' ? '已停止' : serverStatus}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </Button>

        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </Button>
      </div>
    </header>
  )
}
