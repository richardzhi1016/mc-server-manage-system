import { LayoutDashboard, Server, Settings, Users, Terminal, Folder, Database, ArrowLeftCircle, Package, Puzzle, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { SidebarItem } from './SidebarItem'
import { useServerStore } from '@/store/useServerStore'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const { t } = useTranslation('common')
  const { serverName } = useParams()
  const servers = useServerStore((s) => s.servers)
  const currentServer = servers.find((s) => s.name === serverName)
  const serverType = currentServer?.server_type?.toLowerCase() || ""

  const basePath = serverName ? `/${encodeURIComponent(serverName)}/panel` : '/servers'

  return (
    <aside
      className={cn(
        'flex flex-col h-full',
        'bg-white dark:bg-mrinth-surface',
        'border-r border-gray-200 dark:border-mrinth-border',
        'transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Brand + toggle */}
      <div className={cn(
        'flex items-center h-14 px-3 border-b border-gray-200 dark:border-mrinth-border flex-shrink-0',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        <div className={cn('flex items-center gap-2.5', collapsed && 'hidden')}>
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-mrinth-green flex-shrink-0">
            <Server className="w-4 h-4 text-mrinth-bg" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-sm tracking-tight text-gray-900 dark:text-mrinth-text">
            MC Panel
          </span>
        </div>

        {collapsed && (
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-mrinth-green">
            <Server className="w-4 h-4 text-mrinth-bg" strokeWidth={2.5} />
          </div>
        )}

        {onToggle && (
          <button
            onClick={onToggle}
            className={cn(
              'p-1.5 rounded-md cursor-pointer transition-colors',
              'text-gray-400 dark:text-mrinth-muted',
              'hover:text-gray-700 dark:hover:text-mrinth-text',
              'hover:bg-gray-100 dark:hover:bg-mrinth-high',
              collapsed && 'mt-0'
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <PanelLeftOpen className="w-4 h-4" />
              : <PanelLeftClose className="w-4 h-4" />
            }
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        <SidebarItem
          to={basePath}
          icon={<LayoutDashboard className="w-4 h-4" />}
          label={t('nav.dashboard')}
          collapsed={collapsed}
          end
        />
        <SidebarItem
          to="/servers"
          icon={<ArrowLeftCircle className="w-4 h-4" />}
          label={t('nav.backToLobby')}
          collapsed={collapsed}
        />
        <SidebarItem
          to={`${basePath}/console`}
          icon={<Terminal className="w-4 h-4" />}
          label={t('nav.console')}
          collapsed={collapsed}
        />
        <SidebarItem
          to={`${basePath}/players`}
          icon={<Users className="w-4 h-4" />}
          label={t('nav.players')}
          collapsed={collapsed}
        />
        <SidebarItem
          to={`${basePath}/files`}
          icon={<Folder className="w-4 h-4" />}
          label={t('nav.files')}
          collapsed={collapsed}
        />
        {(serverType === "fabric" || serverType === "forge") && (
          <SidebarItem
            to={`${basePath}/mods`}
            icon={<Package className="w-4 h-4" />}
            label={t('nav.mods')}
            collapsed={collapsed}
          />
        )}
        {serverType === "paper" && (
          <SidebarItem
            to={`${basePath}/plugins`}
            icon={<Puzzle className="w-4 h-4" />}
            label={t('nav.plugins')}
            collapsed={collapsed}
          />
        )}
        <SidebarItem
          to={`${basePath}/backups`}
          icon={<Database className="w-4 h-4" />}
          label={t('nav.backups')}
          collapsed={collapsed}
        />
        <SidebarItem
          to={`${basePath}/settings`}
          icon={<Settings className="w-4 h-4" />}
          label={t('nav.settings')}
          collapsed={collapsed}
        />
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-mrinth-border flex-shrink-0">
          <p className="text-xs text-gray-400 dark:text-mrinth-muted">
            MC Server Manager · v1.0.0
          </p>
        </div>
      )}
    </aside>
  )
}
