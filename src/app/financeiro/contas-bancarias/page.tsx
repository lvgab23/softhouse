'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Landmark, CreditCard, TrendingUp, Hash } from 'lucide-react'
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
import { formatBRL, formatShort } from '@/lib/utils'
import { CurrencyInput } from '@/components/ui/currency-input'
import { createClient } from '@/lib/supabase/client'

const BANCOS = [
  'Banco do Brasil', 'Caixa Econômica Federal', 'Bradesco', 'Itaú', 'Santander',
  'Nubank', 'Inter', 'C6 Bank', 'BTG Pactual', 'Sicredi', 'Banrisul', 'Outro',
]

const TIPOS_CONTA = [
  { value: 'corrente', label: 'Conta Corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'investimento', label: 'Investimento' },
  { value: 'pagamento', label: 'Pagamento' },
]

const schema = z.object({
  banco: z.string().min(1, 'Banco obrigatório'),
  conta: z.string().min(1, 'Número da conta obrigatório'),
  agencia: z.string().optional(),
  tipo: z.string().default('corrente'),
  saldo_inicial: z.coerce.number().default(0),
  ativo: z.boolean().default(true),
})

type FormData = z.infer<typeof schema>

export default function ContasBancariasPage() {
  const [contas, setContas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'corrente', saldo_inicial: 0, ativo: true },
  })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data } = await (supabase as any).from('contas_bancarias').select('*').order('banco')
    setContas(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setEditing(null)
    reset({ tipo: 'corrente', saldo_inicial: 0, ativo: true })
    setModalOpen(true)
  }

  const openEdit = (item: any) => {
    setEditing(item)
    reset({
      banco: item.banco,
      conta: item.conta,
      agencia: item.agencia || '',
      tipo: item.tipo,
      saldo_inicial: item.saldo_inicial || 0,
      ativo: item.ativo !== false,
    })
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = editing
      ? await (supabase as any).from('contas_bancarias').update(data).eq('id', editing.id)
      : await (supabase as any).from('contas_bancarias').insert({ ...data, user_id: user.id })
    if (error) { toast.error('Erro ao salvar conta'); return }
    toast.success(editing ? 'Conta atualizada!' : 'Conta criada!')
    setModalOpen(false)
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await (supabase as any).from('contas_bancarias').delete().eq('id', deleteId)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Conta excluída'); fetchData() }
    setDeleteId(null)
    setDeleting(false)
  }

  const ativas = contas.filter(c => c.ativo !== false)
  const totalSaldo = contas.reduce((s, c) => s + (c.saldo_inicial || 0), 0)

  const tipoConfig: Record<string, { label: string; variant: any }> = {
    corrente: { label: 'Corrente', variant: 'info' },
    poupanca: { label: 'Poupança', variant: 'success' },
    investimento: { label: 'Investimento', variant: 'warning' },
    pagamento: { label: 'Pagamento', variant: 'gray' },
  }

  return (
    <AppLayout>
      <Topbar title="Contas Bancárias" subtitle="Gestão de contas e saldos">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nova Conta
        </Button>
      </Topbar>

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total de Contas" value={String(contas.length)} subtitle="cadastradas" icon={Hash} />
          <MetricCard label="Contas Ativas" value={String(ativas.length)} subtitle="em uso" icon={CreditCard} />
          <MetricCard label="Saldo Total" value={formatShort(totalSaldo)} subtitle="soma dos saldos" icon={Landmark} />
          <MetricCard label="Saldo Médio" value={contas.length > 0 ? formatShort(totalSaldo / contas.length) : 'R$ 0'} subtitle="por conta" icon={TrendingUp} />
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-white rounded-xl animate-pulse" />)}</div>
        ) : contas.length === 0 ? (
          <EmptyState title="Nenhuma conta cadastrada" description="Cadastre suas contas bancárias para controle financeiro" action={{ label: 'Nova Conta', onClick: openCreate }} />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Banco</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Agência / Conta</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tipo</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Saldo Inicial</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {contas.map((c: any, i: number) => {
                  const tc = tipoConfig[c.tipo] || tipoConfig.corrente
                  return (
                    <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === contas.length - 1 ? 'border-b-0' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.banco}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {c.agencia ? <span className="mr-2">Ag: {c.agencia}</span> : null}
                        {c.conta}
                      </td>
                      <td className="px-4 py-3"><Badge variant={tc.variant}>{tc.label}</Badge></td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatBRL(c.saldo_inicial || 0)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={c.ativo !== false ? 'success' : 'gray'}>
                          {c.ativo !== false ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
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
        title={editing ? 'Editar Conta' : 'Nova Conta Bancária'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{editing ? 'Salvar' : 'Criar'}</Button>
          </>
        }
      >
        <form className="space-y-4">
          <Select label="Banco *" error={errors.banco?.message} {...register('banco')}>
            <option value="">Selecione o banco...</option>
            {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Agência" placeholder="Ex: 0001" {...register('agencia')} />
            <Input label="Conta *" placeholder="Ex: 12345-6" error={errors.conta?.message} {...register('conta')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo de Conta" {...register('tipo')}>
              {TIPOS_CONTA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
            <CurrencyInput label="Saldo Inicial (R$)" value={watch("saldo_inicial")} onChange={v => setValue("saldo_inicial", v as any)} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="ativo" {...register('ativo')} className="w-4 h-4 rounded border-gray-300" />
            <label htmlFor="ativo" className="text-sm text-gray-700">Conta ativa</label>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Excluir Conta"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Excluir</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">Tem certeza que deseja excluir esta conta? Lançamentos vinculados podem ser afetados.</p>
      </Modal>
    </AppLayout>
  )
}
