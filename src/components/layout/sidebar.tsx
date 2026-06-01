'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, TrendingUp, Columns, Building2,
  Wallet, Map, Archive, Users, History, FolderKanban,
  ChevronDown, ChevronRight, LogOut, Briefcase, PiggyBank,
  Wrench, Shield, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/evolucao', icon: TrendingUp, label: 'Evolução' },
  { href: '/kanban', icon: Columns, label: 'Kanban' },
  {
    label: 'Cadastros',
    icon: Building2,
    children: [
      { href: '/cadastros/categorias',  label: 'Categorias'   },
      { href: '/cadastros/fornecedores', label: 'Fornecedores' },
    ],
  },
  {
    label: 'Projetos',
    icon: FolderKanban,
    children: [
      { href: '/projetos/dashboard', label: 'Dashboard' },
      { href: '/projetos/evolucao', label: 'Evolução' },
      { href: '/projetos/lista', label: 'Projetos' },
      { href: '/projetos/kanban', label: 'Kanban' },
      { href: '/projetos/usinas-solares', label: 'Usinas Solares' },
      { href: '/projetos/aportes', label: 'Aportes' },
      { href: '/projetos/retornos', label: 'Retornos' },
      { href: '/projetos/despesas', label: 'Desp. Operacionais' },
      { href: '/projetos/relatorios', label: 'Relatórios' },
    ],
  },
  {
    label: 'Bens',
    icon: PiggyBank,
    children: [
      { href: '/investimentos/dashboard', label: 'Dashboard' },
      { href: '/investimentos/kanban', label: 'Kanban' },
      { href: '/cadastros/imoveis', label: 'Bens Imóveis' },
      { href: '/cadastros/bens-moveis', label: 'Bens Móveis' },
      { href: '/investimentos/retornos', label: 'Retornos' },
      { href: '/investimentos/depreciacoes', label: 'Depreciações' },
      { href: '/investimentos/despesas', label: 'Desp. Operacionais' },
    ],
  },
  {
    label: 'Negócios',
    icon: Briefcase,
    children: [
      { href: '/negocios/dashboard', label: 'Dashboard' },
      { href: '/negocios/empresas', label: 'Empresas' },
      { href: '/negocios/kanban', label: 'Kanban' },
      { href: '/negocios/socios', label: 'Sócios' },
      { href: '/negocios/compliance', label: 'Compliance' },
      { href: '/negocios/despesas', label: 'Desp. Operacionais' },
    ],
  },
  {
    label: 'Financeiro',
    icon: Wallet,
    children: [
      { href: '/financeiro/dashboard', label: 'Dashboard' },
      { href: '/financeiro/recebimentos', label: 'Recebimentos' },
      { href: '/financeiro/lancamentos', label: 'Lançamentos' },
      { href: '/financeiro/contas-bancarias', label: 'Contas Bancárias' },
      { href: '/financeiro/transferencias', label: 'Transferências' },
      { href: '/financeiro/conciliacao', label: 'Conciliação' },
      { href: '/financeiro/dre', label: 'DRE' },
    ],
  },
  {
    label: 'Compliance',
    icon: ShieldCheck,
    children: [
      { href: '/compliance/dashboard', label: 'Dashboard' },
      { href: '/compliance/consulta', label: 'Nova Consulta' },
      { href: '/compliance/monitoramento', label: 'Monitoramento' },
      { href: '/compliance/alertas', label: 'Alertas' },
    ],
  },
  { href: '/manutencoes', icon: Wrench, label: 'Manutenções' },
  { href: '/inventario', icon: Archive, label: 'Inventário' },
  { href: '/mapa', icon: Map, label: 'Mapa' },
  { href: '/colaboradores', icon: Users, label: 'Colaboradores' },
  { href: '/historico', icon: History, label: 'Histórico' },
  {
    label: 'Administração',
    icon: Shield,
    children: [
      { href: '/admin/usuarios', label: 'Usuários' },
    ],
  },
]

const ADMIN_EMAIL = 'medeiros.gabrielsmb@gmail.com'

function getActiveSectionLabel(pathname: string): string | null {
  for (const item of navItems) {
    if ('children' in item && item.children.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))) {
      return item.label
    }
  }
  return null
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [openMenus, setOpenMenus] = useState<string[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Auto-open only the section that contains the current page
  useEffect(() => {
    const active = getActiveSectionLabel(pathname)
    if (active) {
      setOpenMenus(prev => prev.includes(active) ? prev : [active])
    }
  }, [pathname])

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null))
  }, [])

  const toggleMenu = (label: string) => {
    setOpenMenus(prev =>
      prev.includes(label) ? prev.filter(m => m !== label) : [...prev, label]
    )
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[210px] bg-[#0a0f1e] flex flex-col z-40 border-r border-white/[0.06]">

      {/* Brand */}
      <div className="flex-shrink-0 px-4 pt-5 pb-4">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/40 flex-shrink-0">
            <span className="text-white font-black text-[13px] tracking-tight leading-none">H</span>
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-[13px] leading-tight tracking-tight">House Family</p>
            <p className="text-blue-400/60 text-[10px] leading-tight tracking-widest uppercase mt-0.5">Family Office</p>
          </div>
        </div>
        {/* Divider */}
        <div className="mt-4 h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-1 px-2.5 scrollbar-none">
        {navItems
          .filter(item => item.label !== 'Administração' || userEmail === ADMIN_EMAIL)
          .map((item) => {
            if ('children' in item) {
              const isOpen = openMenus.includes(item.label)
              const isActive = item.children.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))
              const Icon = item.icon
              return (
                <div key={item.label} className="mb-0.5">
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] font-semibold transition-all duration-150',
                      isActive
                        ? 'text-white bg-white/[0.07]'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', isActive ? 'text-blue-400' : 'text-slate-500')} />
                      {item.label}
                    </span>
                    <ChevronRight
                      className={cn(
                        'h-3 w-3 flex-shrink-0 text-slate-600 transition-transform duration-200',
                        isOpen && 'rotate-90'
                      )}
                    />
                  </button>

                  {isOpen && (
                    <div className="ml-[22px] mt-0.5 mb-1 pl-3 border-l border-white/[0.06] flex flex-col gap-0.5">
                      {item.children.map(child => {
                        const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              'px-2 py-1.5 rounded-md text-[11px] transition-all duration-100 truncate',
                              childActive
                                ? 'text-white bg-blue-600/20 font-semibold'
                                : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'
                            )}
                          >
                            {child.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px] font-semibold transition-all duration-150 mb-0.5',
                  isActive
                    ? 'text-white bg-white/[0.07]'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                )}
              >
                <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', isActive ? 'text-blue-400' : 'text-slate-500')} />
                {item.label}
              </Link>
            )
          })}
      </nav>

      {/* Footer */}
      <div className="flex-shrink-0 px-2.5 pb-3 pt-2 border-t border-white/[0.06]">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.05] text-[11px] font-semibold transition-all duration-150"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    </aside>
  )
}
