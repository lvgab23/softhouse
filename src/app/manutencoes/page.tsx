'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
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
import { usePortfolio } from '@/lib/portfolio-context'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  patrimonio_id: z.string().min(1, 'Patrimônio obrigatório'),
  fornecedor_id: z.string().optional(),
  descricao: z.string().min(1, 'Descrição obrigatória'),
  custo: z.coerce.number().optional(),
  data_realizacao: z.string().optional(),
  proxima_manutencao: z.string().optional(),
  status: z.enum(['pendente', 'em_andamento', 'concluida']).default('pendente'),
})

type FormData = z.infer<typeof schema>

const statusConf: Record<string, { label: string; variant: any }> = {
  pendente: { label: 'Pendente', variant: 'gray' },
  em_andamento: { label: 'Em Andamento', variant: 'info' },
  concluida: { label: 'Concluída', variant: 'success' },
}

export default function ManutencoesPage() {
  
  const { activeOwnerId } = usePortfolio()
  const [manutencoes, setManutencoes] = useState<any[]>([])
  const [patrimonios, setPatrimonios] = useState<any[]>([])
  const [fornecedores, setFornecedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'pendente' },
  })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [m, p, f] = await Promise.all([
      supabase.from('manutencoes').select('*, patrimonios(nome), fornecedores(nome)').eq('user_id', activeOwnerId).order('created_at', { ascending: false }),
      supabase.from('patrimonios').select('id, nome').eq('user_id', activeOwnerId).eq('status', 'ativo'),
      supabase.from('fornecedores').select('id, nome'),
    ])
    setManutencoes(m.data || [])
    setPatrimonios(p.data || [])
    setFornecedores(f.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openModal = (item?: any) => {
    if (item) {
      setEditing(item)
      reset({
        patrimonio_id: item.patrimonio_id || '',
        fornecedor_id: item.fornecedor_id || '',
        descricao: item.descricao,
        custo: item.custo || undefined,
        data_realizacao: item.data_realizacao || '',
        proxima_manutencao: item.proxima_manutencao || '',
        status: item.status,
      })
    } else {
      setEditing(null)
      reset({ status: 'pendente' })
    }
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = { ...data, user_id: user.id, fornecedor_id: data.fornecedor_id || null }

    if (editing) {
      const { error } = await supabase.from('manutencoes').update(payload).eq('id', editing.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('Manutenção atualizada!')
    } else {
      const { error } = await supabase.from('manutencoes').insert(payload)
      if (error) { toast.error('Erro ao criar'); return }
      toast.success('Manutenção criada!')
    }

    setModalOpen(false)
    fetchData()
  }

  const getStatusVariant = (item: any) => {
    if (item.proxima_manutencao && new Date(item.proxima_manutencao) < new Date() && item.status !== 'concluida') {
      return { label: 'Vencida', variant: 'danger' as const }
    }
    return statusConf[item.status] || statusConf.pendente
  }

  return (
    <AppLayout>
      <Topbar title="Manutenções" subtitle="Controle de ordens de serviço">
        <Button size="sm" onClick={() => openModal()}>
          <Plus className="h-4 w-4" /> Nova Manutenção
        </Button>
      </Topbar>

      <div className="p-6">
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-white rounded-lg animate-pulse" />)}</div>
        ) : manutencoes.length === 0 ? (
          <EmptyState title="Nenhuma manutenção cadastrada" action={{ label: 'Nova Manutenção', onClick: () => openModal() }} />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Patrimônio</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Descrição</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Fornecedor</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Custo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Realizada</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Próxima</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody>
                {manutencoes.map((m: any, i: number) => {
                  const sc = getStatusVariant(m)
                  return (
                    <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === manutencoes.length - 1 ? 'border-b-0' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{m.patrimonios?.nome || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{m.descricao}</td>
                      <td className="px-4 py-3 text-gray-500">{m.fornecedores?.nome || '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{m.custo ? formatBRL(m.custo) : '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(m.data_realizacao)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(m.proxima_manutencao)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openModal(m)}>Editar</Button>
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
        title={editing ? 'Editar Manutenção' : 'Nova Manutenção'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{editing ? 'Salvar' : 'Criar'}</Button>
          </>
        }
      >
        <form className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Select label="Patrimônio *" error={errors.patrimonio_id?.message} {...register('patrimonio_id')}>
              <option value="">Selecione...</option>
              {patrimonios.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
          </div>
          <div className="col-span-2">
            <Input label="Descrição *" error={errors.descricao?.message} {...register('descricao')} />
          </div>
          <Select label="Fornecedor" {...register('fornecedor_id')}>
            <option value="">Sem fornecedor</option>
            {fornecedores.map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </Select>
          <CurrencyInput label="Custo (R$)" value={watch("custo")} onChange={v => setValue("custo", v as any)} />
          <Input label="Data de Realização" type="date" {...register('data_realizacao')} />
          <Input label="Próxima Manutenção" type="date" {...register('proxima_manutencao')} />
          <div className="col-span-2">
            <Select label="Status" {...register('status')}>
              <option value="pendente">Pendente</option>
              <option value="em_andamento">Em Andamento</option>
              <option value="concluida">Concluída</option>
            </Select>
          </div>
        </form>
      </Modal>
    </AppLayout>
  )
}
