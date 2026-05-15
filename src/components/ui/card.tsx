import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-black/[0.08] shadow-sm', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: CardProps) {
  return (
    <div className={cn('px-5 py-4 border-b border-black/[0.06]', className)}>
      {children}
    </div>
  )
}

export function CardBody({ children, className }: CardProps) {
  return (
    <div className={cn('px-5 py-4', className)}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className }: CardProps) {
  return (
    <div className={cn('px-5 py-4 border-t border-black/[0.06]', className)}>
      {children}
    </div>
  )
}
