import { Menu, Bell, User, ChevronDown, Sun, Moon, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/useTheme'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

interface TopNavProps {
  onMenuToggle: () => void
  serverName?: string
  serverStatus?: string
}

export function TopNav({ onMenuToggle, serverName, serverStatus }: TopNavProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const displayName = user?.username || "User"
  const displayRole = user?.role === "admin" ? "Admin" : "User"

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

        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-300">
              {displayName}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-500 hidden md:block" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg py-1 z-50">
              <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                {displayRole}
              </div>
              <Link
                to="/settings"
                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                设置
              </Link>
              <hr className="my-1 border-gray-200 dark:border-gray-800" />
              <button
                onClick={handleLogout}
                className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
