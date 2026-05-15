import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'gray'
  className?: string
}

export function Badge({ children, variant = 'gray', className }: BadgeProps) {
  const variants = {
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-600',
    info: 'bg-blue-100 text-blue-700',
    gray: 'bg-gray-100 text-gray-600',
  }

  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  )
}
