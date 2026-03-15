import { LayoutDashboard, Server, Settings, Users, Terminal, Folder, Database, ArrowLeftCircle, Package, Puzzle } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { SidebarItem } from './SidebarItem'
import { useServerStore } from '@/store/useServerStore'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

interface SidebarProps {
  collapsed?: boolean
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const { t } = useTranslation('common')
  const { serverName } = useParams()
  const servers = useServerStore((s) => s.servers)
  const currentServer = servers.find((s) => s.name === serverName)
  const serverType = currentServer?.server_type?.toLowerCase() || ""

  const basePath = serverName ? `/${encodeURIComponent(serverName)}/panel` : '/servers'

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
          to={basePath}
          icon={<LayoutDashboard className="w-5 h-5" />}
          label={t('nav.dashboard')}
          collapsed={collapsed}
          end
        />
        <SidebarItem
          to="/servers"
          icon={<ArrowLeftCircle className="w-5 h-5" />}
          label={t('nav.backToLobby')}
          collapsed={collapsed}
        />
        <SidebarItem
          to={`${basePath}/console`}
          icon={<Terminal className="w-5 h-5" />}
          label={t('nav.console')}
          collapsed={collapsed}
        />
        <SidebarItem
          to={`${basePath}/players`}
          icon={<Users className="w-5 h-5" />}
          label={t('nav.players')}
          collapsed={collapsed}
        />
        <SidebarItem
          to={`${basePath}/files`}
          icon={<Folder className="w-5 h-5" />}
          label={t('nav.files')}
          collapsed={collapsed}
        />
        {(serverType === "fabric" || serverType === "forge") && (
          <SidebarItem
            to={`${basePath}/mods`}
            icon={<Package className="w-5 h-5" />}
            label={t('nav.mods')}
            collapsed={collapsed}
          />
        )}
        {serverType === "paper" && (
          <SidebarItem
            to={`${basePath}/plugins`}
            icon={<Puzzle className="w-5 h-5" />}
            label={t('nav.plugins')}
            collapsed={collapsed}
          />
        )}
        <SidebarItem
          to={`${basePath}/backups`}
          icon={<Database className="w-5 h-5" />}
          label={t('nav.backups')}
          collapsed={collapsed}
        />
        <SidebarItem
          to={`${basePath}/settings`}
          icon={<Settings className="w-5 h-5" />}
          label={t('nav.settings')}
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
