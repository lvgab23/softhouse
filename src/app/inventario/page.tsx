'use client'

import { useEffect, useState } from 'react'
import { Search, Building2, MapPin } from 'lucide-react'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatBRL } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const statusConf: Record<string, { label: string; variant: any }> = {
  ativo: { label: 'Ativo', variant: 'success' },
  inativo: { label: 'Inativo', variant: 'gray' },
  negociacao: { label: 'Negociação', variant: 'warning' },
  vendido: { label: 'Vendido', variant: 'danger' },
}

export default function InventarioPage() {
  const [patrimonios, setPatrimonios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const { data } = await supabase
        .from('patrimonios')
        .select('*, categorias(nome)')
        .order('nome')
      setPatrimonios(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const filtered = patrimonios.filter(p => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase()) ||
      (p.categorias?.nome || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.cidade || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus ? p.status === filterStatus : true
    return matchSearch && matchStatus
  })

  return (
    <AppLayout>
      <Topbar title="Inventário" subtitle={`${filtered.length} patrimônio(s)`} />

      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
          >
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
            <option value="negociacao">Em Negociação</option>
            <option value="vendido">Vendido</option>
          </select>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-40 bg-white rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Building2} title="Nenhum patrimônio encontrado" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((p: any) => {
              const sc = statusConf[p.status] || statusConf.ativo
              return (
                <div key={p.id} className="bg-white rounded-xl border border-black/[0.08] p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
                  <div className="w-full h-24 bg-slate-50 rounded-lg flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-slate-300" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm leading-tight">{p.nome}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.categorias?.nome || 'Sem categoria'}</p>
                    {(p.cidade || p.estado) && (
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3 text-gray-300" />
                        <p className="text-xs text-gray-400">{[p.cidade, p.estado].filter(Boolean).join(', ')}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900">
                      {p.valor_atual ? formatBRL(p.valor_atual) : p.valor_aquisicao ? formatBRL(p.valor_aquisicao) : '—'}
                    </p>
                    <Badge variant={sc.variant}>{sc.label}</Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
