'use client'

import { useEffect, useState } from 'react'
import { Search, Bell, ChevronRight } from 'lucide-react'

interface TopbarProps {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

export function Topbar({ title, subtitle, children }: TopbarProps) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const dateStr = now.toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 gap-4 sticky top-0 z-30">
      {/* Left: breadcrumb + title + subtitle */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold hidden sm:block">
              SoftHouse
            </span>
            <ChevronRight className="h-3 w-3 text-slate-300 hidden sm:block flex-shrink-0" />
            <h1 className="text-sm font-bold text-slate-900 truncate">{title}</h1>
            {subtitle && (
              <>
                <ChevronRight className="h-3 w-3 text-slate-300 flex-shrink-0 hidden md:block" />
                <p className="text-[11px] text-slate-500 truncate hidden md:block">{subtitle}</p>
              </>
            )}
          </div>
          <p className="text-[10px] text-slate-400 hidden sm:block mt-0.5 capitalize">{dateStr}</p>
        </div>
      </div>

      {/* Right: search + slot + bell */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="hidden lg:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 w-44">
          <Search className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-[11px] text-slate-400">Buscar...</span>
        </div>

        {children}

        <button className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors border border-transparent hover:border-slate-200">
          <Bell className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
