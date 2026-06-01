'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, ChevronDown, Trash2, TrendingDown, Briefcase, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { MetricCard } from '@/components/ui/metric-card'
import { formatBRL, formatDate, formatShort } from '@/lib/utils'
import { CurrencyInput } from '@/components/ui/currency-input'
import { createClient } from '@/lib/supabase/client'

const CATEGORIAS = [
  { value: 'folha_pagamento', label: 'Folha de Pagamento' },
  { value: 'aluguel', label: 'Aluguel / Locação' },
  { value: 'impostos', label: 'Impostos / Tributos' },
  { value: 'marketing', label: 'Marketing / Publicidade' },
  { value: 'tecnologia', label: 'Tecnologia / Software' },
  { value: 'contabilidade', label: 'Contabilidade / Jurídico' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'manutencao', label: 'Manutenção / Infraestrutura' },
  { value: 'logistica', label: 'Logística / Frete' },
  { value: 'fornecedores', label: 'Fornecedores' },
  { value: 'outros', label: 'Outros' },
]

const CAT_COLOR: Record<string, string> = {
  folha_pagamento: 'bg-purple-50 text-purple-700 border-purple-200',
  aluguel:         'bg-blue-50 text-blue-700 border-blue-200',
  impostos:        'bg-red-50 text-red-700 border-red-200',
  marketing:       'bg-pink-50 text-pink-700 border-pink-200',
  tecnologia:      'bg-cyan-50 text-cyan-700 border-cyan-200',
  contabilidade:   'bg-indigo-50 text-indigo-700 border-indigo-200',
  seguros:         'bg-teal-50 text-teal-700 border-teal-200',
  manutencao:      'bg-amber-50 text-amber-700 border-amber-200',
  logistica:       'bg-orange-50 text-orange-700 border-orange-200',
  fornecedores:    'bg-green-50 text-green-700 border-green-200',
  outros:          'bg-gray-50 text-gray-700 border-gray-200',
}

const PERIODS = [
  { value: 'todos', label: 'Todo período' },
  { value: 'mes', label: 'Este mês' },
  { value: '3m', label: 'Últimos 3 meses' },
  { value: '6m', label: 'Últimos 6 meses' },
  { value: 'ano', label: 'Este ano' },
]

const schema = z.object({
  empresa_id: z.string().min(1, 'Empresa obrigatória'),
  valor: z.number().positive('Valor deve ser positivo'),
  data: z.string().min(1, 'Data obrigatória'),
  categoria: z.string().default('outros'),
  descricao: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function NegociosDespesasPage() {
  const [despesas, setDespesas]     = useState<any[]>([])
  const [empresas, setEmpresas]     = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [tableReady, setTableReady] = useState(true)
  const [modalOpen, setModalOpen]   = useState(false)
  const [search, setSearch]         = useState('')
  const [catFilter, setCatFilter]   = useState('todos')
  const [empresaFilter, setEmpresa] = useState('todos')
  const [periodoFilter, setPeriodo] = useState('todos')
  const [deleting, setDeleting]     = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { data: new Date().toISOString().split('T')[0], categoria: 'outros' },
  })

  const fetchData = useCallback(async () => {
    await fetch('/api/admin/migrate-patrimonio', { method: 'POST' }).catch(() => {})
    const supabase = createClient()
    const [d, e] = await Promise.all([
      (supabase as any).from('despesas_operacionais')
        .select('*, empresas(nome)')
        .not('empresa_id', 'is', null)
        .order('data', { ascending: false }),
      (supabase as any).from('empresas').select('id, nome').order('nome'),
    ])
    if (d.error?.code === '42P01' || d.error?.message?.includes('column "empresa_id"')) {
      setTableReady(false)
      setEmpresas(e.data || [])
      setLoading(false)
      return
    }
    setTableReady(true)
    setDespesas(d.data || [])
    setEmpresas(e.error ? [] : (e.data || []))
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => {
    let items = despesas
    if (empresaFilter !== 'todos') items = items.filter(d => d.empresa_id === empresaFilter)
    if (catFilter !== 'todos') items = items.filter(d => d.categoria === catFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(d =>
        (d.empresas?.nome || '').toLowerCase().includes(q) ||
        (d.descricao || '').toLowerCase().includes(q)
      )
    }
    if (periodoFilter !== 'todos') {
      const now = new Date(); const cutoff = new Date()
      if (periodoFilter === 'mes')  { cutoff.setDate(1); cutoff.setHours(0, 0, 0, 0) }
      else if (periodoFilter === '3m') cutoff.setMonth(now.getMonth() - 3)
      else if (periodoFilter === '6m') cutoff.setMonth(now.getMonth() - 6)
      else if (periodoFilter === 'ano') { cutoff.setMonth(0, 1); cutoff.setHours(0, 0, 0, 0) }
      items = items.filter(d => new Date(d.data) >= cutoff)
    }
    return items
  }, [despesas, catFilter, empresaFilter, search, periodoFilter])

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await (supabase as any).from('despesas_operacionais').insert({
      empresa_id: data.empresa_id,
      valor: data.valor,
      data: data.data,
      categoria: data.categoria,
      descricao: data.descricao || null,
      user_id: user.id,
    })
    if (error) { toast.error(`Erro: ${error.message}`); return }
    toast.success('Despesa registrada!')
    setModalOpen(false)
    reset({ data: new Date().toISOString().split('T')[0], categoria: 'outros' })
    fetchData()
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await (supabase as any).from('despesas_operacionais').delete().eq('id', id)
    toast.success('Despesa excluída')
    setDeleting(null)
    fetchData()
  }

  const totalDespesas = filtered.reduce((s, d) => s + (d.valor || 0), 0)
  const empresasComDespesa = new Set(filtered.map(d => d.empresa_id)).size

  const maiorCategoria = useMemo(() => {
    if (!filtered.length) return null
    const map: Record<string, number> = {}
    filtered.forEach(d => { map[d.categoria || 'outros'] = (map[d.categoria || 'outros'] || 0) + d.valor })
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0]
  }, [filtered])

  const mediaMensal = useMemo(() => {
    if (!filtered.length) return 0
    const meses = new Set(filtered.map(d => d.data?.slice(0, 7)))
    return totalDespesas / meses.size
  }, [filtered, totalDespesas])

  return (
    <AppLayout>
      <Topbar title="Despesas — Negócios" subtitle="Custos operacionais das empresas do portfólio">
        {tableReady && (
          <Button size="sm" onClick={() => {
            reset({ data: new Date().toISOString().split('T')[0], categoria: 'outros' })
            setModalOpen(true)
          }}>
            <Plus className="h-4 w-4" /> Nova Despesa
          </Button>
        )}
      </Topbar>

      <div className="p-6 space-y-5">
        {!tableReady && (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Preparando módulo de despesas...
          </div>
        )}

        {tableReady && (
          <>
            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Total Despesas" value={formatShort(totalDespesas)} subtitle="no período filtrado" icon={TrendingDown} />
              <MetricCard label="Média Mensal" value={formatShort(mediaMensal)} subtitle="média por mês" icon={Tag} />
              <MetricCard
                label="Maior Categoria"
                value={maiorCategoria ? CATEGORIAS.find(c => c.value === maiorCategoria[0])?.label || maiorCategoria[0] : '—'}
                subtitle={maiorCategoria ? formatBRL(maiorCategoria[1]) : 'sem dados'}
                icon={Tag}
              />
              <MetricCard label="Empresas com Despesas" value={String(empresasComDespesa)} subtitle="empresas com custos" icon={Briefcase} />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar empresa ou descrição..."
                  className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                />
              </div>
              {[
                { v: periodoFilter, s: setPeriodo, opts: PERIODS },
                {
                  v: empresaFilter,
                  s: setEmpresa,
                  opts: [{ value: 'todos', label: 'Todas as empresas' }, ...empresas.map(e => ({ value: e.id, label: e.nome }))],
                },
                {
                  v: catFilter,
                  s: setCatFilter,
                  opts: [{ value: 'todos', label: 'Todas as categorias' }, ...CATEGORIAS],
                },
              ].map((f, idx) => (
                <div key={idx} className="relative">
                  <select
                    value={f.v}
                    onChange={e => f.s(e.target.value)}
                    className="h-8 appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-7 text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                  >
                    {f.opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
                </div>
              ))}
              <span className="text-xs text-gray-400">{filtered.length} registro(s)</span>
            </div>

            {/* Table */}
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-12 bg-white rounded-lg animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState title="Nenhuma despesa encontrada" action={{ label: 'Nova Despesa', onClick: () => setModalOpen(true) }} />
            ) : (
              <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Data</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Empresa</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Categoria</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Descrição</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((d: any, i: number) => {
                        const catLabel = CATEGORIAS.find(c => c.value === d.categoria)?.label || d.categoria || 'Outros'
                        const catColor = CAT_COLOR[d.categoria] || CAT_COLOR.outros
                        return (
                          <tr key={d.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === filtered.length - 1 ? 'border-b-0' : ''}`}>
                            <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{d.data ? formatDate(d.data) : '—'}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{d.empresas?.nome || '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${catColor}`}>
                                {catLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[200px]">{d.descricao || '—'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-red-600">{formatBRL(d.valor)}</td>
                            <td className="px-4 py-3">
                              <button onClick={() => setDeleting(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-100 bg-gray-50/50">
                        <td colSpan={3} className="px-4 py-2 text-xs text-gray-400">
                          {filtered.length} lançamento(s) no período
                        </td>
                        <td className="px-4 py-2 text-xs font-medium text-gray-500 text-right">Total:</td>
                        <td className="px-4 py-2 text-right font-bold text-red-600">{formatBRL(totalDespesas)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova Despesa — Negócios"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>Registrar</Button>
          </>
        }
      >
        <form className="space-y-4">
          <Select label="Empresa *" error={errors.empresa_id?.message} {...register('empresa_id')}>
            <option value="">Selecione a empresa...</option>
            {empresas.map((e: any) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <CurrencyInput label="Valor (R$) *" value={watch("valor")} onChange={v => setValue("valor", v as any)} />
            <Input label="Data *" type="date" error={errors.data?.message} {...register('data')} />
          </div>
          <Select label="Categoria" {...register('categoria')}>
            {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
          <Input label="Descrição" placeholder="Ex: Folha de pagamento — maio/2025" {...register('descricao')} />
        </form>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Confirmar exclusão"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={() => deleting && handleDelete(deleting)}>Excluir</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">Deseja excluir esta despesa? Esta ação não pode ser desfeita.</p>
      </Modal>
    </AppLayout>
  )
}
