import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface ServerGridProps {
  children: ReactNode
  className?: string
}

export function ServerGrid({ children, className }: ServerGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
        className
      )}
    >
      {children}
    </div>
  )
}
