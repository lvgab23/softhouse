'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, CheckSquare, AlertTriangle, Clock, Shield } from 'lucide-react'
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
import { formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  titulo: z.string().min(1, 'Título obrigatório'),
  descricao: z.string().optional(),
  empresa_id: z.string().optional(),
  categoria: z.string().default('legal'),
  status: z.string().default('pendente'),
  prioridade: z.string().default('media'),
  data_vencimento: z.string().optional(),
  responsavel: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const CATEGORIAS = [
  { value: 'legal', label: 'Legal' },
  { value: 'fiscal', label: 'Fiscal' },
  { value: 'trabalhista', label: 'Trabalhista' },
  { value: 'ambiental', label: 'Ambiental' },
  { value: 'regulatorio', label: 'Regulatório' },
  { value: 'interno', label: 'Interno' },
]

const PRIORIDADES = [
  { value: 'alta', label: 'Alta', variant: 'danger' as const },
  { value: 'media', label: 'Média', variant: 'warning' as const },
  { value: 'baixa', label: 'Baixa', variant: 'success' as const },
]

const STATUS_CONF: Record<string, { label: string; variant: any; icon: any }> = {
  pendente: { label: 'Pendente', variant: 'warning', icon: Clock },
  em_andamento: { label: 'Em Andamento', variant: 'info', icon: AlertTriangle },
  concluido: { label: 'Concluído', variant: 'success', icon: CheckSquare },
  vencido: { label: 'Vencido', variant: 'danger', icon: AlertTriangle },
}

export default function CompliancePage() {
  const [items, setItems] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [filterStatus, setFilterStatus] = useState('todos')

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { categoria: 'legal', status: 'pendente', prioridade: 'media' },
  })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [c, e] = await Promise.all([
      (supabase as any).from('compliance').select('*, empresas(nome)').order('data_vencimento', { ascending: true }),
      (supabase as any).from('empresas').select('id, nome'),
    ])
    setItems(c.data || [])
    setEmpresas(e.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setEditing(null)
    reset({ categoria: 'legal', status: 'pendente', prioridade: 'media' })
    setModalOpen(true)
  }

  const openEdit = (item: any) => {
    setEditing(item)
    reset({
      titulo: item.titulo,
      descricao: item.descricao || '',
      empresa_id: item.empresa_id || '',
      categoria: item.categoria,
      status: item.status,
      prioridade: item.prioridade,
      data_vencimento: item.data_vencimento || '',
      responsavel: item.responsavel || '',
    })
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = {
      ...data,
      empresa_id: data.empresa_id || null,
      descricao: data.descricao || null,
      data_vencimento: data.data_vencimento || null,
      responsavel: data.responsavel || null,
    }
    const { error } = editing
      ? await (supabase as any).from('compliance').update(payload).eq('id', editing.id)
      : await (supabase as any).from('compliance').insert({ ...payload, user_id: user.id })
    if (error) { toast.error('Erro ao salvar'); return }
    toast.success(editing ? 'Item atualizado!' : 'Item criado!')
    setModalOpen(false)
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const supabase = createClient()
    await (supabase as any).from('compliance').delete().eq('id', deleteId)
    toast.success('Item excluído')
    setDeleteId(null)
    setDeleting(false)
    fetchData()
  }

  const filtered = filterStatus === 'todos' ? items : items.filter(i => i.status === filterStatus)
  const pendentes = items.filter(i => i.status === 'pendente').length
  const vencidos = items.filter(i => i.status === 'vencido').length
  const concluidos = items.filter(i => i.status === 'concluido').length

  return (
    <AppLayout>
      <Topbar title="Compliance" subtitle="Controle de obrigações legais e regulatórias">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nova Obrigação
        </Button>
      </Topbar>

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total" value={String(items.length)} subtitle="obrigações" icon={Shield} />
          <MetricCard label="Pendentes" value={String(pendentes)} subtitle="aguardando ação" icon={Clock} />
          <MetricCard label="Vencidos" value={String(vencidos)} subtitle="atenção necessária" icon={AlertTriangle} />
          <MetricCard label="Concluídos" value={String(concluidos)} subtitle="finalizados" icon={CheckSquare} />
        </div>

        <div className="flex items-center gap-2">
          {['todos', 'pendente', 'em_andamento', 'concluido', 'vencido'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-[#0f172a] text-white'
                  : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === 'todos' ? 'Todos' : STATUS_CONF[s]?.label || s}
            </button>
          ))}
          <span className="text-xs text-gray-400 ml-2">{filtered.length} item(s)</span>
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Nenhuma obrigação encontrada" action={{ label: 'Nova Obrigação', onClick: openCreate }} />
        ) : (
          <div className="space-y-2">
            {filtered.map((item: any) => {
              const sc = STATUS_CONF[item.status] || STATUS_CONF.pendente
              const pr = PRIORIDADES.find(p => p.value === item.prioridade) || PRIORIDADES[1]
              const isVencido = item.data_vencimento && new Date(item.data_vencimento) < new Date() && item.status !== 'concluido'
              return (
                <div key={item.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 hover:shadow-sm transition-shadow ${isVencido ? 'border-red-100' : 'border-black/[0.07]'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.status === 'concluido' ? 'bg-green-50' : isVencido ? 'bg-red-50' : 'bg-yellow-50'
                  }`}>
                    <sc.icon className={`h-4 w-4 ${
                      item.status === 'concluido' ? 'text-green-500' : isVencido ? 'text-red-500' : 'text-yellow-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{item.titulo}</p>
                      <Badge variant={sc.variant}>{sc.label}</Badge>
                      <Badge variant={pr.variant}>{pr.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {item.empresas?.nome && <span className="text-xs text-gray-400">{item.empresas.nome}</span>}
                      {item.responsavel && <span className="text-xs text-gray-400">· {item.responsavel}</span>}
                      {item.categoria && <span className="text-xs text-gray-400">· {CATEGORIAS.find(c => c.value === item.categoria)?.label || item.categoria}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {item.data_vencimento && (
                      <p className={`text-xs font-medium ${isVencido ? 'text-red-500' : 'text-gray-500'}`}>
                        {isVencido ? 'Venceu em' : 'Vence em'}
                      </p>
                    )}
                    {item.data_vencimento && (
                      <p className={`text-xs ${isVencido ? 'text-red-500 font-bold' : 'text-gray-700'}`}>
                        {formatDate(item.data_vencimento)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Obrigação' : 'Nova Obrigação de Compliance'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{editing ? 'Salvar' : 'Criar'}</Button>
          </>
        }
      >
        <form className="space-y-4">
          <Input label="Título *" placeholder="Ex: Renovação de alvará municipal..." error={errors.titulo?.message} {...register('titulo')} />
          <Input label="Descrição" placeholder="Detalhes sobre a obrigação..." {...register('descricao')} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Categoria" {...register('categoria')}>
              {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
            <Select label="Empresa" {...register('empresa_id')}>
              <option value="">Sem empresa vinculada</option>
              {empresas.map((e: any) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Status" {...register('status')}>
              <option value="pendente">Pendente</option>
              <option value="em_andamento">Em Andamento</option>
              <option value="concluido">Concluído</option>
              <option value="vencido">Vencido</option>
            </Select>
            <Select label="Prioridade" {...register('prioridade')}>
              {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data de Vencimento" type="date" {...register('data_vencimento')} />
            <Input label="Responsável" placeholder="Nome do responsável..." {...register('responsavel')} />
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Excluir Obrigação"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Excluir</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">Deseja excluir esta obrigação de compliance? Esta ação não pode ser desfeita.</p>
      </Modal>
    </AppLayout>
  )
}
