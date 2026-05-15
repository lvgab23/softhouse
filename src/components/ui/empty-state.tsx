import { LucideIcon } from 'lucide-react'
import { Button } from './button'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="mb-4 p-4 bg-gray-50 rounded-2xl">
          <Icon className="h-8 w-8 text-gray-300" />
        </div>
      )}
      <p className="text-sm font-medium text-gray-600">{title}</p>
      {description && <p className="mt-1 text-xs text-gray-400 max-w-xs">{description}</p>}
      {action && (
        <Button className="mt-4" onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  )
}
