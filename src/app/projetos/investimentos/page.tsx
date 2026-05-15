'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, TrendingUp, DollarSign, Percent } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { MetricCard } from '@/components/ui/metric-card'
import { formatBRL, formatShort, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const TIPOS = [
  { value: 'renda_fixa', label: 'Renda Fixa' },
  { value: 'renda_variavel', label: 'Renda Variável' },
  { value: 'fundo', label: 'Fundo de Investimento' },
  { value: 'cripto', label: 'Criptomoeda' },
  { value: 'cri_cra', label: 'CRI/CRA' },
  { value: 'lci_lca', label: 'LCI/LCA' },
  { value: 'outro', label: 'Outro' },
]

const schema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  tipo: z.string().default('renda_fixa'),
  valor_investido: z.number().min(0).default(0),
  valor_atual: z.number().min(0).default(0),
  rentabilidade: z.number().optional(),
  data_investimento: z.string().optional(),
  vencimento: z.string().optional(),
  instituicao: z.string().optional(),
  notas: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const tipoLabels: Record<string, string> = Object.fromEntries(TIPOS.map(t => [t.value, t.label]))

export default function InvestimentosPage() {
  const [investimentos, setInvestimentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'renda_fixa', valor_investido: 0, valor_atual: 0 },
  })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await (supabase as any).from('investimentos').select('*').order('created_at', { ascending: false })
    if (!error) setInvestimentos(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openModal = (item?: any) => {
    if (item) {
      setEditing(item)
      reset({
        nome: item.nome,
        tipo: item.tipo,
        valor_investido: item.valor_investido || 0,
        valor_atual: item.valor_atual || 0,
        rentabilidade: item.rentabilidade || undefined,
        data_investimento: item.data_investimento || '',
        vencimento: item.vencimento || '',
        instituicao: item.instituicao || '',
        notas: item.notas || '',
      })
    } else {
      setEditing(null)
      reset({ tipo: 'renda_fixa', valor_investido: 0, valor_atual: 0 })
    }
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const db = supabase as any
    const payload = { ...data, user_id: user.id, updated_at: new Date().toISOString() }

    if (editing) {
      const { error } = await db.from('investimentos').update(payload).eq('id', editing.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('Investimento atualizado!')
    } else {
      const { error } = await db.from('investimentos').insert(payload)
      if (error) { toast.error('Erro ao criar. Execute a migration SQL primeiro.'); return }
      toast.success('Investimento criado!')
    }
    setModalOpen(false)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    const { error } = await (supabase as any).from('investimentos').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Investimento excluído')
    setDeleting(null)
    fetchData()
  }

  const totalInvestido = investimentos.reduce((s, i) => s + (i.valor_investido || 0), 0)
  const totalAtual = investimentos.reduce((s, i) => s + (i.valor_atual || i.valor_investido || 0), 0)
  const roiTotal = totalInvestido > 0 ? ((totalAtual - totalInvestido) / totalInvestido * 100) : 0
  const ganhoTotal = totalAtual - totalInvestido

  return (
    <AppLayout>
      <Topbar title="Investimentos" subtitle="Gerencie sua carteira de investimentos">
        <Button size="sm" onClick={() => openModal()}>
          <Plus className="h-4 w-4" /> Novo Investimento
        </Button>
      </Topbar>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total Investido" value={formatShort(totalInvestido)} subtitle={`${investimentos.length} aplicações`} icon={DollarSign} />
          <MetricCard label="Valor Atual" value={formatShort(totalAtual)} subtitle="posição atual" icon={TrendingUp} />
          <MetricCard
            label="ROI Total"
            value={`${roiTotal.toFixed(1)}%`}
            subtitle="retorno acumulado"
            icon={Percent}
            trend={roiTotal >= 0 ? 'up' : 'down'}
            trendValue={roiTotal >= 0 ? 'Lucro' : 'Perda'}
          />
          <MetricCard label="Ganho/Perda" value={formatShort(Math.abs(ganhoTotal))} subtitle={ganhoTotal >= 0 ? 'ganho acumulado' : 'perda acumulada'} icon={TrendingUp} />
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-white rounded-lg animate-pulse" />)}</div>
        ) : investimentos.length === 0 ? (
          <EmptyState icon={TrendingUp} title="Nenhum investimento cadastrado" description="Adicione seus investimentos para acompanhar a rentabilidade" action={{ label: 'Novo Investimento', onClick: () => openModal() }} />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nome</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Instituição</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Investido</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor Atual</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">ROI</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Vencimento</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {investimentos.map((inv: any, i: number) => {
                    const roi = inv.valor_investido > 0 ? ((inv.valor_atual - inv.valor_investido) / inv.valor_investido * 100) : 0
                    return (
                      <tr key={inv.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === investimentos.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-4 py-3 font-medium text-gray-900">{inv.nome}</td>
                        <td className="px-4 py-3 text-gray-500">{tipoLabels[inv.tipo] || inv.tipo}</td>
                        <td className="px-4 py-3 text-gray-500">{inv.instituicao || '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatBRL(inv.valor_investido || 0)}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatBRL(inv.valor_atual || inv.valor_investido || 0)}</td>
                        <td className={`px-4 py-3 text-right font-semibold text-xs ${roi >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-gray-500">{inv.vencimento ? formatDate(inv.vencimento) : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openModal(inv)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => setDeleting(inv.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Investimento' : 'Novo Investimento'} size="lg"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button><Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{editing ? 'Salvar' : 'Criar'}</Button></>}
      >
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2"><Input label="Nome *" placeholder="Ex: CDB Banco XYZ" error={errors.nome?.message} {...register('nome')} /></div>
          <Select label="Tipo" {...register('tipo')}>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <Input label="Instituição" placeholder="Ex: Banco Itaú" {...register('instituicao')} />
          <Input label="Valor Investido (R$)" type="number" step="0.01" {...register('valor_investido', { valueAsNumber: true })} />
          <Input label="Valor Atual (R$)" type="number" step="0.01" {...register('valor_atual', { valueAsNumber: true })} />
          <Input label="Rentabilidade (% a.a.)" type="number" step="0.01" placeholder="12.5" {...register('rentabilidade', { valueAsNumber: true })} />
          <Input label="Data do Investimento" type="date" {...register('data_investimento')} />
          <Input label="Vencimento" type="date" {...register('vencimento')} />
          <div className="md:col-span-2"><Textarea label="Notas" placeholder="Observações..." rows={2} {...register('notas')} /></div>
        </form>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Confirmar exclusão" size="sm"
        footer={<><Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="danger" onClick={() => deleting && handleDelete(deleting)}>Excluir</Button></>}
      >
        <p className="text-sm text-gray-600">Tem certeza que deseja excluir este investimento?</p>
      </Modal>
    </AppLayout>
  )
}
