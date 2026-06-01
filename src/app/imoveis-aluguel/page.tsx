'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, AlertTriangle } from 'lucide-react'
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
  patrimonio_id: z.string().min(1, 'Patrimônio obrigatório'),
  inquilino_nome: z.string().min(1, 'Nome obrigatório'),
  inquilino_cpf: z.string().optional(),
  inquilino_telefone: z.string().optional(),
  valor_aluguel: z.coerce.number().positive('Valor deve ser positivo'),
  dia_vencimento: z.coerce.number().min(1).max(31),
  data_inicio: z.string().min(1),
  data_fim: z.string().optional(),
  status: z.enum(['ativo', 'encerrado', 'inadimplente']).default('ativo'),
})

type FormData = z.infer<typeof schema>

const statusConf: Record<string, { label: string; variant: any }> = {
  ativo: { label: 'Ativo', variant: 'success' },
  encerrado: { label: 'Encerrado', variant: 'gray' },
  inadimplente: { label: 'Inadimplente', variant: 'danger' },
}

export default function AlugueisPage() {
  const [alugueis, setAlugueis] = useState<any[]>([])
  const [patrimonios, setPatrimonios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'ativo', dia_vencimento: 10 },
  })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [a, p] = await Promise.all([
      supabase.from('alugueis').select('*, patrimonios(nome)').order('created_at', { ascending: false }),
      supabase.from('patrimonios').select('id, nome').eq('status', 'ativo'),
    ])
    setAlugueis(a.data || [])
    setPatrimonios(p.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openModal = (item?: any) => {
    if (item) {
      setEditing(item)
      reset({ patrimonio_id: item.patrimonio_id || '', inquilino_nome: item.inquilino_nome || '', inquilino_cpf: item.inquilino_cpf || '', inquilino_telefone: item.inquilino_telefone || '', valor_aluguel: item.valor_aluguel || 0, dia_vencimento: item.dia_vencimento || 10, data_inicio: item.data_inicio || '', data_fim: item.data_fim || '', status: item.status })
    } else {
      setEditing(null)
      reset({ status: 'ativo', dia_vencimento: 10 })
    }
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = { ...data, user_id: user.id, data_fim: data.data_fim || null }

    if (editing) {
      const { error } = await supabase.from('alugueis').update(payload).eq('id', editing.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('Contrato atualizado!')
    } else {
      const { error } = await supabase.from('alugueis').insert(payload)
      if (error) { toast.error('Erro ao criar'); return }
      toast.success('Contrato criado!')
    }

    setModalOpen(false)
    fetchData()
  }

  // Alerta: contratos vencendo em 30 dias
  const vencendo = alugueis.filter(a => {
    if (!a.data_fim || a.status !== 'ativo') return false
    const dias = (new Date(a.data_fim).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return dias >= 0 && dias <= 30
  })

  return (
    <AppLayout>
      <Topbar title="Imóveis de Aluguel" subtitle="Controle de contratos de locação">
        <Button size="sm" onClick={() => openModal()}>
          <Plus className="h-4 w-4" /> Novo Contrato
        </Button>
      </Topbar>

      <div className="p-6 space-y-4">
        {vencendo.length > 0 && (
          <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700">
              <strong>{vencendo.length} contrato(s)</strong> vencendo nos próximos 30 dias.
            </p>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-white rounded-lg animate-pulse" />)}</div>
        ) : alugueis.length === 0 ? (
          <EmptyState title="Nenhum contrato de aluguel" action={{ label: 'Novo Contrato', onClick: () => openModal() }} />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Inquilino</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Imóvel</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Aluguel</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Vencimento</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Início</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Fim</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody>
                {alugueis.map((a: any, i: number) => {
                  const sc = statusConf[a.status] || statusConf.ativo
                  const vence = a.data_fim && (new Date(a.data_fim).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 30 && a.status === 'ativo'
                  return (
                    <tr key={a.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === alugueis.length - 1 ? 'border-b-0' : ''} ${vence ? 'bg-yellow-50/50' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{a.inquilino_nome}</td>
                      <td className="px-4 py-3 text-gray-600">{a.patrimonios?.nome || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{a.valor_aluguel ? formatBRL(a.valor_aluguel) : '—'}</td>
                      <td className="px-4 py-3 text-center text-gray-500">Dia {a.dia_vencimento}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(a.data_inicio)}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={vence ? 'text-yellow-600 font-medium' : 'text-gray-500'}>
                          {formatDate(a.data_fim)}
                          {vence && ' ⚠'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openModal(a)}>Editar</Button>
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
        title={editing ? 'Editar Contrato' : 'Novo Contrato de Aluguel'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{editing ? 'Salvar' : 'Criar'}</Button>
          </>
        }
      >
        <form className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Select label="Imóvel *" error={errors.patrimonio_id?.message} {...register('patrimonio_id')}>
              <option value="">Selecione o imóvel...</option>
              {patrimonios.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
          </div>
          <div className="col-span-2">
            <Input label="Nome do Inquilino *" error={errors.inquilino_nome?.message} {...register('inquilino_nome')} />
          </div>
          <Input label="CPF" placeholder="000.000.000-00" {...register('inquilino_cpf')} />
          <Input label="Telefone" {...register('inquilino_telefone')} />
          <CurrencyInput label="Valor do Aluguel (R$) *" value={watch("valor_aluguel")} onChange={v => setValue("valor_aluguel", v as any)} />
          <Input label="Dia de Vencimento *" type="number" min="1" max="31" {...register('dia_vencimento')} />
          <Input label="Data de Início *" type="date" error={errors.data_inicio?.message} {...register('data_inicio')} />
          <Input label="Data de Término" type="date" {...register('data_fim')} />
          <div className="col-span-2">
            <Select label="Status" {...register('status')}>
              <option value="ativo">Ativo</option>
              <option value="encerrado">Encerrado</option>
              <option value="inadimplente">Inadimplente</option>
            </Select>
          </div>
        </form>
      </Modal>
    </AppLayout>
  )
}
