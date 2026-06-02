'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, FolderOpen, Pencil, Trash2, DollarSign, Users, User, X } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatBRL, formatDate } from '@/lib/utils'
import { CurrencyInput } from '@/components/ui/currency-input'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  descricao: z.string().optional(),
  valor_total: z.coerce.number().optional(),
  data_inicio: z.string().optional(),
  status: z.string().default('ativo'),
})

type FormData = z.infer<typeof schema>

const TIPO_LABELS: Record<string, string> = {
  capital_proprio: 'Capital Próprio',
  financiamento:   'Financiamento',
  misto:           'Misto',
  aporte_socio:    'Aporte de Sócio',
}

export default function ProjetosListaPage() {
  const [projetos, setProjetos]       = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState<any | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [deleting, setDeleting]       = useState(false)
  const [totalAportado, setTotalAportado] = useState<Record<string, number>>({})

  // Detail modal
  const [detailOpen, setDetailOpen]     = useState(false)
  const [detailProjeto, setDetailProjeto] = useState<any | null>(null)
  const [detailAportes, setDetailAportes] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'ativo' },
  })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [{ data }, { data: ap }] = await Promise.all([
      supabase.from('projetos').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('aportes').select('projeto_id, valor').not('projeto_id', 'is', null),
    ])
    const sums: Record<string, number> = {}
    for (const a of ap || []) {
      if (a.projeto_id) sums[a.projeto_id] = (sums[a.projeto_id] || 0) + (a.valor || 0)
    }
    setTotalAportado(sums)
    setProjetos(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openDetail = async (p: any) => {
    setDetailProjeto(p)
    setDetailOpen(true)
    setDetailLoading(true)
    const supabase = createClient()
    const { data } = await (supabase as any)
      .from('aportes')
      .select('*')
      .eq('projeto_id', p.id)
      .order('data', { ascending: false })
    setDetailAportes(data || [])
    setDetailLoading(false)
  }

  const openEdit = (e: React.MouseEvent, item: any) => {
    e.stopPropagation()
    setEditing(item)
    reset({
      nome: item.nome,
      descricao: item.descricao || '',
      valor_total: item.valor_total || undefined,
      data_inicio: item.data_inicio || '',
      status: item.status,
    })
    setModalOpen(true)
  }

  const openNew = () => {
    setEditing(null)
    reset({ status: 'ativo' })
    setModalOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('projetos').delete().eq('id', deletingId)
    if (error) { toast.error('Erro ao excluir projeto'); setDeleting(false); return }
    toast.success('Projeto excluído!')
    setDeletingId(null)
    setDeleting(false)
    fetchData()
  }

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (editing) {
      const { error } = await supabase.from('projetos').update(data).eq('id', editing.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('Projeto atualizado!')
    } else {
      const { error } = await supabase.from('projetos').insert({ ...data, user_id: user.id })
      if (error) { toast.error('Erro ao criar'); return }
      toast.success('Projeto criado!')
    }

    setModalOpen(false)
    fetchData()
  }

  // Detail metrics
  const totalGeral = detailAportes.reduce((s, a) => s + (a.valor || 0), 0)
  const totalSocios = detailAportes.filter(a => a.tipo === 'aporte_socio').reduce((s, a) => s + (a.valor || 0), 0)
  const totalMeu    = detailAportes.filter(a => a.tipo !== 'aporte_socio').reduce((s, a) => s + (a.valor || 0), 0)

  return (
    <AppLayout>
      <Topbar title="Projetos" subtitle="Gestão de projetos e investimentos">
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4" /> Novo Projeto
        </Button>
      </Topbar>

      <div className="p-6 space-y-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-40 bg-white rounded-xl animate-pulse" />)}
          </div>
        ) : projetos.length === 0 ? (
          <EmptyState icon={FolderOpen} title="Nenhum projeto" action={{ label: 'Novo Projeto', onClick: openNew }} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projetos.map((p: any) => (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-black/[0.08] p-5 flex flex-col gap-3 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => openDetail(p)}
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                    <FolderOpen className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={p.status === 'ativo' ? 'success' : p.status === 'encerrado' ? 'gray' : 'warning'}>
                      {p.status}
                    </Badge>
                    <button
                      onClick={e => openEdit(e, p)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Editar projeto"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeletingId(p.id) }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="Excluir projeto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{p.nome}</p>
                  {p.descricao && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.descricao}</p>}
                </div>
                <div className="border-t border-gray-50 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Valor Previsto</p>
                      <p className="text-sm font-bold text-gray-900">{p.valor_total ? formatBRL(p.valor_total) : '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-purple-400">Total Aportado</p>
                      <p className="text-sm font-bold text-purple-600">{formatBRL(totalAportado[p.id] || 0)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Início: {formatDate(p.data_inicio)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal Detalhes do Projeto ── */}
      {detailOpen && detailProjeto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-8">

            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                    <FolderOpen className="h-4 w-4 text-purple-500" />
                  </div>
                  <Badge variant={detailProjeto.status === 'ativo' ? 'success' : detailProjeto.status === 'encerrado' ? 'gray' : 'warning'}>
                    {detailProjeto.status}
                  </Badge>
                </div>
                <h2 className="text-lg font-bold text-gray-900">{detailProjeto.nome}</h2>
                {detailProjeto.descricao && <p className="text-xs text-gray-400 mt-0.5">{detailProjeto.descricao}</p>}
              </div>
              <button
                onClick={() => setDetailOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-gray-50/50 border-b border-gray-100">
              <div className="bg-white rounded-xl border border-black/[0.06] p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <DollarSign className="h-3.5 w-3.5 text-purple-500" />
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Total Aportado</p>
                </div>
                <p className="text-base font-bold text-purple-600">{formatBRL(totalGeral)}</p>
              </div>
              <div className="bg-white rounded-xl border border-black/[0.06] p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <User className="h-3.5 w-3.5 text-blue-500" />
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Meu Total</p>
                </div>
                <p className="text-base font-bold text-blue-600">{formatBRL(totalMeu)}</p>
                {totalGeral > 0 && <p className="text-[10px] text-gray-400">{((totalMeu / totalGeral) * 100).toFixed(0)}% do total</p>}
              </div>
              <div className="bg-white rounded-xl border border-black/[0.06] p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Users className="h-3.5 w-3.5 text-green-500" />
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Total Sócios</p>
                </div>
                <p className="text-base font-bold text-green-600">{formatBRL(totalSocios)}</p>
                {totalGeral > 0 && <p className="text-[10px] text-gray-400">{((totalSocios / totalGeral) * 100).toFixed(0)}% do total</p>}
              </div>
            </div>

            {/* Lista de aportes */}
            <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Aportes ({detailAportes.length})
              </p>

              {detailLoading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
                </div>
              ) : detailAportes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Nenhum aporte registrado para este projeto.</p>
              ) : (
                <div className="space-y-2">
                  {detailAportes.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${a.tipo === 'aporte_socio' ? 'bg-green-100' : 'bg-blue-100'}`}>
                          {a.tipo === 'aporte_socio'
                            ? <Users className="h-3.5 w-3.5 text-green-600" />
                            : <User className="h-3.5 w-3.5 text-blue-600" />
                          }
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-900">
                            {a.tipo === 'aporte_socio' ? `Sócio${a.socio_nome ? ` — ${a.socio_nome}` : ''}` : TIPO_LABELS[a.tipo] || a.tipo}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {formatDate(a.data)}{a.descricao ? ` · ${a.descricao}` : ''}{a.banco ? ` · ${a.banco}` : ''}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-gray-900 flex-shrink-0">{formatBRL(a.valor)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
              <p className="text-xs text-gray-400">
                {detailProjeto.valor_total
                  ? `Previsto: ${formatBRL(detailProjeto.valor_total)} · Aportado: ${((totalGeral / detailProjeto.valor_total) * 100).toFixed(0)}%`
                  : `Início: ${formatDate(detailProjeto.data_inicio)}`
                }
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); openEdit({ stopPropagation: () => {} } as any, detailProjeto) }}>
                  <Pencil className="h-3.5 w-3.5" /> Editar Projeto
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>Fechar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmar Exclusão ── */}
      <Modal
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Excluir Projeto"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Excluir</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Tem certeza que deseja excluir este projeto? Os aportes vinculados <strong>não serão excluídos</strong>, apenas o projeto.
        </p>
      </Modal>

      {/* ── Modal Editar/Criar Projeto ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Projeto' : 'Novo Projeto'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{editing ? 'Salvar' : 'Criar'}</Button>
          </>
        }
      >
        <form className="space-y-4">
          <Input label="Nome *" error={errors.nome?.message} {...register('nome')} />
          <Input label="Descrição" {...register('descricao')} />
          <CurrencyInput label="Valor Total (R$)" value={watch("valor_total")} onChange={v => setValue("valor_total", v as any)} />
          <Input label="Data de Início" type="date" {...register('data_inicio')} />
          <Select label="Status" {...register('status')}>
            <option value="ativo">Ativo</option>
            <option value="pausado">Pausado</option>
            <option value="encerrado">Encerrado</option>
          </Select>
        </form>
      </Modal>
    </AppLayout>
  )
}
