'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, LayoutList, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { MetricCard } from '@/components/ui/metric-card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatBRL, formatShort, formatDate } from '@/lib/utils'
import { CurrencyInput } from '@/components/ui/currency-input'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  tipo: z.enum(['receita', 'despesa']),
  descricao: z.string().min(1, 'Descrição obrigatória'),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  data: z.string().min(1, 'Data obrigatória'),
  categoria: z.string().optional(),
  conta_id: z.string().optional(),
  status: z.enum(['pendente', 'confirmado', 'cancelado']),
  notas: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const PERIODO_OPTIONS = [
  { label: 'Hoje', value: 'hoje' },
  { label: 'Semana', value: 'semana' },
  { label: 'Mês', value: 'mes' },
  { label: 'Trimestre', value: 'trimestre' },
  { label: 'Ano', value: 'ano' },
]

function getPeriodDates(periodo: string) {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  if (periodo === 'hoje') return { inicio: fmt(now), fim: fmt(now) }
  if (periodo === 'semana') {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay())
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return { inicio: fmt(start), fim: fmt(end) }
  }
  if (periodo === 'mes') return { inicio: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), fim: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
  if (periodo === 'trimestre') {
    const q = Math.floor(now.getMonth() / 3)
    return { inicio: fmt(new Date(now.getFullYear(), q * 3, 1)), fim: fmt(new Date(now.getFullYear(), q * 3 + 3, 0)) }
  }
  return { inicio: fmt(new Date(now.getFullYear(), 0, 1)), fim: fmt(new Date(now.getFullYear(), 11, 31)) }
}

export default function LancamentosPage() {
  const [items, setItems] = useState<any[]>([])
  const [contas, setContas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('todos')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [periodo, setPeriodo] = useState('mes')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'despesa', status: 'pendente', data: new Date().toISOString().split('T')[0] },
  })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { inicio, fim } = getPeriodDates(periodo)
    const [r, c] = await Promise.all([
      (supabase as any).from('lancamentos').select('*').gte('data', inicio).lte('data', fim).order('data', { ascending: false }),
      (supabase as any).from('contas_bancarias').select('id, banco, conta').eq('ativo', true),
    ])
    setItems(r.data || [])
    setContas(c.data || [])
    setLoading(false)
  }, [periodo])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setEditItem(null)
    reset({ tipo: 'despesa', status: 'pendente', data: new Date().toISOString().split('T')[0] })
    setModalOpen(true)
  }

  const openEdit = (item: any) => {
    setEditItem(item)
    reset({
      tipo: item.tipo,
      descricao: item.descricao,
      valor: item.valor,
      data: item.data,
      categoria: item.categoria || '',
      conta_id: item.conta_id || '',
      status: item.status,
      notas: item.notas || '',
    })
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = {
      ...data,
      conta_id: data.conta_id || null,
      categoria: data.categoria || null,
      notas: data.notas || null,
      user_id: user.id,
    }
    const { error } = editItem
      ? await (supabase as any).from('lancamentos').update(payload).eq('id', editItem.id)
      : await (supabase as any).from('lancamentos').insert(payload)
    if (error) { toast.error('Erro ao salvar lançamento'); return }
    toast.success(editItem ? 'Lançamento atualizado!' : 'Lançamento criado!')
    setModalOpen(false)
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await (supabase as any).from('lancamentos').delete().eq('id', deleteId)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Lançamento excluído'); fetchData() }
    setDeleteId(null)
    setDeleting(false)
  }

  const filtered = items.filter(i => {
    if (filterTipo !== 'todos' && i.tipo !== filterTipo) return false
    if (filterStatus !== 'todos' && i.status !== filterStatus) return false
    if (search && !i.descricao?.toLowerCase().includes(search.toLowerCase()) && !i.categoria?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalReceitas = filtered.filter(i => i.tipo === 'receita').reduce((s, i) => s + i.valor, 0)
  const totalDespesas = filtered.filter(i => i.tipo === 'despesa').reduce((s, i) => s + i.valor, 0)
  const pendentes = filtered.filter(i => i.status === 'pendente').length

  return (
    <AppLayout>
      <Topbar title="Lançamentos" subtitle="Todos os lançamentos financeiros">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Novo Lançamento
        </Button>
      </Topbar>

      <div className="p-6 space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar lançamento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 focus:border-[#0f172a] w-56"
          />
          <select
            value={filterTipo}
            onChange={e => setFilterTipo(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 appearance-none cursor-pointer"
          >
            <option value="todos">Todos os tipos</option>
            <option value="receita">Receitas</option>
            <option value="despesa">Despesas</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 appearance-none cursor-pointer"
          >
            <option value="todos">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="confirmado">Confirmado</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <div className="flex items-center bg-slate-50 rounded-lg p-0.5 gap-0.5">
            {PERIODO_OPTIONS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriodo(p.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  periodo === p.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total Lançamentos" value={String(filtered.length)} subtitle="no período" icon={LayoutList} />
          <MetricCard label="Receitas" value={formatShort(totalReceitas)} subtitle="entradas" icon={TrendingUp} trend="up" />
          <MetricCard label="Despesas" value={formatShort(totalDespesas)} subtitle="saídas" icon={TrendingDown} trend="down" />
          <MetricCard label="Pendentes" value={String(pendentes)} subtitle="aguardando confirmação" icon={Clock} />
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-white rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Nenhum lançamento encontrado" description="Crie receitas e despesas para controlar seu fluxo" action={{ label: 'Novo Lançamento', onClick: openCreate }} />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Descrição</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Categoria</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item: any, i: number) => (
                  <tr key={item.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === filtered.length - 1 ? 'border-b-0' : ''}`}>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(item.data)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{item.descricao || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{item.categoria || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={item.tipo === 'receita' ? 'success' : 'danger'}>
                        {item.tipo === 'receita' ? 'Receita' : 'Despesa'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={item.status === 'confirmado' ? 'success' : item.status === 'cancelado' ? 'danger' : 'warning'}>
                        {item.status === 'confirmado' ? 'Confirmado' : item.status === 'cancelado' ? 'Cancelado' : 'Pendente'}
                      </Badge>
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${item.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                      {item.tipo === 'receita' ? '+' : '-'}{formatBRL(item.valor)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? 'Editar Lançamento' : 'Novo Lançamento'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{editItem ? 'Salvar' : 'Criar'}</Button>
          </>
        }
      >
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo *" error={errors.tipo?.message} {...register('tipo')}>
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
            </Select>
            <Select label="Status *" error={errors.status?.message} {...register('status')}>
              <option value="pendente">Pendente</option>
              <option value="confirmado">Confirmado</option>
              <option value="cancelado">Cancelado</option>
            </Select>
          </div>
          <Input label="Descrição *" placeholder="Ex: Pagamento de aluguel..." error={errors.descricao?.message} {...register('descricao')} />
          <div className="grid grid-cols-2 gap-4">
            <CurrencyInput label="Valor (R$) *" value={watch("valor")} onChange={v => setValue("valor", v as any)} />
            <Input label="Data *" type="date" error={errors.data?.message} {...register('data')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Categoria" placeholder="Ex: Manutenção, Aluguel..." {...register('categoria')} />
            <Select label="Conta Bancária" {...register('conta_id')}>
              <option value="">Sem conta vinculada</option>
              {contas.map((c: any) => <option key={c.id} value={c.id}>{c.banco} — {c.conta}</option>)}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Notas</label>
            <textarea
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 focus:border-[#0f172a] resize-none"
              rows={3}
              placeholder="Observações adicionais..."
              {...register('notas')}
            />
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Excluir Lançamento"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Excluir</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">Tem certeza que deseja excluir este lançamento? Essa ação não pode ser desfeita.</p>
      </Modal>
    </AppLayout>
  )
}
