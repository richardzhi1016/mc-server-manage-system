import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      <header className="text-center py-12 px-4 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white mb-8" role="banner">
        <h1 className="m-0 mb-3 text-4xl font-bold drop-shadow-lg">Minecraft 服务器管理</h1>
        <p className="m-0 text-lg opacity-95 font-normal">上传和管理您的服务器</p>
      </header>

      <nav className="flex justify-center gap-4 mb-8 px-4" role="navigation" aria-label="主导航">
        <Link
          to="/upload"
          className={`inline-flex items-center gap-2 px-5 py-3 bg-white text-gray-700 no-underline rounded-lg font-medium text-sm transition-all duration-150 border-2 border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:-translate-y-0.5 hover:shadow-md hover:text-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
            location.pathname === '/upload' ? 'bg-indigo-500 text-white border-indigo-500 shadow-md' : ''
          }`}
          aria-current={location.pathname === '/upload' ? 'page' : undefined}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          上传服务器
        </Link>
        <Link
          to="/launch"
          className={`inline-flex items-center gap-2 px-5 py-3 bg-white text-gray-700 no-underline rounded-lg font-medium text-sm transition-all duration-150 border-2 border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:-translate-y-0.5 hover:shadow-md hover:text-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
            location.pathname === '/launch' ? 'bg-indigo-500 text-white border-indigo-500 shadow-md' : ''
          }`}
          aria-current={location.pathname === '/launch' ? 'page' : undefined}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 0 1 0 1.971l-11.54 6.347a1.125 1.125 0 0 1-1.667-.985V5.653Z" />
          </svg>
          启动服务器
        </Link>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto px-4 pb-8 w-full" role="main">
        {children}
      </main>
    </div>
  )
}

export default Layout