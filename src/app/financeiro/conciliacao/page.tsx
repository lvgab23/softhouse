'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, Circle, AlertCircle, ChevronDown, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { MetricCard } from '@/components/ui/metric-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { formatBRL, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export default function ConciliacaoPage() {
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [contas, setContas] = useState<any[]>([])
  const [contaSelecionada, setContaSelecionada] = useState('')
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [c, l] = await Promise.all([
      (supabase as any).from('contas_bancarias').select('id, banco, conta').eq('ativo', true),
      (supabase as any)
        .from('lancamentos')
        .select('*')
        .gte('data', `${periodo}-01`)
        .lte('data', `${periodo}-31`)
        .order('data', { ascending: false }),
    ])
    setContas(c.data || [])
    const allLanc = l.data || []
    setLancamentos(contaSelecionada ? allLanc.filter((x: any) => x.conta_id === contaSelecionada) : allLanc)
    setLoading(false)
  }, [periodo, contaSelecionada])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleConciliado = async (item: any) => {
    setSaving(item.id)
    const supabase = createClient()
    const { error } = await (supabase as any)
      .from('lancamentos')
      .update({ conciliado: !item.conciliado })
      .eq('id', item.id)
    if (error) toast.error('Erro ao atualizar')
    else {
      setLancamentos(prev => prev.map(l => l.id === item.id ? { ...l, conciliado: !l.conciliado } : l))
    }
    setSaving(null)
  }

  const conciliados = lancamentos.filter(l => l.conciliado)
  const pendentes = lancamentos.filter(l => !l.conciliado)
  const totalConciliado = conciliados.reduce((s, l) => s + (l.tipo === 'receita' ? l.valor : -l.valor), 0)
  const totalPendente = pendentes.reduce((s, l) => s + (l.tipo === 'receita' ? l.valor : -l.valor), 0)

  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), i, 1)
    return {
      value: `${d.getFullYear()}-${String(i + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    }
  })

  return (
    <AppLayout>
      <Topbar title="Conciliação Bancária" subtitle="Conferência e conciliação de lançamentos">
        <Button size="sm" variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </Topbar>

      <div className="p-6 space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={periodo}
              onChange={e => setPeriodo(e.target.value)}
              className="h-9 appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 cursor-pointer"
            >
              {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={contaSelecionada}
              onChange={e => setContaSelecionada(e.target.value)}
              className="h-9 appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 cursor-pointer"
            >
              <option value="">Todas as contas</option>
              {contas.map((c: any) => <option key={c.id} value={c.id}>{c.banco} — {c.conta}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          </div>
          <span className="text-xs text-gray-400">{lancamentos.length} lançamento(s)</span>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Lançamentos" value={String(lancamentos.length)} subtitle="no período" icon={AlertCircle} />
          <MetricCard label="Conciliados" value={String(conciliados.length)} subtitle="conferidos" icon={CheckCircle2} />
          <MetricCard label="Pendentes" value={String(pendentes.length)} subtitle="aguardando" icon={Circle} />
          <MetricCard label="Saldo Pendente" value={formatBRL(Math.abs(totalPendente))} subtitle={totalPendente >= 0 ? 'a receber' : 'a pagar'} icon={AlertCircle} />
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-white rounded-xl animate-pulse" />)}</div>
        ) : lancamentos.length === 0 ? (
          <EmptyState title="Nenhum lançamento no período" description="Selecione outro período ou adicione lançamentos" />
        ) : (
          <div className="space-y-3">
            {/* Pendentes */}
            {pendentes.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-2">
                  <Circle className="h-3.5 w-3.5 text-yellow-500" />
                  Pendentes de conciliação ({pendentes.length})
                </h3>
                <div className="bg-white rounded-xl border border-yellow-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {pendentes.map((l: any, i: number) => (
                        <tr key={l.id} className={`border-b border-gray-50 hover:bg-yellow-50/30 ${i === pendentes.length - 1 ? 'border-b-0' : ''}`}>
                          <td className="px-4 py-3 w-8">
                            <button
                              onClick={() => toggleConciliado(l)}
                              disabled={saving === l.id}
                              className="text-gray-300 hover:text-green-500 transition-colors"
                            >
                              <Circle className="h-4 w-4" />
                            </button>
                          </td>
                          <td className="px-2 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(l.data)}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{l.descricao || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-400">{l.categoria || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <Badge variant={l.tipo === 'receita' ? 'success' : 'danger'}>
                              {l.tipo === 'receita' ? 'Receita' : 'Despesa'}
                            </Badge>
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${l.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                            {l.tipo === 'receita' ? '+' : '-'}{formatBRL(l.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Conciliados */}
            {conciliados.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  Conciliados ({conciliados.length})
                </h3>
                <div className="bg-white rounded-xl border border-green-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {conciliados.map((l: any, i: number) => (
                        <tr key={l.id} className={`border-b border-gray-50 hover:bg-green-50/30 ${i === conciliados.length - 1 ? 'border-b-0' : ''}`}>
                          <td className="px-4 py-3 w-8">
                            <button
                              onClick={() => toggleConciliado(l)}
                              disabled={saving === l.id}
                              className="text-green-500 hover:text-gray-300 transition-colors"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          </td>
                          <td className="px-2 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(l.data)}</td>
                          <td className="px-4 py-3 font-medium text-gray-500 line-through">{l.descricao || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-400">{l.categoria || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <Badge variant="gray">{l.tipo === 'receita' ? 'Receita' : 'Despesa'}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-400">
                            {formatBRL(l.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
