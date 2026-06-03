'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Users2, Percent, Building2 } from 'lucide-react'
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
import { usePortfolio } from '@/lib/portfolio-context'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  cpf: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  telefone: z.string().optional(),
  empresa_id: z.string().optional(),
  participacao: z.coerce.number().min(0).max(100).optional(),
  cargo: z.string().optional(),
  tipo: z.string().default('socio'),
  status: z.string().default('ativo'),
})

type FormData = z.infer<typeof schema>

const TIPOS = [
  { value: 'socio', label: 'Sócio' },
  { value: 'investidor', label: 'Investidor' },
  { value: 'administrador', label: 'Administrador' },
  { value: 'consultor', label: 'Consultor' },
]

export default function SociosPage() {
  
  const { activeOwnerId } = usePortfolio()
  const [socios, setSocios] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [empresaFilter, setEmpresaFilter] = useState('')

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'socio', status: 'ativo' },
  })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [s, e] = await Promise.all([
      (supabase as any).from('socios').select('*, empresas(nome)').order('nome'),
      (supabase as any).from('empresas').select('id, nome').eq('status', 'ativa'),
    ])
    setSocios(s.data || [])
    setEmpresas(e.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setEditing(null)
    reset({ tipo: 'socio', status: 'ativo' })
    setModalOpen(true)
  }

  const openEdit = (item: any) => {
    setEditing(item)
    reset({
      nome: item.nome,
      cpf: item.cpf || '',
      email: item.email || '',
      telefone: item.telefone || '',
      empresa_id: item.empresa_id || '',
      participacao: item.participacao || undefined,
      cargo: item.cargo || '',
      tipo: item.tipo,
      status: item.status,
    })
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = {
      ...data,
      cpf: data.cpf || null,
      email: data.email || null,
      telefone: data.telefone || null,
      empresa_id: data.empresa_id || null,
      cargo: data.cargo || null,
    }
    const { error } = editing
      ? await (supabase as any).from('socios').update(payload).eq('id', editing.id)
      : await (supabase as any).from('socios').insert({ ...payload, user_id: activeOwnerId })
    if (error) { toast.error(`Erro: ${error.message}`); console.error(error); return }
    toast.success(editing ? 'Sócio atualizado!' : 'Sócio cadastrado!')
    setModalOpen(false)
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const supabase = createClient()
    await (supabase as any).from('socios').delete().eq('id', deleteId)
    toast.success('Sócio excluído')
    setDeleteId(null)
    setDeleting(false)
    fetchData()
  }

  const filteredSocios = empresaFilter
    ? socios.filter(s => s.empresa_id === empresaFilter)
    : socios
  const ativos = filteredSocios.filter(s => s.status === 'ativo')
  const totalParticipacao = filteredSocios.reduce((s, p) => s + (p.participacao || 0), 0)

  const tipoConfig: Record<string, { label: string; variant: any }> = {
    socio: { label: 'Sócio', variant: 'info' },
    investidor: { label: 'Investidor', variant: 'success' },
    administrador: { label: 'Administrador', variant: 'warning' },
    consultor: { label: 'Consultor', variant: 'gray' },
  }

  return (
    <AppLayout>
      <Topbar title="Sócios" subtitle="Gestão de sócios e participações societárias">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Novo Sócio
        </Button>
      </Topbar>

      <div className="p-6 space-y-5">
        {/* Filtro por empresa */}
        <div className="flex items-center gap-3">
          <select
            value={empresaFilter}
            onChange={e => setEmpresaFilter(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          >
            <option value="">Todas as empresas</option>
            {empresas.map((e: any) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          {empresaFilter && (
            <button onClick={() => setEmpresaFilter('')} className="text-xs text-gray-400 hover:text-gray-600">
              Limpar filtro
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard label="Total de Sócios" value={String(socios.length)} subtitle="cadastrados" icon={Users2} />
          <MetricCard label="Sócios Ativos" value={String(ativos.length)} subtitle="em atividade" icon={Building2} />
          <MetricCard label="Participação Total" value={`${totalParticipacao.toFixed(1)}%`} subtitle="soma das cotas" icon={Percent} />
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-white rounded-xl animate-pulse" />)}</div>
        ) : filteredSocios.length === 0 ? (
          <EmptyState title="Nenhum sócio encontrado" action={{ label: 'Novo Sócio', onClick: openCreate }} />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Empresa</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Cargo</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Participação</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSocios.map((s: any, i: number) => {
                  const tc = tipoConfig[s.tipo] || tipoConfig.socio
                  return (
                    <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === filteredSocios.length - 1 ? 'border-b-0' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{s.nome}</p>
                        {s.email && <p className="text-[10px] text-gray-400">{s.email}</p>}
                      </td>
                      <td className="px-4 py-3"><Badge variant={tc.variant}>{tc.label}</Badge></td>
                      <td className="px-4 py-3 text-xs text-gray-500">{s.empresas?.nome || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{s.cargo || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {s.participacao != null ? `${s.participacao}%` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={s.status === 'ativo' ? 'success' : 'gray'}>
                          {s.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteId(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Sócio' : 'Novo Sócio'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{editing ? 'Salvar' : 'Cadastrar'}</Button>
          </>
        }
      >
        <form className="space-y-4">
          <Input label="Nome *" error={errors.nome?.message} {...register('nome')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="CPF" placeholder="000.000.000-00" {...register('cpf')} />
            <Input label="E-mail" type="email" error={errors.email?.message} {...register('email')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Telefone" placeholder="(00) 00000-0000" {...register('telefone')} />
            <Input label="Cargo" placeholder="Ex: Diretor, Sócio-Gerente..." {...register('cargo')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo" {...register('tipo')}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
            <Input label="Participação (%)" type="number" step="0.01" min="0" max="100" {...register('participacao')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Empresa" {...register('empresa_id')}>
              <option value="">Sem empresa vinculada</option>
              {empresas.map((e: any) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Select>
            <Select label="Status" {...register('status')}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </Select>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Excluir Sócio"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Excluir</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">Deseja excluir este sócio? Esta ação não pode ser desfeita.</p>
      </Modal>
    </AppLayout>
  )
}
