import { LayoutDashboard, Server, Play, Upload, Settings, Users, Terminal, Folder } from 'lucide-react'
import { SidebarItem } from './SidebarItem'
import { cn } from '@/lib/utils'

interface SidebarProps {
  collapsed?: boolean
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800',
        'transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className={cn('flex items-center gap-2 px-4 py-5 border-b border-gray-200 dark:border-gray-800', collapsed && 'justify-center px-2')}>
        <Server className="w-8 h-8 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
        {!collapsed && (
          <span className="font-bold text-lg text-gray-900 dark:text-white">
            MC Panel
          </span>
        )}
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        <SidebarItem
          to="/panel"
          icon={<LayoutDashboard className="w-5 h-5" />}
          label="仪表盘"
          collapsed={collapsed}
        />
        <SidebarItem
          to="/launch"
          icon={<Server className="w-5 h-5" />}
          label="服务器"
          collapsed={collapsed}
        />
        <SidebarItem
          to="/panel/launch"
          icon={<Play className="w-5 h-5" />}
          label="启动"
          collapsed={collapsed}
        />
        <SidebarItem
          to="/panel/upload"
          icon={<Upload className="w-5 h-5" />}
          label="上传"
          collapsed={collapsed}
        />
        <SidebarItem
          to="/console/myserver"
          icon={<Terminal className="w-5 h-5" />}
          label="控制台"
          collapsed={collapsed}
        />
        <SidebarItem
          to="/players"
          icon={<Users className="w-5 h-5" />}
          label="玩家"
          collapsed={collapsed}
        />
        <SidebarItem
          to="/files/myserver"
          icon={<Folder className="w-5 h-5" />}
          label="文件"
          collapsed={collapsed}
        />
        <SidebarItem
          to="/settings"
          icon={<Settings className="w-5 h-5" />}
          label="设置"
          collapsed={collapsed}
        />
      </nav>

      <div className={cn('px-2 py-4 border-t border-gray-200 dark:border-gray-800', collapsed && 'text-center')}>
        {!collapsed && (
          <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
            MC Server Management
            <br />
            v1.0.0
          </div>
        )}
      </div>
    </aside>
  )
}
