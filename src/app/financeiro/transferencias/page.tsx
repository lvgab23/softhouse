'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Repeat2, ArrowRight, Hash, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { MetricCard } from '@/components/ui/metric-card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatBRL, formatShort, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  conta_origem_id: z.string().min(1, 'Conta de origem obrigatória'),
  conta_destino_id: z.string().min(1, 'Conta de destino obrigatória'),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  data: z.string().min(1, 'Data obrigatória'),
  descricao: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function TransferenciasPage() {
  const [transferencias, setTransferencias] = useState<any[]>([])
  const [contas, setContas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { data: new Date().toISOString().split('T')[0] },
  })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [t, c] = await Promise.all([
      (supabase as any)
        .from('transferencias')
        .select('*, conta_origem:contas_bancarias!conta_origem_id(banco, conta), conta_destino:contas_bancarias!conta_destino_id(banco, conta)')
        .order('data', { ascending: false }),
      (supabase as any).from('contas_bancarias').select('id, banco, conta').eq('ativo', true),
    ])
    setTransferencias(t.data || [])
    setContas(c.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const onSubmit = async (data: FormData) => {
    if (data.conta_origem_id === data.conta_destino_id) {
      toast.error('Conta de origem e destino devem ser diferentes')
      return
    }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await (supabase as any).from('transferencias').insert({ ...data, user_id: user.id })
    if (error) { toast.error('Erro ao registrar transferência'); return }
    toast.success('Transferência registrada!')
    setModalOpen(false)
    reset({ data: new Date().toISOString().split('T')[0] })
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const supabase = createClient()
    await (supabase as any).from('transferencias').delete().eq('id', deleteId)
    toast.success('Transferência excluída')
    setDeleteId(null)
    setDeleting(false)
    fetchData()
  }

  const totalTransferido = transferencias.reduce((s, t) => s + (t.valor || 0), 0)

  return (
    <AppLayout>
      <Topbar title="Transferências" subtitle="Movimentações entre contas bancárias">
        <Button size="sm" onClick={() => { reset({ data: new Date().toISOString().split('T')[0] }); setModalOpen(true) }}>
          <Plus className="h-4 w-4" /> Nova Transferência
        </Button>
      </Topbar>

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard label="Total de Transferências" value={String(transferencias.length)} subtitle="registradas" icon={Hash} />
          <MetricCard label="Volume Total" value={formatShort(totalTransferido)} subtitle="transferido" icon={DollarSign} />
          <MetricCard label="Contas Ativas" value={String(contas.length)} subtitle="disponíveis" icon={Repeat2} />
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-white rounded-xl animate-pulse" />)}</div>
        ) : transferencias.length === 0 ? (
          <EmptyState title="Nenhuma transferência" description="Registre movimentações entre suas contas bancárias" action={{ label: 'Nova Transferência', onClick: () => setModalOpen(true) }} />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Origem → Destino</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Descrição</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {transferencias.map((t: any, i: number) => (
                  <tr key={t.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === transferencias.length - 1 ? 'border-b-0' : ''}`}>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(t.data)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-medium text-gray-700">{t.conta_origem?.banco || '—'}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        <span className="font-medium text-gray-700">{t.conta_destino?.banco || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5">
                        <span>{t.conta_origem?.conta}</span>
                        <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" />
                        <span>{t.conta_destino?.conta}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{t.descricao || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatBRL(t.valor)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setDeleteId(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-100 bg-gray-50/50">
                  <td colSpan={3} className="px-4 py-2 text-xs font-medium text-gray-500 text-right">Total:</td>
                  <td className="px-4 py-2 text-right font-bold text-gray-900">{formatBRL(totalTransferido)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova Transferência"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>Registrar</Button>
          </>
        }
      >
        <form className="space-y-4">
          <Select label="Conta de Origem *" error={errors.conta_origem_id?.message} {...register('conta_origem_id')}>
            <option value="">Selecione...</option>
            {contas.map((c: any) => <option key={c.id} value={c.id}>{c.banco} — {c.conta}</option>)}
          </Select>
          <Select label="Conta de Destino *" error={errors.conta_destino_id?.message} {...register('conta_destino_id')}>
            <option value="">Selecione...</option>
            {contas.map((c: any) => <option key={c.id} value={c.id}>{c.banco} — {c.conta}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valor (R$) *" type="number" step="0.01" error={errors.valor?.message} {...register('valor')} />
            <Input label="Data *" type="date" error={errors.data?.message} {...register('data')} />
          </div>
          <Input label="Descrição" placeholder="Motivo da transferência..." {...register('descricao')} />
        </form>
      </Modal>

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Excluir Transferência"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Excluir</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">Deseja excluir esta transferência? Esta ação não pode ser desfeita.</p>
      </Modal>
    </AppLayout>
  )
}
