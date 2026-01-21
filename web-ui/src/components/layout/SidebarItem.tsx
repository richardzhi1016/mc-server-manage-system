import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface SidebarItemProps {
  to: string
  icon: React.ReactNode
  label: string
  collapsed?: boolean
  onClick?: () => void
}

export function SidebarItem({ to, icon, label, collapsed, onClick }: SidebarItemProps) {
  const location = useLocation()
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))

  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
        'hover:bg-gray-100 dark:hover:bg-gray-800',
        isActive
          ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 font-medium'
          : 'text-gray-600 dark:text-gray-400',
        collapsed && 'justify-center'
      )}
      title={collapsed ? label : undefined}
    >
      <span className="flex-shrink-0 w-5 h-5">{icon}</span>
      {!collapsed && <span>{label}</span>}
    </Link>
  )
}
