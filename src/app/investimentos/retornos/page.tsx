'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, TrendingUp, DollarSign, BarChart3, Layers } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { formatBRL, formatDate, formatShort } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  patrimonio_id: z.string().min(1, 'Patrimônio obrigatório'),
  tipo: z.enum(['aluguel', 'airbnb', 'venda', 'valorizacao_mercado']),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  percentual_valorizacao: z.coerce.number().optional(),
  data: z.string().min(1, 'Data obrigatória'),
  periodo: z.enum(['diario', 'semanal', 'mensal', 'anual']).default('mensal'),
  descricao: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const tipoConf: Record<string, { label: string; variant: 'info' | 'success' | 'warning' | 'danger' | 'gray' }> = {
  aluguel: { label: 'Aluguel', variant: 'info' },
  airbnb: { label: 'Airbnb', variant: 'warning' },
  venda: { label: 'Venda', variant: 'success' },
  valorizacao_mercado: { label: 'Valorização', variant: 'gray' },
}

const periodoLabel: Record<string, string> = {
  diario: 'Diário',
  semanal: 'Semanal',
  mensal: 'Mensal',
  anual: 'Anual',
}

export default function RetornosPage() {
  const [retornos, setRetornos] = useState<any[]>([])
  const [patrimonios, setPatrimonios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [filterTipo, setFilterTipo] = useState('todos')
  const [filterPeriodo, setFilterPeriodo] = useState('todos')

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'aluguel', periodo: 'mensal' },
  })

  const watchTipo = watch('tipo')

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [rRes, pRes] = await Promise.all([
      (supabase as any)
        .from('retornos_imobiliarios')
        .select('*, patrimonios(nome)')
        .order('data', { ascending: false }),
      supabase.from('patrimonios').select('id, nome').eq('status', 'ativo'),
    ])
    setRetornos(rRes.data || [])
    setPatrimonios(pRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openModal = (item?: any) => {
    if (item) {
      setEditing(item)
      reset({
        patrimonio_id: item.patrimonio_id || '',
        tipo: item.tipo || 'aluguel',
        valor: item.valor || 0,
        percentual_valorizacao: item.percentual_valorizacao ?? undefined,
        data: item.data || '',
        periodo: item.periodo || 'mensal',
        descricao: item.descricao || '',
      })
    } else {
      setEditing(null)
      reset({ tipo: 'aluguel', periodo: 'mensal' })
    }
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      ...data,
      user_id: user.id,
      percentual_valorizacao: data.tipo === 'valorizacao_mercado' ? (data.percentual_valorizacao ?? null) : null,
    }

    if (editing) {
      const { error } = await (supabase as any).from('retornos_imobiliarios').update(payload).eq('id', editing.id)
      if (error) { toast.error('Erro ao atualizar retorno'); return }
      toast.success('Retorno atualizado!')
    } else {
      const { error } = await (supabase as any).from('retornos_imobiliarios').insert(payload)
      if (error) { toast.error('Erro ao registrar retorno'); return }
      toast.success('Retorno registrado!')
    }

    setModalOpen(false)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    const { error } = await (supabase as any).from('retornos_imobiliarios').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Retorno excluído!')
    fetchData()
  }

  // Filtered list
  const filtered = retornos.filter((r: any) => {
    if (filterTipo !== 'todos' && r.tipo !== filterTipo) return false
    if (filterPeriodo !== 'todos' && r.periodo !== filterPeriodo) return false
    return true
  })

  // Metrics
  const totalRetornos = retornos.length
  const receitaAluguelMes = retornos
    .filter((r: any) => r.tipo === 'aluguel' && r.periodo === 'mensal')
    .reduce((s: number, r: any) => s + (r.valor || 0), 0)
  const totalAcumulado = retornos.reduce((s: number, r: any) => s + (r.valor || 0), 0)
  const mediaPorTipo = retornos.length > 0 ? totalAcumulado / retornos.length : 0

  return (
    <AppLayout>
      <Topbar title="Retornos Imobiliários" subtitle="Gestão de retornos por tipo de investimento">
        <Button size="sm" onClick={() => openModal()}>
          <Plus className="h-4 w-4" /> Novo Retorno
        </Button>
      </Topbar>

      <div className="p-6 space-y-5">
        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total de Retornos"
            value={String(totalRetornos)}
            subtitle="registros"
            icon={Layers}
          />
          <MetricCard
            label="Aluguel Mensal"
            value={formatShort(receitaAluguelMes)}
            subtitle="contratos mensais"
            icon={DollarSign}
            trend="up"
          />
          <MetricCard
            label="Média por Registro"
            value={formatShort(mediaPorTipo)}
            subtitle="todos os tipos"
            icon={BarChart3}
          />
          <MetricCard
            label="Total Acumulado"
            value={formatShort(totalAcumulado)}
            subtitle="soma de retornos"
            icon={TrendingUp}
            trend="up"
          />
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">Tipo:</label>
            <select
              value={filterTipo}
              onChange={e => setFilterTipo(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 focus:border-[#0f172a] cursor-pointer"
            >
              <option value="todos">Todos</option>
              <option value="aluguel">Aluguel</option>
              <option value="airbnb">Airbnb</option>
              <option value="venda">Venda</option>
              <option value="valorizacao_mercado">Valorização</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">Período:</label>
            <select
              value={filterPeriodo}
              onChange={e => setFilterPeriodo(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 focus:border-[#0f172a] cursor-pointer"
            >
              <option value="todos">Todos</option>
              <option value="diario">Diário</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
              <option value="anual">Anual</option>
            </select>
          </div>
          {(filterTipo !== 'todos' || filterPeriodo !== 'todos') && (
            <button
              onClick={() => { setFilterTipo('todos'); setFilterPeriodo('todos') }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Limpar filtros
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-white rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Nenhum retorno encontrado"
            description="Registre retornos imobiliários como aluguéis, Airbnb, vendas ou valorização"
            action={{ label: 'Novo Retorno', onClick: () => openModal() }}
          />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Patrimônio</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Valorização</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Período</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Data</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r: any, i: number) => {
                    const conf = tipoConf[r.tipo] || { label: r.tipo, variant: 'gray' as const }
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${i === filtered.length - 1 ? 'border-b-0' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <Badge variant={conf.variant}>{conf.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium">
                          {r.patrimonios?.nome || '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {formatBRL(r.valor || 0)}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500 text-xs">
                          {r.percentual_valorizacao != null
                            ? <span className="text-green-600 font-medium">{r.percentual_valorizacao}%</span>
                            : '—'
                          }
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs text-gray-400 capitalize">
                            {periodoLabel[r.periodo] || r.periodo || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(r.data)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openModal(r)}>Editar</Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleDelete(r.id)}
                            >
                              Excluir
                            </Button>
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

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Retorno' : 'Novo Retorno Imobiliário'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
              {editing ? 'Salvar' : 'Registrar'}
            </Button>
          </>
        }
      >
        <form className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Select
              label="Patrimônio *"
              error={errors.patrimonio_id?.message}
              {...register('patrimonio_id')}
            >
              <option value="">Selecione o patrimônio...</option>
              {patrimonios.map((p: any) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </Select>
          </div>

          <Select label="Tipo *" error={errors.tipo?.message} {...register('tipo')}>
            <option value="aluguel">Aluguel</option>
            <option value="airbnb">Airbnb</option>
            <option value="venda">Venda</option>
            <option value="valorizacao_mercado">Valorização de Mercado</option>
          </Select>

          <Select label="Período *" error={errors.periodo?.message} {...register('periodo')}>
            <option value="diario">Diário</option>
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </Select>

          <Input
            label="Valor (R$) *"
            type="number"
            step="0.01"
            placeholder="0,00"
            error={errors.valor?.message}
            {...register('valor')}
          />

          {watchTipo === 'valorizacao_mercado' && (
            <Input
              label="Percentual de Valorização (%)"
              type="number"
              step="0.01"
              placeholder="0,00"
              error={errors.percentual_valorizacao?.message}
              {...register('percentual_valorizacao')}
            />
          )}

          <Input
            label="Data *"
            type="date"
            error={errors.data?.message}
            {...register('data')}
            className={watchTipo !== 'valorizacao_mercado' ? 'col-span-1' : ''}
          />

          <div className="col-span-2">
            <Textarea
              label="Descrição"
              placeholder="Observações sobre este retorno..."
              rows={3}
              {...register('descricao')}
            />
          </div>
        </form>
      </Modal>
    </AppLayout>
  )
}
