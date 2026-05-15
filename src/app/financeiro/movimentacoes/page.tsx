'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
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
import { formatBRL, formatDate, formatShort } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  tipo: z.enum(['entrada', 'saida']),
  patrimonio_id: z.string().optional(),
  categoria: z.string().optional(),
  descricao: z.string().optional(),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  data: z.string().min(1, 'Data obrigatória'),
})

type FormData = z.infer<typeof schema>

export default function MovimentacoesPage() {
  const [movs, setMovs] = useState<any[]>([])
  const [patrimonios, setPatrimonios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'saida', data: new Date().toISOString().split('T')[0] },
  })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [m, p] = await Promise.all([
      supabase.from('movimentacoes').select('*, patrimonios(nome)').order('data', { ascending: false }).limit(100),
      supabase.from('patrimonios').select('id, nome').eq('status', 'ativo'),
    ])
    setMovs(m.data || [])
    setPatrimonios(p.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('movimentacoes').insert({
      ...data,
      user_id: user.id,
      patrimonio_id: data.patrimonio_id || null,
    })
    if (error) { toast.error('Erro ao criar movimentação'); return }
    toast.success('Movimentação criada!')
    setModalOpen(false)
    reset()
    fetchData()
  }

  const totalEntradas = movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0)
  const totalSaidas = movs.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0)

  return (
    <AppLayout>
      <Topbar title="Movimentações" subtitle="Controle de entradas e saídas">
        <Button size="sm" onClick={() => { reset({ tipo: 'saida', data: new Date().toISOString().split('T')[0] }); setModalOpen(true) }}>
          <Plus className="h-4 w-4" /> Nova Movimentação
        </Button>
      </Topbar>

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <MetricCard label="Total Entradas" value={formatShort(totalEntradas)} icon={ArrowUpCircle} />
          <MetricCard label="Total Saídas" value={formatShort(totalSaidas)} icon={ArrowDownCircle} />
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-12 bg-white rounded-lg animate-pulse" />)}</div>
        ) : movs.length === 0 ? (
          <EmptyState title="Nenhuma movimentação" action={{ label: 'Nova Movimentação', onClick: () => setModalOpen(true) }} />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Patrimônio</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Categoria</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Descrição</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor</th>
                </tr>
              </thead>
              <tbody>
                {movs.map((m: any, i: number) => (
                  <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === movs.length - 1 ? 'border-b-0' : ''}`}>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(m.data)}</td>
                    <td className="px-4 py-3 text-gray-700">{m.patrimonios?.nome || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={m.tipo === 'entrada' ? 'success' : 'danger'}>
                        {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{m.categoria || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{m.descricao || '—'}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${m.tipo === 'entrada' ? 'text-green-600' : 'text-red-500'}`}>
                      {m.tipo === 'entrada' ? '+' : '-'}{formatBRL(m.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova Movimentação"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>Criar</Button>
          </>
        }
      >
        <form className="space-y-4">
          <Select label="Tipo *" {...register('tipo')}>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </Select>
          <Select label="Patrimônio" {...register('patrimonio_id')}>
            <option value="">Sem patrimônio</option>
            {patrimonios.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
          <Input label="Valor (R$) *" type="number" step="0.01" min="0" error={errors.valor?.message} {...register('valor')} />
          <Input label="Data *" type="date" error={errors.data?.message} {...register('data')} />
          <Input label="Categoria" placeholder="Ex: Manutenção, Aluguel..." {...register('categoria')} />
          <Input label="Descrição" placeholder="Descrição da movimentação..." {...register('descricao')} />
        </form>
      </Modal>
    </AppLayout>
  )
}
