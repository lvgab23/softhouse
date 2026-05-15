'use client'

import { useEffect, useState, useMemo } from 'react'
import { Plus, Edit3, Trash2, Search, ChevronDown } from 'lucide-react'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'

const acaoConf: Record<string, { label: string; variant: any; icon: any }> = {
  criacao: { label: 'Criação', variant: 'success', icon: Plus },
  alteracao: { label: 'Alteração', variant: 'warning', icon: Edit3 },
  exclusao: { label: 'Exclusão', variant: 'danger', icon: Trash2 },
}

const tabelaLabels: Record<string, string> = {
  patrimonios: 'Patrimônio', categorias: 'Categoria', fornecedores: 'Fornecedor',
  movimentacoes: 'Movimentação', manutencoes: 'Manutenção', alugueis: 'Aluguel',
  projetos: 'Projeto', aportes: 'Aporte', colaboradores: 'Colaborador',
  empresas: 'Empresa', lancamentos: 'Lançamento',
}

const PERIODS = [
  { value: 'todos', label: 'Todo o período' },
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'mes', label: 'Este mês' },
  { value: 'ano', label: 'Este ano' },
]

export default function HistoricoPage() {
  const [historico, setHistorico] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [acaoFilter, setAcaoFilter] = useState('todos')
  const [periodoFilter, setPeriodoFilter] = useState('todos')
  const [tabelaFilter, setTabelaFilter] = useState('todos')

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const { data } = await supabase
        .from('historico')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      setHistorico(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const filtered = useMemo(() => {
    let items = historico

    if (acaoFilter !== 'todos') items = items.filter(h => h.acao === acaoFilter)
    if (tabelaFilter !== 'todos') items = items.filter(h => h.tabela === tabelaFilter)

    if (periodoFilter !== 'todos') {
      const now = new Date()
      const cutoff = new Date()
      if (periodoFilter === 'hoje') cutoff.setHours(0, 0, 0, 0)
      else if (periodoFilter === '7d') cutoff.setDate(now.getDate() - 7)
      else if (periodoFilter === '30d') cutoff.setDate(now.getDate() - 30)
      else if (periodoFilter === '90d') cutoff.setDate(now.getDate() - 90)
      else if (periodoFilter === 'mes') { cutoff.setDate(1); cutoff.setHours(0, 0, 0, 0) }
      else if (periodoFilter === 'ano') { cutoff.setMonth(0, 1); cutoff.setHours(0, 0, 0, 0) }
      items = items.filter(h => new Date(h.created_at) >= cutoff)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(h =>
        (h.tabela || '').toLowerCase().includes(q) ||
        (h.acao || '').toLowerCase().includes(q) ||
        (h.campos || '').toLowerCase().includes(q)
      )
    }

    return items
  }, [historico, acaoFilter, tabelaFilter, periodoFilter, search])

  const tabelasUnicas = [...new Set(historico.map(h => h.tabela).filter(Boolean))]

  return (
    <AppLayout>
      <Topbar title="Histórico" subtitle="Todas as movimentações realizadas no sistema" />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar no histórico..."
              className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
            />
          </div>

          {[
            { value: periodoFilter, onChange: setPeriodoFilter, options: PERIODS },
            { value: acaoFilter, onChange: setAcaoFilter, options: [{ value: 'todos', label: 'Todas as ações' }, { value: 'criacao', label: 'Criação' }, { value: 'alteracao', label: 'Alteração' }, { value: 'exclusao', label: 'Exclusão' }] },
            { value: tabelaFilter, onChange: setTabelaFilter, options: [{ value: 'todos', label: 'Todos os módulos' }, ...tabelasUnicas.map(t => ({ value: t, label: tabelaLabels[t] || t }))] },
          ].map((f, idx) => (
            <div key={idx} className="relative">
              <select
                value={f.value}
                onChange={e => f.onChange(e.target.value)}
                className="h-8 appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-7 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 cursor-pointer"
              >
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
            </div>
          ))}

          <span className="text-xs text-gray-400 ml-1">{filtered.length} registro(s)</span>
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-white rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Nenhum registro encontrado" description="Tente ajustar os filtros aplicados" />
        ) : (
          <div className="space-y-1.5">
            {filtered.map((h) => {
              const conf = acaoConf[h.acao] || acaoConf.alteracao
              const Icon = conf.icon
              const dt = new Date(h.created_at)
              const today = new Date()
              const isToday = dt.toDateString() === today.toDateString()
              const isYesterday = dt.toDateString() === new Date(today.setDate(today.getDate() - 1)).toDateString()
              const dateLabel = isToday ? 'Hoje' : isYesterday ? 'Ontem' : dt.toLocaleDateString('pt-BR')

              let camposText = ''
              try { const parsed = JSON.parse(h.campos || '{}'); camposText = Object.keys(parsed).join(', ') } catch (_) {}

              return (
                <div key={h.id} className="bg-white rounded-xl border border-black/[0.06] px-4 py-3 flex items-center gap-3 hover:bg-gray-50/30 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    h.acao === 'criacao' ? 'bg-green-50' : h.acao === 'exclusao' ? 'bg-red-50' : 'bg-yellow-50'
                  }`}>
                    <Icon className={`h-3.5 w-3.5 ${
                      h.acao === 'criacao' ? 'text-green-500' : h.acao === 'exclusao' ? 'text-red-500' : 'text-yellow-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={conf.variant}>{conf.label}</Badge>
                      <span className="text-xs font-semibold text-gray-700">
                        {tabelaLabels[h.tabela || ''] || h.tabela || 'Sistema'}
                      </span>
                      {camposText && (
                        <span className="text-[10px] text-gray-400 truncate max-w-[200px]">· campos: {camposText}</span>
                      )}
                    </div>
                    {h.registro_id && (
                      <p className="text-[10px] text-gray-300 mt-0.5 font-mono truncate">{h.registro_id}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-medium text-gray-500">{dateLabel}</p>
                    <p className="text-[10px] text-gray-400">{dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
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
