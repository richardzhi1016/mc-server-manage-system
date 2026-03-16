import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface SidebarItemProps {
  to: string
  icon: React.ReactNode
  label: string
  collapsed?: boolean
  onClick?: () => void
  end?: boolean
}

export function SidebarItem({ to, icon, label, collapsed, onClick, end }: SidebarItemProps) {
  const location = useLocation()
  const isActive = end
    ? location.pathname === to
    : location.pathname === to || (to !== '/' && location.pathname.startsWith(to))

  return (
    <Link
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 cursor-pointer',
        isActive
          ? 'bg-mrinth-green/10 text-mrinth-green font-medium dark:bg-mrinth-green/10 dark:text-mrinth-green'
          : 'text-gray-500 dark:text-mrinth-muted hover:bg-gray-100 dark:hover:bg-mrinth-high hover:text-gray-900 dark:hover:text-mrinth-text',
        collapsed && 'justify-center px-2'
      )}
    >
      <span className="flex-shrink-0 w-4.5 h-4.5">{icon}</span>
      {!collapsed && <span>{label}</span>}
    </Link>
  )
}
