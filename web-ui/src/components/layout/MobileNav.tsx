import { X } from 'lucide-react'
import { LayoutDashboard, Server, Users, Settings, Terminal, Folder } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useServerStore } from '@/store/useServerStore'
import { SidebarItem } from './SidebarItem'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface MobileNavProps {
  open: boolean
  onClose: () => void
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  const { serverName } = useParams()
  const [searchParams] = useSearchParams()
  const { servers, selectedServerId } = useServerStore()

  const queryServerName = searchParams.get('server')
  const storeServer = servers.find(s => s.id === selectedServerId)

  // Determine the active server context
  const activeServerName = serverName || queryServerName || storeServer?.name || (servers.length > 0 ? servers[0].name : '')
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
          'fixed top-0 left-0 h-full w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800',
          'transform transition-transform duration-300 ease-in-out z-50',
          'lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Server className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            <span className="font-bold text-lg text-gray-900 dark:text-white">
              MC Panel
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close menu">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="px-2 py-4 space-y-1">
          <SidebarItem
            to={activeServerName ? `/panel?server=${activeServerName}` : '/panel'}
            icon={<LayoutDashboard className="w-5 h-5" />}
            label="仪表盘"
            onClick={onClose}
          />
          <SidebarItem
            to="/servers"
            icon={<Server className="w-5 h-5" />}
            label="服务器"
            onClick={onClose}
          />
          <SidebarItem
            to={`/panel/console/${activeServerName}`}
            icon={<Terminal className="w-5 h-5" />}
            label="控制台"
            onClick={onClose}
          />
          <SidebarItem
            to="/panel/players"
            icon={<Users className="w-5 h-5" />}
            label="玩家"
            onClick={onClose}
          />
          <SidebarItem
            to={`/panel/files/${activeServerName}`}
            icon={<Folder className="w-5 h-5" />}
            label="文件"
            onClick={onClose}
          />
          <SidebarItem
            to="/panel/settings"
            icon={<Settings className="w-5 h-5" />}
            label="设置"
            onClick={onClose}
          />
        </nav>

        <div className="absolute bottom-0 left-0 right-0 px-4 py-4 border-t border-gray-200 dark:border-gray-800">
          <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
            MC Server Management v1.0.0
          </div>
        </div>
      </div>
    </>
  )
}
