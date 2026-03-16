import { X } from 'lucide-react'
import { LayoutDashboard, Server, Users, Settings, Terminal, Folder, Database, Package, Puzzle } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { SidebarItem } from './SidebarItem'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { useServerStore } from '@/store/useServerStore'

interface MobileNavProps {
  open: boolean
  onClose: () => void
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  const { t } = useTranslation('common')
  const { serverName } = useParams()
  const servers = useServerStore((s) => s.servers)
  const currentServer = servers.find((s) => s.name === serverName)
  const serverType = currentServer?.server_type?.toLowerCase() || ""

  const basePath = serverName ? `/${encodeURIComponent(serverName)}/panel` : '/servers'

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          'fixed top-0 left-0 h-full w-72 bg-white dark:bg-mrinth-surface border-r border-gray-200 dark:border-mrinth-border',
          'transform transition-transform duration-300 ease-in-out z-50',
          'lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-200 dark:border-mrinth-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-mrinth-green/10">
              <Server className="w-4 h-4 text-mrinth-green" />
            </div>
            <span className="font-bold text-base text-gray-900 dark:text-mrinth-text">
              MC Panel
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close menu">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="px-2 py-4 space-y-1">
          <SidebarItem
            to={basePath}
            icon={<LayoutDashboard className="w-5 h-5" />}
            label={t('nav.dashboard')}
            onClick={onClose}
            end
          />
          <SidebarItem
            to="/servers"
            icon={<Server className="w-5 h-5" />}
            label={t('nav.backToLobby')}
            onClick={onClose}
          />
          <SidebarItem
            to={`${basePath}/console`}
            icon={<Terminal className="w-5 h-5" />}
            label={t('nav.console')}
            onClick={onClose}
          />
          <SidebarItem
            to={`${basePath}/players`}
            icon={<Users className="w-5 h-5" />}
            label={t('nav.players')}
            onClick={onClose}
          />
          <SidebarItem
            to={`${basePath}/files`}
            icon={<Folder className="w-5 h-5" />}
            label={t('nav.files')}
            onClick={onClose}
          />
          {(serverType === "fabric" || serverType === "forge") && (
            <SidebarItem
              to={`${basePath}/mods`}
              icon={<Package className="w-5 h-5" />}
              label={t('nav.mods')}
              onClick={onClose}
            />
          )}
          {serverType === "paper" && (
            <SidebarItem
              to={`${basePath}/plugins`}
              icon={<Puzzle className="w-5 h-5" />}
              label={t('nav.plugins')}
              onClick={onClose}
            />
          )}
          <SidebarItem
            to={`${basePath}/backups`}
            icon={<Database className="w-5 h-5" />}
            label={t('nav.backups')}
            onClick={onClose}
          />
          <SidebarItem
            to={`${basePath}/settings`}
            icon={<Settings className="w-5 h-5" />}
            label={t('nav.settings')}
            onClick={onClose}
          />
        </nav>

        <div className="absolute bottom-0 left-0 right-0 px-4 py-4 border-t border-gray-200 dark:border-mrinth-border">
          <div className="px-3 py-2 text-xs text-gray-400 dark:text-mrinth-muted">
            MC Server Management v1.0.0
          </div>
        </div>
      </div>
    </>
  )
}
