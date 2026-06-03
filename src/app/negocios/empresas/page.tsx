'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Building2, Search, X, Pencil, Trash2, Globe, Users2, Percent } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatBRL, formatShort } from '@/lib/utils'
import { usePortfolio } from '@/lib/portfolio-context'
import { createClient } from '@/lib/supabase/client'

const FASES = [
  { value: 'captacao', label: 'Captação' },
  { value: 'analise', label: 'Análise' },
  { value: 'aprovacao', label: 'Aprovação' },
  { value: 'em_execucao', label: 'Em Execução' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
]

const STATUS_LIST = [
  { value: 'ativa', label: 'Ativa' },
  { value: 'inativa', label: 'Inativa' },
  { value: 'em_negociacao', label: 'Em Negociação' },
]

const FASE_VARIANT: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'gray'> = {
  captacao: 'info',
  analise: 'warning',
  aprovacao: 'warning',
  em_execucao: 'success',
  concluido: 'success',
  cancelado: 'danger',
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'gray' | 'danger' | 'info'> = {
  ativa: 'success',
  inativa: 'gray',
  em_negociacao: 'warning',
}

function formatCNPJ(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

const schema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  cnpj: z.string().optional(),
  setor: z.string().optional(),
  status: z.string().default('ativa'),
  fase: z.string().default('captacao'),
  valor_investimento: z.coerce.number().min(0).optional(),
  valor_retorno: z.coerce.number().min(0).optional(),
  descricao: z.string().optional(),
  website: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function EmpresasPage() {
  
  const { activeOwnerId } = usePortfolio()
  const [empresas, setEmpresas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFase, setFilterFase] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState<any | null>(null)
  const [editing, setEditing] = useState<any | null>(null)
  const [cnpjDisplay, setCnpjDisplay] = useState('')

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailEmpresa, setDetailEmpresa] = useState<any | null>(null)
  const [detailSocios, setDetailSocios] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'ativa', fase: 'captacao' },
  })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data } = await (supabase as any)
      .from('empresas')
      .select('*')
      .order('created_at', { ascending: false })
    setEmpresas(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openModal = (item?: any) => {
    if (item) {
      setEditing(item)
      setCnpjDisplay(item.cnpj ? formatCNPJ(item.cnpj) : '')
      reset({
        nome: item.nome,
        cnpj: item.cnpj || '',
        setor: item.setor || '',
        status: item.status || 'ativa',
        fase: item.fase || 'captacao',
        valor_investimento: item.valor_investimento ?? undefined,
        valor_retorno: item.valor_retorno ?? undefined,
        descricao: item.descricao || '',
        website: item.website || '',
      })
    } else {
      setEditing(null)
      setCnpjDisplay('')
      reset({ status: 'ativa', fase: 'captacao' })
    }
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      ...data,
      cnpj: data.cnpj?.replace(/\D/g, '') || null,
      valor_investimento: data.valor_investimento || null,
      valor_retorno: data.valor_retorno || null,
    }

    if (editing) {
      const { error } = await (supabase as any).from('empresas').update(payload).eq('id', editing.id)
      if (error) { toast.error('Erro ao atualizar empresa'); return }
      toast.success('Empresa atualizada com sucesso!')
    } else {
      const { error } = await (supabase as any).from('empresas').insert({ ...payload, user_id: activeOwnerId })
      if (error) { toast.error('Erro ao criar empresa'); return }
      toast.success('Empresa criada com sucesso!')
    }

    setModalOpen(false)
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteModal) return
    const supabase = createClient()
    const { error } = await (supabase as any).from('empresas').delete().eq('id', deleteModal.id)
    if (error) { toast.error('Erro ao excluir empresa'); return }
    toast.success('Empresa excluída!')
    setDeleteModal(null)
    fetchData()
  }

  const filtered = empresas.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q || e.nome?.toLowerCase().includes(q) || e.cnpj?.includes(q) || e.setor?.toLowerCase().includes(q)
    const matchStatus = !filterStatus || e.status === filterStatus
    const matchFase = !filterFase || e.fase === filterFase
    return matchSearch && matchStatus && matchFase
  })

  const openDetail = async (emp: any) => {
    setDetailEmpresa(emp)
    setDetailOpen(true)
    setDetailLoading(true)
    const supabase = createClient()
    const { data } = await (supabase as any)
      .from('socios')
      .select('*')
      .eq('empresa_id', emp.id)
      .order('participacao', { ascending: false })
    setDetailSocios(data || [])
    setDetailLoading(false)
  }

  const calcROI = (inv?: number, ret?: number) => {
    if (!inv || !ret || inv === 0) return null
    return (((ret - inv) / inv) * 100).toFixed(1)
  }

  return (
    <AppLayout>
      <Topbar title="Empresas" subtitle="Gestão de empresas do portfólio">
        <Button size="sm" onClick={() => openModal()}>
          <Plus className="h-4 w-4" /> Nova Empresa
        </Button>
      </Topbar>

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar empresa, CNPJ, setor..."
              className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          >
            <option value="">Todos os status</option>
            {STATUS_LIST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select
            value={filterFase}
            onChange={e => setFilterFase(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          >
            <option value="">Todas as fases</option>
            {FASES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          {(search || filterStatus || filterFase) && (
            <button
              onClick={() => { setSearch(''); setFilterStatus(''); setFilterFase('') }}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-14 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nenhuma empresa encontrada"
            action={{ label: 'Nova Empresa', onClick: () => openModal() }}
          />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Empresa</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">CNPJ</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Setor</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fase</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Investimento</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Retorno</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ROI</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((emp) => {
                    const roi = calcROI(emp.valor_investimento, emp.valor_retorno)
                    const cnpjFmt = emp.cnpj ? formatCNPJ(emp.cnpj) : '—'
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer" onClick={() => openDetail(emp)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <Building2 className="h-3.5 w-3.5 text-slate-500" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{emp.nome}</p>
                              {emp.website && (
                                <a
                                  href={emp.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <Globe className="h-2.5 w-2.5" /> {emp.website.replace(/^https?:\/\//, '')}
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cnpjFmt}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{emp.setor || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={FASE_VARIANT[emp.fase] || 'gray'}>
                            {FASES.find(f => f.value === emp.fase)?.label || emp.fase}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_VARIANT[emp.status] || 'gray'}>
                            {STATUS_LIST.find(s => s.value === emp.status)?.label || emp.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 font-medium">
                          {emp.valor_investimento ? formatShort(emp.valor_investimento) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 font-medium">
                          {emp.valor_retorno ? formatShort(emp.valor_retorno) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {roi !== null ? (
                            <span className={`text-xs font-bold ${Number(roi) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {roi}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={e => { e.stopPropagation(); openModal(emp) }}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setDeleteModal(emp) }}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                            >
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
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/40">
              <p className="text-xs text-gray-400">{filtered.length} empresa{filtered.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailOpen && detailEmpresa && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-8">

            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{detailEmpresa.nome}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    {detailEmpresa.setor && <span className="text-xs text-gray-400">{detailEmpresa.setor}</span>}
                    {detailEmpresa.cnpj && <span className="text-xs text-gray-400 font-mono">{formatCNPJ(detailEmpresa.cnpj)}</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => setDetailOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-3 px-6 py-4 bg-gray-50/50 border-b border-gray-100">
              <div className="text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Sócios</p>
                <p className="text-lg font-bold text-gray-900">{detailSocios.length}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">% Total</p>
                <p className="text-lg font-bold text-gray-900">
                  {detailSocios.reduce((s, a) => s + (a.participacao || 0), 0).toFixed(1)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Disponível</p>
                <p className="text-lg font-bold text-green-600">
                  {Math.max(0, 100 - detailSocios.reduce((s, a) => s + (a.participacao || 0), 0)).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Lista de sócios */}
            <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Participação Societária
              </p>
              {detailLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
              ) : detailSocios.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Nenhum sócio cadastrado nesta empresa.</p>
              ) : (
                <div className="space-y-2">
                  {detailSocios.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 text-sm">
                          {s.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{s.nome}</p>
                          <p className="text-[10px] text-gray-400">
                            {s.tipo === 'socio' ? 'Sócio' : s.tipo === 'investidor' ? 'Investidor' : s.tipo === 'administrador' ? 'Administrador' : 'Consultor'}
                            {s.cargo ? ` · ${s.cargo}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-gray-900">{s.participacao != null ? `${s.participacao}%` : '—'}</p>
                        {detailEmpresa.valor_investimento && s.participacao && (
                          <p className="text-[10px] text-gray-400">
                            {formatBRL(detailEmpresa.valor_investimento * s.participacao / 100)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
              <button
                onClick={() => { setDetailOpen(false); openModal(detailEmpresa) }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar Empresa
              </button>
              <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>Fechar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Empresa' : 'Nova Empresa'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
              {editing ? 'Salvar alterações' : 'Criar empresa'}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Nome da Empresa *" error={errors.nome?.message} {...register('nome')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
              <input
                value={cnpjDisplay}
                onChange={e => {
                  const fmt = formatCNPJ(e.target.value)
                  setCnpjDisplay(fmt)
                  setValue('cnpj', fmt.replace(/\D/g, ''))
                }}
                placeholder="00.000.000/0000-00"
                className="w-full h-9 rounded-lg border border-gray-200 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900"
              />
            </div>
            <Input label="Setor" placeholder="Ex: Tecnologia, Agro..." {...register('setor')} />
            <Select label="Status" {...register('status')}>
              {STATUS_LIST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            <Select label="Fase" {...register('fase')}>
              {FASES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
            <Input
              label="Valor de Investimento (R$)"
              type="number"
              step="0.01"
              placeholder="0,00"
              {...register('valor_investimento')}
            />
            <Input
              label="Valor de Retorno (R$)"
              type="number"
              step="0.01"
              placeholder="0,00"
              {...register('valor_retorno')}
            />
            <div className="col-span-2">
              <Input label="Website" placeholder="https://..." {...register('website')} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <textarea
                rows={3}
                placeholder="Descreva a empresa..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 resize-none"
                {...register('descricao')}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Excluir Empresa"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteModal(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Excluir</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Tem certeza que deseja excluir <strong>{deleteModal?.nome}</strong>? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </AppLayout>
  )
}
