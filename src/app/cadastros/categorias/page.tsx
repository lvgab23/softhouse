'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { createClient } from '@/lib/supabase/client'
import type { Categoria } from '@/types/database'

const schema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  taxa_depreciacao: z.number().min(0).max(100),
  vida_util_anos: z.number().min(0),
})

type FormData = z.infer<typeof schema>

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Categoria | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { taxa_depreciacao: 0, vida_util_anos: 0 },
  })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('categorias').select('*').order('nome')
    setCategorias(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openModal = (item?: Categoria) => {
    if (item) {
      setEditing(item)
      reset({ nome: item.nome, taxa_depreciacao: item.taxa_depreciacao || 0, vida_util_anos: item.vida_util_anos || 0 })
    } else {
      setEditing(null)
      reset({ nome: '', taxa_depreciacao: 0, vida_util_anos: 0 })
    }
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const db = supabase as any
    if (editing) {
      const { error } = await db.from('categorias').update(data).eq('id', editing.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('Categoria atualizada!')
    } else {
      const { error } = await db.from('categorias').insert({ ...data, user_id: user.id })
      if (error) { toast.error('Erro ao criar'); return }
      toast.success('Categoria criada!')
    }

    setModalOpen(false)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('categorias').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Categoria excluída')
    setDeleting(null)
    fetchData()
  }

  return (
    <AppLayout>
      <Topbar title="Categorias" subtitle="Gerencie as categorias de patrimônio">
        <Button size="sm" onClick={() => openModal()}>
          <Plus className="h-4 w-4" /> Nova Categoria
        </Button>
      </Topbar>

      <div className="p-6">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-28 bg-white rounded-xl animate-pulse" />)}
          </div>
        ) : categorias.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="Nenhuma categoria cadastrada"
            description="Crie categorias para organizar seus patrimônios"
            action={{ label: 'Nova Categoria', onClick: () => openModal() }}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categorias.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-black/[0.08] p-4 flex flex-col gap-3 group">
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Tag className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openModal(c)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleting(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{c.nome}</p>
                  <p className="text-xs text-gray-400 mt-1">Depreciação: {c.taxa_depreciacao || 0}% a.a.</p>
                  <p className="text-xs text-gray-400">Vida útil: {c.vida_util_anos || 0} anos</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Categoria' : 'Nova Categoria'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <Input label="Nome *" placeholder="Ex: Imóvel Residencial" error={errors.nome?.message} {...register('nome')} />
          <Input label="Taxa de Depreciação (% a.a.)" type="number" step="0.01" min="0" max="100" {...register('taxa_depreciacao', { valueAsNumber: true })} />
          <Input label="Vida Útil (anos)" type="number" min="0" {...register('vida_util_anos', { valueAsNumber: true })} />
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
        <p className="text-sm text-gray-600">Tem certeza que deseja excluir esta categoria?</p>
      </Modal>
    </AppLayout>
  )
}
