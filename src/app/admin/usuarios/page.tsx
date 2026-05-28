'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Users, RefreshCw, CheckCircle2, XCircle, Clock, Trash2, Search, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

const ADMIN_EMAIL = 'medeiros.gabrielsmb@gmail.com'

interface UserRow {
  id: string
  email: string
  created_at: string
  last_sign_in: string | null
  confirmed: boolean
  banned: boolean
  provider: string
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return 'Nunca'
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60)    return 'agora'
  if (diff < 3600)  return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d atrás`
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export default function AdminUsuariosPage() {
  const router = useRouter()
  const [users, setUsers]         = useState<UserRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [isAdmin, setIsAdmin]     = useState(false)
  const [checkingAuth, setChecking] = useState(true)
  const [search, setSearch]       = useState('')
  const [deleting, setDeleting]   = useState<string | null>(null)

  // Verifica se é admin antes de carregar
  useEffect(() => {
    const check = async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (user?.email === ADMIN_EMAIL) {
        setIsAdmin(true)
        // Apply security RLS migrations idempotently
        fetch('/api/admin/migrate-security', { method: 'POST' }).catch(() => {})
      } else {
        router.replace('/dashboard')
      }
      setChecking(false)
    }
    check()
  }, [router])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/users').then(r => r.json())
    setUsers(res.users || [])
    setLoading(false)
  }, [])

  useEffect(() => { if (isAdmin) fetchUsers() }, [isAdmin, fetchUsers])

  if (checkingAuth) return null

  const handleDelete = async (user: UserRow) => {
    if (!confirm(`Excluir o usuário "${user.email}"? Esta ação não pode ser desfeita.`)) return
    setDeleting(user.id)
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    }).then(r => r.json())
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Usuário excluído')
      setUsers(prev => prev.filter(u => u.id !== user.id))
    }
    setDeleting(null)
  }

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  const totalConfirmed = users.filter(u => u.confirmed).length
  const totalPending   = users.filter(u => !u.confirmed).length
  const lastWeek       = users.filter(u => {
    const diff = (Date.now() - new Date(u.created_at).getTime()) / 86400000
    return diff <= 7
  }).length

  return (
    <AppLayout>
      <Topbar title="Usuários do Sistema" subtitle="Gerencie todos os usuários cadastrados">
        <button onClick={fetchUsers} disabled={loading}
          className="flex items-center gap-1.5 h-8 px-3 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors bg-white">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </Topbar>

      <div className="p-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total de usuários', value: users.length,        icon: Users,        color: '#3b82f6', bg: '#eff6ff' },
            { label: 'Confirmados',       value: totalConfirmed,      icon: CheckCircle2, color: '#22c55e', bg: '#f0fdf4' },
            { label: 'Pendentes',         value: totalPending,        icon: Clock,        color: '#f59e0b', bg: '#fffbeb' },
            { label: 'Últimos 7 dias',    value: lastWeek,            icon: Shield,       color: '#8b5cf6', bg: '#f5f3ff' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-black/[0.07] p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                <Icon className="h-5 w-5" style={{ color }} />
              </div>
              <div>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{loading ? '—' : value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
          {/* Header da tabela */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por e-mail..."
                className="w-full h-8 pl-8 pr-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <span className="text-xs text-gray-400 ml-auto">{filtered.length} usuário{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="space-y-px">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-14 bg-gray-50 animate-pulse mx-5 my-2 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Users className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">E-mail</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Cadastro</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Último acesso</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Login via</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-600">
                            {(u.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-gray-800">{u.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.banned ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-600">
                            <XCircle className="h-3 w-3" /> Banido
                          </span>
                        ) : u.confirmed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700">
                            <CheckCircle2 className="h-3 w-3" /> Confirmado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600">
                            <Clock className="h-3 w-3" /> Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(u.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {timeAgo(u.last_sign_in)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-500 font-medium capitalize">
                          {u.provider}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={deleting === u.id}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all disabled:opacity-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-[10px] text-gray-400 text-center">
          Dados via Supabase Auth · apenas administradores têm acesso a esta página
        </p>
      </div>
    </AppLayout>
  )
}
