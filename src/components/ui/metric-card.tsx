import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string
  subtitle?: string
  icon?: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  className?: string
}

export function MetricCard({ label, value, subtitle, icon: Icon, trend, trendValue, className }: MetricCardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-black/[0.08] p-5 shadow-sm', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 font-medium truncate">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 truncate">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-400 truncate">{subtitle}</p>}
          {trendValue && (
            <p className={cn('mt-1 text-xs font-medium',
              trend === 'up' && 'text-green-600',
              trend === 'down' && 'text-red-500',
              trend === 'neutral' && 'text-gray-500'
            )}>
              {trend === 'up' && '▲ '}{trend === 'down' && '▼ '}{trendValue}
            </p>
          )}
        </div>
        {Icon && (
          <div className="ml-3 p-2.5 bg-slate-50 rounded-lg flex-shrink-0">
            <Icon className="h-5 w-5 text-slate-500" />
          </div>
        )}
      </div>
    </div>
  )
}
