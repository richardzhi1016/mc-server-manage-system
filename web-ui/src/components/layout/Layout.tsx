import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'
import { MobileNav } from './MobileNav'
import { cn } from '@/lib/utils'
import { useServerStore } from '@/store/useServerStore'
import { getServers } from '@/api/client'

export function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { servers, setServers } = useServerStore()

  useEffect(() => {
    if (servers.length === 0) {
      getServers().then((res) => setServers(res.servers)).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }

    checkDesktop()
    window.addEventListener('resize', checkDesktop)
    return () => window.removeEventListener('resize', checkDesktop)
  }, [])

  const handleMenuToggle = () => {
    if (isDesktop) {
      setSidebarCollapsed(!sidebarCollapsed)
    } else {
      setMobileMenuOpen(!mobileMenuOpen)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-mrinth-bg">
      <MobileNav open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div className={cn('hidden lg:flex flex-shrink-0 transition-[width] duration-300 ease-in-out', sidebarCollapsed ? 'w-16' : 'w-60')}>
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav onMenuToggle={handleMenuToggle} />

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
