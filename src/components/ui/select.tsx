'use client'

import { forwardRef, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            'h-9 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 focus:border-[#0f172a] disabled:bg-gray-50 transition-colors appearance-none cursor-pointer',
            error && 'border-red-400 focus:ring-red-200',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'

export { Select }
