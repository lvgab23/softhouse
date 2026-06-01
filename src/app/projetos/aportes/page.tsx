'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, ChevronDown, Trash2, User, Users, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { MetricCard } from '@/components/ui/metric-card'
import { formatBRL, formatDate, formatShort } from '@/lib/utils'
import { CurrencyInput } from '@/components/ui/currency-input'
import { createClient } from '@/lib/supabase/client'
import { DollarSign, FolderOpen } from 'lucide-react'

const TIPOS = [
  { value: 'capital_proprio', label: 'Capital Próprio' },
  { value: 'financiamento', label: 'Financiamento' },
  { value: 'misto', label: 'Misto' },
  { value: 'aporte_socio', label: 'Aporte de Sócio' },
]

const BANCOS = [
  'Banco do Brasil', 'Caixa Econômica Federal', 'Bradesco', 'Itaú', 'Santander',
  'Nubank', 'Inter', 'C6 Bank', 'BTG Pactual', 'Sicredi', 'Banrisul', 'Outro',
]

const PERIODS = [
  { value: 'todos', label: 'Todo período' },
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'mes', label: 'Este mês' },
  { value: 'ano', label: 'Este ano' },
]

const VINCULO_TIPOS = [
  { value: 'projeto',   label: 'Projeto' },
  { value: 'imovel',    label: 'Imóvel' },
  { value: 'bem_movel', label: 'Bem Móvel' },
]

const schema = z.object({
  vinculo_tipo: z.enum(['projeto', 'imovel', 'bem_movel']).default('projeto'),
  projeto_id: z.string().optional(),
  patrimonio_id: z.string().optional(),
  bem_movel_id: z.string().optional(),
  valor: z.number().positive('Valor deve ser positivo'),
  data: z.string().min(1, 'Data obrigatória'),
  tipo: z.string().default('capital_proprio'),
  socio_nome: z.string().optional(),
  banco: z.string().optional(),
  descricao: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const TIPO_CONFIG: Record<string, { label: string; variant: any; isSocio?: boolean }> = {
  capital_proprio: { label: 'Capital Próprio', variant: 'info' },
  financiamento: { label: 'Financiamento', variant: 'warning' },
  misto: { label: 'Misto', variant: 'gray' },
  aporte_socio: { label: 'Aporte de Sócio', variant: 'purple', isSocio: true },
}

export default function AportesPage() {
  const [aportes, setAportes] = useState<any[]>([])
  const [projetos, setProjetos] = useState<any[]>([])
  const [patrimonios, setPatrimonios] = useState<any[]>([])
  const [bensMoveis, setBensMoveis] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState('todos')
  const [projetoFilter, setProjetoFilter] = useState('todos')
  const [periodoFilter, setPeriodoFilter] = useState('todos')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editing, setEditing] = useState<any | null>(null)
  const [needsSocioMigration, setNeedsSocioMigration] = useState(false)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { data: new Date().toISOString().split('T')[0], tipo: 'capital_proprio', vinculo_tipo: 'projeto' },
  })

  const tipoAtual = watch('tipo')
  const vinculoTipo = watch('vinculo_tipo')

  // Reseta o formulário sempre que o item em edição muda
  useEffect(() => {
    if (editing) {
      const vt = editing.projeto_id ? 'projeto' : editing.patrimonio_id ? 'imovel' : 'bem_movel'
      reset({
        vinculo_tipo: vt,
        projeto_id: editing.projeto_id || '',
        patrimonio_id: editing.patrimonio_id || '',
        bem_movel_id: editing.bem_movel_id || '',
        valor: editing.valor,
        data: editing.data,
        tipo: editing.tipo,
        socio_nome: editing.socio_nome || '',
        banco: editing.banco || '',
        descricao: editing.descricao || '',
      })
    } else {
      reset({ data: new Date().toISOString().split('T')[0], tipo: 'capital_proprio', vinculo_tipo: 'projeto' })
    }
  }, [editing, reset])

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [a, p, pat, bm] = await Promise.all([
      supabase.from('aportes')
        .select('*, projetos(nome), patrimonios(nome), bens_moveis(nome)')
        .order('data', { ascending: false }),
      supabase.from('projetos').select('id, nome').order('nome'),
      (supabase as any).from('patrimonios').select('id, nome').order('nome'),
      (supabase as any).from('bens_moveis').select('id, nome').order('nome'),
    ])
    const items = a.data || []
    if (items.length > 0 && !('socio_nome' in items[0])) setNeedsSocioMigration(true)
    setAportes(items)
    setProjetos(p.data || [])
    setPatrimonios(pat.data || [])
    setBensMoveis(bm.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => {
    let items = aportes
    if (projetoFilter !== 'todos') items = items.filter(a => a.projeto_id === projetoFilter)
    if (tipoFilter !== 'todos') items = items.filter(a => a.tipo === tipoFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(a =>
        (a.projetos?.nome || '').toLowerCase().includes(q) ||
        (a.descricao || '').toLowerCase().includes(q) ||
        (a.socio_nome || '').toLowerCase().includes(q)
      )
    }
    if (periodoFilter !== 'todos') {
      const now = new Date(); const cutoff = new Date()
      if (periodoFilter === 'hoje') cutoff.setHours(0, 0, 0, 0)
      else if (periodoFilter === '7d') cutoff.setDate(now.getDate() - 7)
      else if (periodoFilter === '30d') cutoff.setDate(now.getDate() - 30)
      else if (periodoFilter === 'mes') { cutoff.setDate(1); cutoff.setHours(0, 0, 0, 0) }
      else if (periodoFilter === 'ano') { cutoff.setMonth(0, 1); cutoff.setHours(0, 0, 0, 0) }
      items = items.filter(a => new Date(a.data) >= cutoff)
    }
    return items
  }, [aportes, tipoFilter, projetoFilter, search, periodoFilter])

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (data.vinculo_tipo === 'projeto' && !data.projeto_id) { toast.error('Selecione um projeto'); return }
    if (data.vinculo_tipo === 'imovel' && !data.patrimonio_id) { toast.error('Selecione um imóvel'); return }
    if (data.vinculo_tipo === 'bem_movel' && !data.bem_movel_id) { toast.error('Selecione um bem móvel'); return }

    const baseFields: any = {
      projeto_id:    data.vinculo_tipo === 'projeto'   ? data.projeto_id   : null,
      patrimonio_id: data.vinculo_tipo === 'imovel'    ? data.patrimonio_id : null,
      bem_movel_id:  data.vinculo_tipo === 'bem_movel' ? data.bem_movel_id  : null,
      valor: data.valor,
      data: data.data,
      tipo: data.tipo,
      socio_nome: data.tipo === 'aporte_socio' ? (data.socio_nome || null) : null,
      banco: data.banco || null,
      descricao: data.descricao || null,
    }

    if (editing) {
      const { data: updated, error } = await (supabase as any)
        .from('aportes').update(baseFields).eq('id', editing.id).select()
      if (error) { toast.error(`Erro ao atualizar: ${error.message}`); return }
      if (!updated || updated.length === 0) {
        toast.error('Sem permissão para editar este aporte.')
        return
      }
      toast.success('Aporte atualizado!')
    } else {
      const insertPayload = { ...baseFields, user_id: user.id }
      const { error } = await (supabase as any).from('aportes').insert(insertPayload)
      if (error) {
        if (error.code === '42703' || error.message?.includes('socio_nome')) {
          setNeedsSocioMigration(true)
          const { socio_nome: _, ...withoutSocio } = insertPayload
          const { error: e2 } = await (supabase as any).from('aportes').insert(withoutSocio)
          if (e2) { toast.error('Erro ao criar aporte'); return }
        } else {
          toast.error(`Erro ao criar aporte: ${error.message}`)
          return
        }
      }
      toast.success('Aporte registrado!')
    }

    setModalOpen(false)
    setEditing(null)
    reset({ data: new Date().toISOString().split('T')[0], tipo: 'capital_proprio', vinculo_tipo: 'projeto' })
    fetchData()
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('aportes').delete().eq('id', id)
    toast.success('Aporte excluído')
    setDeleting(null)
    fetchData()
  }

  const totalAportes = filtered.reduce((s, a) => s + (a.valor || 0), 0)
  const meuTotal = filtered.filter(a => a.tipo !== 'aporte_socio').reduce((s, a) => s + (a.valor || 0), 0)
  const socioTotal = filtered.filter(a => a.tipo === 'aporte_socio').reduce((s, a) => s + (a.valor || 0), 0)
  const projetosComAporte = new Set(filtered.map(a => a.projeto_id)).size

  return (
    <AppLayout>
      <Topbar title="Aportes" subtitle="Controle de aportes em projetos">
        <Button size="sm" onClick={() => {
          setEditing(null)
          reset({ data: new Date().toISOString().split('T')[0], tipo: 'capital_proprio', vinculo_tipo: 'projeto' })
          setModalOpen(true)
        }}>
          <Plus className="h-4 w-4" /> Novo Aporte
        </Button>
      </Topbar>

      <div className="p-6 space-y-5">
        {needsSocioMigration && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-800 mb-1">Execute no SQL Editor do Supabase para habilitar nome do sócio:</p>
            <pre className="text-[10px] bg-white rounded p-2 border border-amber-100 text-gray-700 select-all mt-1">
              ALTER TABLE aportes ADD COLUMN IF NOT EXISTS socio_nome TEXT;
            </pre>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total Aportado" value={formatBRL(totalAportes)} subtitle="no período filtrado" icon={DollarSign} />
          <MetricCard
            label="Meu Aporte"
            value={formatBRL(meuTotal)}
            subtitle={totalAportes > 0 ? `${((meuTotal / totalAportes) * 100).toFixed(0)}% do total` : '—'}
            icon={User}
          />
          <MetricCard
            label="Aporte de Sócios"
            value={formatBRL(socioTotal)}
            subtitle={totalAportes > 0 ? `${((socioTotal / totalAportes) * 100).toFixed(0)}% do total` : '—'}
            icon={Users}
          />
          <MetricCard label="Projetos" value={String(projetosComAporte)} subtitle="projetos com aporte" icon={FolderOpen} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar projeto ou sócio..."
              className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
            />
          </div>
          {[
            { v: periodoFilter, s: setPeriodoFilter, opts: PERIODS },
            {
              v: projetoFilter,
              s: setProjetoFilter,
              opts: [
                { value: 'todos', label: 'Todos os projetos' },
                ...projetos.map(p => ({ value: p.id, label: p.nome })),
              ],
            },
            {
              v: tipoFilter,
              s: setTipoFilter,
              opts: [{ value: 'todos', label: 'Todos os tipos' }, ...TIPOS],
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
          <EmptyState title="Nenhum aporte encontrado" action={{ label: 'Novo Aporte', onClick: () => setModalOpen(true) }} />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Data</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Vínculo</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tipo / Aportador</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Banco</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Descrição</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a: any, i: number) => {
                    const isSocio = a.tipo === 'aporte_socio'
                    return (
                      <tr key={a.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === filtered.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{a.data ? formatDate(a.data) : '—'}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {a.projetos?.nome
                            ? <span className="text-purple-700">{a.projetos.nome}</span>
                            : a.patrimonios?.nome
                            ? <span className="text-blue-700">{a.patrimonios.nome}</span>
                            : a.bens_moveis?.nome
                            ? <span className="text-amber-700">{a.bens_moveis.nome}</span>
                            : '—'}
                          <span className="block text-[10px] text-gray-400">
                            {a.projeto_id ? 'Projeto' : a.patrimonio_id ? 'Imóvel' : a.bem_movel_id ? 'Bem Móvel' : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isSocio ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 w-fit">
                                <Users className="h-3 w-3" /> Sócio
                              </span>
                              {a.socio_nome && <span className="text-[10px] text-gray-400">{a.socio_nome}</span>}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 w-fit">
                                <User className="h-3 w-3" /> Próprio
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {TIPO_CONFIG[a.tipo]?.label || a.tipo}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{a.banco || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[180px]">{a.descricao || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatBRL(a.valor)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditing(a)
                                const vt = a.projeto_id ? 'projeto' : a.patrimonio_id ? 'imovel' : 'bem_movel'
                                reset({
                                  vinculo_tipo: vt,
                                  projeto_id: a.projeto_id || '',
                                  patrimonio_id: a.patrimonio_id || '',
                                  bem_movel_id: a.bem_movel_id || '',
                                  valor: a.valor,
                                  data: a.data,
                                  tipo: a.tipo,
                                  socio_nome: a.socio_nome || '',
                                  banco: a.banco || '',
                                  descricao: a.descricao || '',
                                })
                                setModalOpen(true)
                              }}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500"
                              title="Editar aporte"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setDeleting(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500" title="Excluir aporte">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-100 bg-gray-50/50">
                    <td colSpan={3} className="px-4 py-2 text-xs text-gray-400">
                      Próprio: {formatBRL(meuTotal)} · Sócios: {formatBRL(socioTotal)}
                    </td>
                    <td colSpan={2} className="px-4 py-2 text-xs font-medium text-gray-500 text-right">Total:</td>
                    <td className="px-4 py-2 text-right font-bold text-gray-900">{formatBRL(totalAportes)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal
        key={editing?.id || 'novo'}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        title={editing ? 'Editar Aporte' : 'Novo Aporte'}
        footer={
          <>
            <Button variant="outline" onClick={() => { setModalOpen(false); setEditing(null) }}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{editing ? 'Salvar' : 'Registrar'}</Button>
          </>
        }
      >
        <form className="space-y-4">
          {/* Seletor de vínculo */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Vincular a *</label>
            <div className="grid grid-cols-3 gap-2">
              {VINCULO_TIPOS.map(v => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setValue('vinculo_tipo', v.value as any)}
                  className={`h-9 rounded-lg border text-sm font-medium transition-all ${
                    vinculoTipo === v.value
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Select dinâmico por tipo */}
          {vinculoTipo === 'projeto' && (
            <Select label="Projeto *" error={errors.projeto_id?.message} {...register('projeto_id')}>
              <option value="">Selecione o projeto...</option>
              {projetos.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
          )}
          {vinculoTipo === 'imovel' && (
            <Select label="Imóvel *" error={errors.patrimonio_id?.message} {...register('patrimonio_id')}>
              <option value="">Selecione o imóvel...</option>
              {patrimonios.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
          )}
          {vinculoTipo === 'bem_movel' && (
            <Select label="Bem Móvel *" error={errors.bem_movel_id?.message} {...register('bem_movel_id')}>
              <option value="">Selecione o bem móvel...</option>
              {bensMoveis.map((b: any) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </Select>
          )}

          <div className="grid grid-cols-2 gap-3">
            <CurrencyInput label="Valor (R$) *" value={watch("valor")} onChange={v => setValue("valor", v as any)} />
            <Input label="Data *" type="date" error={errors.data?.message} {...register('data')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo de Aporte *" {...register('tipo')}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
            <Select label="Banco" {...register('banco')}>
              <option value="">Não informado</option>
              {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
            </Select>
          </div>
          {tipoAtual === 'aporte_socio' && !needsSocioMigration && (
            <Input label="Nome do Sócio" placeholder="Ex: João da Silva" {...register('socio_nome')} />
          )}
          <Input label="Descrição" placeholder="Observações sobre o aporte..." {...register('descricao')} />
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
        <p className="text-sm text-gray-600">Deseja excluir este aporte? Esta ação não pode ser desfeita.</p>
      </Modal>
    </AppLayout>
  )
}
