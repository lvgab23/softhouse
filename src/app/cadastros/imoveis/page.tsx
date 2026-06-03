'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Download, Search } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { formatBRL, formatDate, buscaCEP } from '@/lib/utils'
import { usePortfolio } from '@/lib/portfolio-context'
import { createClient } from '@/lib/supabase/client'
import type { Patrimonio, Categoria } from '@/types/database'

const schema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  categoria_id: z.string().optional(),
  valor_aquisicao: z.coerce.number().optional(),
  valor_atual: z.coerce.number().optional(),
  data_aquisicao: z.string().optional(),
  status: z.string().default('ativo'),
  kanban_coluna: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  notas: z.string().optional(),
  // Aquisição
  tipo_aquisicao: z.string().optional(),
  avista_valor: z.coerce.number().optional(),
  financiamento_valor: z.coerce.number().optional(),
  consorcio_valor: z.coerce.number().optional(),
  socio_aquisicao: z.boolean().optional(),
  socio_aquisicao_nome: z.string().optional(),
  socio_aquisicao_valor: z.coerce.number().optional(),
})

type FormData = z.infer<typeof schema>

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'gray' | 'danger' | 'info' }> = {
  ativo: { label: 'Ativo', variant: 'success' },
  alugado: { label: 'Alugado', variant: 'info' },
  inativo: { label: 'Inativo', variant: 'gray' },
  negociacao: { label: 'Em Negociação', variant: 'warning' },
  manutencao: { label: 'Manutenção', variant: 'warning' },
  vendido: { label: 'Vendido', variant: 'danger' },
}

function maskBRL(str: string): string {
  const digits = str.replace(/\D/g, '')
  if (!digits) return ''
  const n = parseInt(digits, 10) / 100
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseBRLInput(str: string): number | undefined {
  if (!str) return undefined
  const parsed = parseFloat(str.replace(/\./g, '').replace(',', '.'))
  return isNaN(parsed) ? undefined : parsed
}

export default function ImoveisPage() {
  const [patrimonios, setPatrimonios] = useState<any[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [loadingCEP, setLoadingCEP] = useState(false)
  const [valorAqDisplay, setValorAqDisplay] = useState('')
  const [valorAtDisplay, setValorAtDisplay] = useState('')
  const [needsAquisicaoMigration, setNeedsAquisicaoMigration] = useState(false)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'ativo', tipo_aquisicao: '', socio_aquisicao: false },
  })

  const cepValue = watch('cep')
  const tipoAquisicao = watch('tipo_aquisicao')
  const socioAquisicao = watch('socio_aquisicao')

  const { activeOwnerId } = usePortfolio()
  const [totalAportado, setTotalAportado] = useState<Record<string, number>>({})

  const fetchData = useCallback(async () => {
    await fetch('/api/admin/migrate-patrimonio', { method: 'POST' }).catch(() => {})

    const supabase = createClient()
    const [p, c, ap] = await Promise.all([
      supabase.from('patrimonios').select('*, categorias(nome)').eq('user_id', activeOwnerId).order('created_at', { ascending: false }),
      supabase.from('categorias').select('*').order('nome'),
      (supabase as any).from('aportes').select('patrimonio_id, valor').not('patrimonio_id', 'is', null),
    ])
    const items = p.data || []
    if (items.length > 0 && !('tipo_aquisicao' in items[0])) setNeedsAquisicaoMigration(true)
    else setNeedsAquisicaoMigration(false)
    const sums: Record<string, number> = {}
    for (const a of ap.data || []) {
      if (a.patrimonio_id) sums[a.patrimonio_id] = (sums[a.patrimonio_id] || 0) + (a.valor || 0)
    }
    setTotalAportado(sums)
    setPatrimonios(items)
    setCategorias(c.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData, activeOwnerId])

  const handleCEP = async (cep: string) => {
    if (cep.replace(/\D/g, '').length !== 8) return
    setLoadingCEP(true)
    const data = await buscaCEP(cep)
    if (data) {
      setValue('logradouro', data.logradouro)
      setValue('bairro', data.bairro)
      setValue('cidade', data.localidade)
      setValue('estado', data.uf)
    }
    setLoadingCEP(false)
  }

  const openModal = (item?: any) => {
    if (item) {
      setEditing(item)
      reset({
        nome: item.nome,
        categoria_id: item.categoria_id || '',
        valor_aquisicao: item.valor_aquisicao || undefined,
        valor_atual: item.valor_atual || undefined,
        data_aquisicao: item.data_aquisicao || '',
        status: item.status,
        kanban_coluna: item.kanban_coluna || '',
        cep: item.cep || '',
        logradouro: item.logradouro || '',
        numero: item.numero || '',
        bairro: item.bairro || '',
        cidade: item.cidade || '',
        estado: item.estado || '',
        latitude: item.latitude || undefined,
        longitude: item.longitude || undefined,
        notas: item.notas || '',
        tipo_aquisicao: item.tipo_aquisicao || '',
        avista_valor: item.avista_valor || undefined,
        financiamento_valor: item.financiamento_valor || undefined,
        consorcio_valor: item.consorcio_valor || undefined,
        socio_aquisicao: item.socio_aquisicao || false,
        socio_aquisicao_nome: item.socio_aquisicao_nome || '',
        socio_aquisicao_valor: item.socio_aquisicao_valor || undefined,
      })
      setValorAqDisplay(item.valor_aquisicao ? item.valor_aquisicao.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '')
      setValorAtDisplay(item.valor_atual ? item.valor_atual.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '')
    } else {
      setEditing(null)
      reset({ status: 'ativo', tipo_aquisicao: '', socio_aquisicao: false })
      setValorAqDisplay('')
      setValorAtDisplay('')
    }
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Build payload explicitly — never send empty strings for nullable fields
    const basePayload: any = {
      nome: data.nome,
      categoria_id: data.categoria_id || null,
      valor_aquisicao: data.valor_aquisicao || null,
      valor_atual: data.valor_atual || null,
      data_aquisicao: data.data_aquisicao || null,
      status: data.status || 'ativo',
      kanban_coluna: data.kanban_coluna || null,
      cep: data.cep || null,
      logradouro: data.logradouro || null,
      numero: data.numero || null,
      bairro: data.bairro || null,
      cidade: data.cidade || null,
      estado: data.estado || null,
      latitude: data.latitude && !isNaN(data.latitude) ? data.latitude : null,
      longitude: data.longitude && !isNaN(data.longitude) ? data.longitude : null,
      notas: data.notas || null,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }

    const aquisicaoCols: any = {
      tipo_aquisicao: data.tipo_aquisicao || null,
      avista_valor: data.avista_valor || null,
      financiamento_valor: data.financiamento_valor || null,
      consorcio_valor: data.consorcio_valor || null,
      socio_aquisicao: data.socio_aquisicao || false,
      socio_aquisicao_nome: data.socio_aquisicao ? (data.socio_aquisicao_nome || null) : null,
      socio_aquisicao_valor: data.socio_aquisicao ? (data.socio_aquisicao_valor || null) : null,
    }

    const payload: any = needsAquisicaoMigration ? basePayload : { ...basePayload, ...aquisicaoCols }

    if (editing) {
      const { error } = await supabase.from('patrimonios').update(payload).eq('id', editing.id)
      if (error) { toast.error(`Erro ao atualizar: ${error.message}`); return }
      toast.success('Patrimônio atualizado!')
      try { await supabase.from('historico').insert({ user_id: user.id, tabela: 'patrimonios', acao: 'alteracao', registro_id: editing.id, campos: JSON.stringify(data) }) } catch (_) {}
    } else {
      const { data: novo, error } = await supabase.from('patrimonios').insert(payload).select().single()
      if (error) { toast.error(`Erro ao criar: ${error.message}`); return }
      toast.success('Patrimônio criado!')
      try { await supabase.from('historico').insert({ user_id: user.id, tabela: 'patrimonios', acao: 'criacao', registro_id: novo.id }) } catch (_) {}
    }

    setModalOpen(false)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('patrimonios').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Patrimônio excluído')
    if (user) await supabase.from('historico').insert({ user_id: user.id, tabela: 'patrimonios', acao: 'exclusao', registro_id: id })
    setDeleting(null)
    fetchData()
  }

  const handleExport = () => {
    const headers = ['Código', 'Nome', 'Categoria', 'Cidade', 'Estado', 'Valor Aquisição', 'Valor Atual', 'Status']
    const rows = filtered.map((p: any) => [
      p.codigo, p.nome, p.categorias?.nome || '', p.cidade || '', p.estado || '',
      p.valor_aquisicao || 0, p.valor_atual || 0, p.status
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'patrimonios.csv'; a.click()
  }

  const filtered = patrimonios.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    (p.cidade || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.categorias?.nome || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AppLayout>
      <Topbar title="Imóveis & Patrimônios" subtitle="Gerencie seu portfólio">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4" /> Exportar
        </Button>
        <Button size="sm" onClick={() => openModal()}>
          <Plus className="h-4 w-4" /> Novo Patrimônio
        </Button>
      </Topbar>

      <div className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, cidade ou categoria..."
              className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 focus:border-[#0f172a]"
            />
          </div>
          <span className="text-xs text-gray-400">{filtered.length} registro(s)</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4].map(i => <div key={i} className="h-12 bg-white rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nenhum patrimônio encontrado"
            description="Clique em 'Novo Patrimônio' para começar"
            action={{ label: 'Novo Patrimônio', onClick: () => openModal() }}
          />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Código</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nome</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Categoria</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Localização</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor Atual</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p: any, i: number) => {
                    const sc = statusConfig[p.status] || statusConfig.ativo
                    return (
                      <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${i === filtered.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{p.codigo}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{p.nome}</td>
                        <td className="px-4 py-3 text-gray-500">{p.categorias?.nome || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {[p.cidade, p.estado].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-xs">
                          <p className="font-medium text-gray-900">{p.valor_atual ? formatBRL(p.valor_atual) : p.valor_aquisicao ? formatBRL(p.valor_aquisicao) : '—'}</p>
                          {totalAportado[p.id] > 0 && (
                            <p className="text-purple-600 font-medium">+{formatBRL(totalAportado[p.id])} aport.</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={sc.variant}>{sc.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openModal(p)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setDeleting(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
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
          </div>
        )}
      </div>

      {/* Modal de formulário */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Patrimônio' : 'Novo Patrimônio'}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </>
        }
      >
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input label="Nome *" placeholder="Ex: Apartamento Centro" error={errors.nome?.message} {...register('nome')} />
          </div>
          <Select label="Categoria" {...register('categoria_id')}>
            <option value="">Sem categoria</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
          <Select label="Status" {...register('status')}>
            <option value="ativo">Ativo</option>
            <option value="alugado">Alugado</option>
            <option value="negociacao">Em Negociação</option>
            <option value="manutencao">Manutenção</option>
            <option value="inativo">Inativo</option>
            <option value="vendido">Vendido</option>
          </Select>
          <Input
            label="Valor de Aquisição (R$)"
            type="text"
            placeholder="0,00"
            value={valorAqDisplay}
            onChange={e => {
              const masked = maskBRL(e.target.value)
              setValorAqDisplay(masked)
              setValue('valor_aquisicao', parseBRLInput(masked))
            }}
          />
          <Input
            label="Valor Atual (R$)"
            type="text"
            placeholder="0,00"
            value={valorAtDisplay}
            onChange={e => {
              const masked = maskBRL(e.target.value)
              setValorAtDisplay(masked)
              setValue('valor_atual', parseBRLInput(masked))
            }}
          />
          <Input label="Data de Aquisição" type="date" {...register('data_aquisicao')} />
          <Select label="Coluna Kanban" {...register('kanban_coluna')}>
            <option value="">— Nenhuma —</option>
            <option value="negociacao">Negociação</option>
            <option value="aquisicao">Aquisição</option>
            <option value="registro">Registro</option>
            <option value="manutencao">Manutenção</option>
            <option value="avaliacao">Avaliação</option>
          </Select>
          <div className="md:col-span-2 border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Endereço</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2">
                <Input
                  label={loadingCEP ? 'Buscando CEP...' : 'CEP'}
                  placeholder="00000-000"
                  {...register('cep', {
                    onBlur: (e) => handleCEP(e.target.value),
                  })}
                />
              </div>
              <Input label="Número" placeholder="123" {...register('numero')} />
              <Input label="Estado" placeholder="SP" {...register('estado')} />
              <div className="col-span-2 md:col-span-2">
                <Input label="Logradouro" placeholder="Rua..." {...register('logradouro')} />
              </div>
              <Input label="Bairro" placeholder="Centro" {...register('bairro')} />
              <Input label="Cidade" placeholder="São Paulo" {...register('cidade')} />
              <Input label="Latitude" type="number" step="any" placeholder="-23.5505" {...register('latitude')} />
              <Input label="Longitude" type="number" step="any" placeholder="-46.6333" {...register('longitude')} />
            </div>
          </div>
          {/* Aquisição */}
          {!needsAquisicaoMigration && (
            <div className="md:col-span-2 border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Forma de Aquisição</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <Select label="Tipo de Aquisição" {...register('tipo_aquisicao')}>
                    <option value="">Não informado</option>
                    <option value="avista">À Vista</option>
                    <option value="financiado">Financiado</option>
                    <option value="consorcio">Consórcio</option>
                    <option value="misto">Misto (combinação)</option>
                  </Select>
                </div>

                {(tipoAquisicao === 'avista' || tipoAquisicao === 'misto') && (
                  <div className="col-span-2 md:col-span-1">
                    <Input label="Valor à Vista (R$)" type="number" step="0.01" placeholder="0,00" {...register('avista_valor')} />
                  </div>
                )}
                {(tipoAquisicao === 'financiado' || tipoAquisicao === 'misto') && (
                  <div className="col-span-2 md:col-span-1">
                    <Input label="Valor Financiado (R$)" type="number" step="0.01" placeholder="0,00" {...register('financiamento_valor')} />
                  </div>
                )}
                {(tipoAquisicao === 'consorcio' || tipoAquisicao === 'misto') && (
                  <div className="col-span-2 md:col-span-1">
                    <Input label="Valor Consórcio (R$)" type="number" step="0.01" placeholder="0,00" {...register('consorcio_valor')} />
                  </div>
                )}

                <div className="col-span-2 md:col-span-4 flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="socio_aquisicao"
                    {...register('socio_aquisicao')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <label htmlFor="socio_aquisicao" className="text-xs text-gray-600 cursor-pointer">
                    Houve participação de sócio nesta aquisição
                  </label>
                </div>

                {socioAquisicao && (
                  <>
                    <div className="col-span-2">
                      <Input label="Nome do Sócio" placeholder="Ex: João da Silva" {...register('socio_aquisicao_nome')} />
                    </div>
                    <div className="col-span-2">
                      <Input label="Valor Participação do Sócio (R$)" type="number" step="0.01" placeholder="0,00" {...register('socio_aquisicao_valor')} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="md:col-span-2">
            <Textarea label="Notas" placeholder="Observações..." rows={3} {...register('notas')} />
          </div>
        </form>
      </Modal>

      {/* Modal de confirmação de exclusão */}
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
        <p className="text-sm text-gray-600">Tem certeza que deseja excluir este patrimônio? Esta ação não pode ser desfeita.</p>
      </Modal>
    </AppLayout>
  )
}
