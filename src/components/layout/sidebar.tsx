'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, TrendingUp, Columns, Building2, Tag, Users2,
  Wallet, ArrowLeftRight, BarChart3, Wrench, Percent, Home, Map,
  Archive, Users, History, FolderKanban, ChevronDown, ChevronRight,
  LogOut, Building, Briefcase, PiggyBank, Sun, CreditCard,
  FileText, CheckSquare, BarChart2, Receipt, Landmark, Repeat2, Shield
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
      { href: '/cadastros/imoveis', label: 'Imóveis' },
      { href: '/cadastros/bens-moveis', label: 'Bens Móveis' },
      { href: '/cadastros/categorias', label: 'Categorias' },
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

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [openMenus, setOpenMenus] = useState<string[]>(['Cadastros', 'Projetos', 'Financeiro', 'Negócios', 'Bens'])
  const [userEmail, setUserEmail] = useState<string | null>(null)

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
    <aside className="fixed left-0 top-0 h-screen w-[200px] bg-[#0f172a] flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/10 flex-shrink-0">
        <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">SoftHouse</p>
          <p className="text-[#475569] text-[10px] leading-tight">Gestão Patrimonial</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 scrollbar-none">
        {navItems.filter(item => item.label !== 'Administração' || userEmail === ADMIN_EMAIL).map((item) => {
          if ('children' in item) {
            const isOpen = openMenus.includes(item.label)
            const isActive = item.children.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))
            const Icon = item.icon
            return (
              <div key={item.label} className="mb-0.5">
                <button
                  onClick={() => toggleMenu(item.label)}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    isActive ? 'text-white' : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    {item.label}
                  </span>
                  {isOpen ? <ChevronDown className="h-3 w-3 flex-shrink-0" /> : <ChevronRight className="h-3 w-3 flex-shrink-0" />}
                </button>
                {isOpen && (
                  <div className="ml-5 mt-0.5 flex flex-col gap-0.5 mb-1">
                    {item.children.map(child => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[11px] transition-colors truncate',
                          pathname === child.href || pathname.startsWith(child.href + '/')
                            ? 'text-white bg-white/10 font-medium'
                            : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
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
                'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors mb-0.5',
                isActive
                  ? 'text-white bg-white/10'
                  : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
              )}
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-white/10 flex-shrink-0">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/5 text-xs transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    </aside>
  )
}
