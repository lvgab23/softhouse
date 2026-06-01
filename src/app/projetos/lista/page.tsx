'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, FolderOpen } from 'lucide-react'
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

export default function ProjetosListaPage() {
  const [projetos, setProjetos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'ativo' },
  })

  const [totalAportado, setTotalAportado] = useState<Record<string, number>>({})

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

  const openModal = (item?: any) => {
    if (item) {
      setEditing(item)
      reset({ nome: item.nome, descricao: item.descricao || '', valor_total: item.valor_total || undefined, data_inicio: item.data_inicio || '', status: item.status })
    } else {
      setEditing(null)
      reset({ status: 'ativo' })
    }
    setModalOpen(true)
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

  return (
    <AppLayout>
      <Topbar title="Projetos" subtitle="Gestão de projetos e investimentos">
        <Button size="sm" onClick={() => openModal()}>
          <Plus className="h-4 w-4" /> Novo Projeto
        </Button>
      </Topbar>

      <div className="p-6 space-y-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-40 bg-white rounded-xl animate-pulse" />)}
          </div>
        ) : projetos.length === 0 ? (
          <EmptyState icon={FolderOpen} title="Nenhum projeto" action={{ label: 'Novo Projeto', onClick: () => openModal() }} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projetos.map((p: any) => (
              <div key={p.id} className="bg-white rounded-xl border border-black/[0.08] p-5 flex flex-col gap-3 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openModal(p)}>
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                    <FolderOpen className="h-5 w-5 text-purple-500" />
                  </div>
                  <Badge variant={p.status === 'ativo' ? 'success' : p.status === 'encerrado' ? 'gray' : 'warning'}>
                    {p.status}
                  </Badge>
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
