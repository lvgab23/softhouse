'use client'

import { useState } from 'react'
import { Bell, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopbarProps {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

const periods = ['Hoje', 'Semana', 'Mês', 'Trimestre', 'Ano']

export function Topbar({ title, subtitle, children }: TopbarProps) {
  const [activePeriod, setActivePeriod] = useState('Mês')

  return (
    <header className="h-16 bg-white border-b border-black/[0.06] flex items-center justify-between px-6 gap-4 sticky top-0 z-30">
      <div className="min-w-0">
        <h1 className="text-base font-bold text-gray-900 truncate">{title}</h1>
        {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Period filter */}
        <div className="hidden md:flex items-center bg-slate-50 rounded-lg p-0.5 gap-0.5">
          {periods.map(p => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                activePeriod === p
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Action buttons slot */}
        {children}

        <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors relative">
          <Bell className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
