'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, TrendingUp, CheckCircle, Clock, BarChart2 } from 'lucide-react'
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
  descricao: z.string().min(1, 'Descrição obrigatória'),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  data: z.string().min(1, 'Data obrigatória'),
  categoria: z.string().optional(),
  conta_id: z.string().optional(),
  status: z.enum(['pendente', 'confirmado', 'cancelado']),
})

type FormData = z.infer<typeof schema>

const PERIODO_OPTIONS = [
  { label: 'Hoje', value: 'hoje' },
  { label: 'Semana', value: 'semana' },
  { label: 'Mês', value: 'mes' },
  { label: 'Trimestre', value: 'trimestre' },
  { label: 'Ano', value: 'ano' },
]

function getPeriodDates(periodo: string): { inicio: string; fim: string } {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  if (periodo === 'hoje') return { inicio: fmt(now), fim: fmt(now) }
  if (periodo === 'semana') {
    const day = now.getDay()
    const start = new Date(now); start.setDate(now.getDate() - day)
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return { inicio: fmt(start), fim: fmt(end) }
  }
  if (periodo === 'mes') {
    return { inicio: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), fim: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
  }
  if (periodo === 'trimestre') {
    const q = Math.floor(now.getMonth() / 3)
    return { inicio: fmt(new Date(now.getFullYear(), q * 3, 1)), fim: fmt(new Date(now.getFullYear(), q * 3 + 3, 0)) }
  }
  // ano
  return { inicio: fmt(new Date(now.getFullYear(), 0, 1)), fim: fmt(new Date(now.getFullYear(), 11, 31)) }
}

export default function RecebimentosPage() {
  const [items, setItems] = useState<any[]>([])
  const [contas, setContas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [periodo, setPeriodo] = useState('mes')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'pendente', data: new Date().toISOString().split('T')[0] },
  })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { inicio, fim } = getPeriodDates(periodo)
    const [r, c] = await Promise.all([
      (supabase as any).from('lancamentos').select('*').eq('tipo', 'receita').gte('data', inicio).lte('data', fim).order('data', { ascending: false }),
      (supabase as any).from('contas_bancarias').select('id, banco, conta').eq('ativo', true),
    ])
    setItems(r.data || [])
    setContas(c.data || [])
    setLoading(false)
  }, [periodo])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setEditItem(null)
    reset({ status: 'pendente', data: new Date().toISOString().split('T')[0] })
    setModalOpen(true)
  }

  const openEdit = (item: any) => {
    setEditItem(item)
    reset({
      descricao: item.descricao,
      valor: item.valor,
      data: item.data,
      categoria: item.categoria || '',
      conta_id: item.conta_id || '',
      status: item.status,
    })
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = { ...data, tipo: 'receita', conta_id: data.conta_id || null, categoria: data.categoria || null, user_id: user.id }
    const { error } = editItem
      ? await (supabase as any).from('lancamentos').update(payload).eq('id', editItem.id)
      : await (supabase as any).from('lancamentos').insert(payload)
    if (error) { toast.error('Erro ao salvar recebimento'); return }
    toast.success(editItem ? 'Recebimento atualizado!' : 'Recebimento criado!')
    setModalOpen(false)
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await (supabase as any).from('lancamentos').delete().eq('id', deleteId)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Recebimento excluído'); fetchData() }
    setDeleteId(null)
    setDeleting(false)
  }

  const filtered = items.filter(i =>
    !search || i.descricao?.toLowerCase().includes(search.toLowerCase()) || i.categoria?.toLowerCase().includes(search.toLowerCase())
  )

  const totalRecebido = filtered.reduce((s, i) => s + i.valor, 0)
  const confirmados = filtered.filter(i => i.status === 'confirmado').reduce((s, i) => s + i.valor, 0)
  const pendentes = filtered.filter(i => i.status === 'pendente').reduce((s, i) => s + i.valor, 0)
  const media = filtered.length > 0 ? totalRecebido / filtered.length : 0

  return (
    <AppLayout>
      <Topbar title="Recebimentos" subtitle="Controle de receitas e entradas">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Novo Recebimento
        </Button>
      </Topbar>

      <div className="p-6 space-y-5">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar recebimento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 focus:border-[#0f172a] w-64"
          />
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
          <MetricCard label="Total Recebido" value={formatShort(totalRecebido)} subtitle="no período" icon={TrendingUp} trend="up" />
          <MetricCard label="Confirmados" value={formatShort(confirmados)} subtitle="recebidos" icon={CheckCircle} />
          <MetricCard label="Pendentes" value={formatShort(pendentes)} subtitle="a receber" icon={Clock} />
          <MetricCard label="Média por Lançamento" value={formatShort(media)} subtitle={`${filtered.length} lançamentos`} icon={BarChart2} />
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-white rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Nenhum recebimento encontrado" description="Registre suas receitas e entradas" action={{ label: 'Novo Recebimento', onClick: openCreate }} />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Descrição</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Categoria</th>
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
                      <Badge variant={item.status === 'confirmado' ? 'success' : item.status === 'cancelado' ? 'danger' : 'warning'}>
                        {item.status === 'confirmado' ? 'Confirmado' : item.status === 'cancelado' ? 'Cancelado' : 'Pendente'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">+{formatBRL(item.valor)}</td>
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
        title={editItem ? 'Editar Recebimento' : 'Novo Recebimento'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{editItem ? 'Salvar' : 'Criar'}</Button>
          </>
        }
      >
        <form className="space-y-4">
          <Input label="Descrição *" placeholder="Ex: Aluguel recebido..." error={errors.descricao?.message} {...register('descricao')} />
          <CurrencyInput label="Valor (R$) *" value={watch("valor")} onChange={v => setValue("valor", v as any)} />
          <Input label="Data *" type="date" error={errors.data?.message} {...register('data')} />
          <Input label="Categoria" placeholder="Ex: Aluguel, Dividendos..." {...register('categoria')} />
          <Select label="Conta Bancária" {...register('conta_id')}>
            <option value="">Sem conta vinculada</option>
            {contas.map((c: any) => <option key={c.id} value={c.id}>{c.banco} — {c.conta}</option>)}
          </Select>
          <Select label="Status *" error={errors.status?.message} {...register('status')}>
            <option value="pendente">Pendente</option>
            <option value="confirmado">Confirmado</option>
            <option value="cancelado">Cancelado</option>
          </Select>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Excluir Recebimento"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Excluir</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">Tem certeza que deseja excluir este recebimento? Essa ação não pode ser desfeita.</p>
      </Modal>
    </AppLayout>
  )
}
