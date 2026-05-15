'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { buscaCNPJ } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Fornecedor } from '@/types/database'

const schema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  cnpj: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  categoria: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Fornecedor | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [loadingCNPJ, setLoadingCNPJ] = useState(false)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const cnpjValue = watch('cnpj')

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('fornecedores').select('*').order('nome')
    setFornecedores(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCNPJ = async (cnpj: string) => {
    if (cnpj.replace(/\D/g, '').length !== 14) return
    setLoadingCNPJ(true)
    try {
      const data = await buscaCNPJ(cnpj)
      if (data && data.nome) {
        setValue('nome', data.nome)
        setValue('email', data.email || '')
        setValue('telefone', data.telefone || '')
      }
    } catch {}
    setLoadingCNPJ(false)
  }

  const openModal = (item?: Fornecedor) => {
    if (item) {
      setEditing(item)
      reset({ nome: item.nome, cnpj: item.cnpj || '', telefone: item.telefone || '', email: item.email || '', categoria: item.categoria || '' })
    } else {
      setEditing(null)
      reset({ nome: '', cnpj: '', telefone: '', email: '', categoria: '' })
    }
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (editing) {
      const { error } = await supabase.from('fornecedores').update(data).eq('id', editing.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('Fornecedor atualizado!')
    } else {
      const { error } = await supabase.from('fornecedores').insert({ ...data, user_id: user.id })
      if (error) { toast.error('Erro ao criar'); return }
      toast.success('Fornecedor criado!')
    }

    setModalOpen(false)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('fornecedores').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Fornecedor excluído')
    setDeleting(null)
    fetchData()
  }

  const filtered = fornecedores.filter(f =>
    f.nome.toLowerCase().includes(search.toLowerCase()) ||
    (f.cnpj || '').includes(search) ||
    (f.categoria || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AppLayout>
      <Topbar title="Fornecedores" subtitle="Gerencie seus fornecedores">
        <Button size="sm" onClick={() => openModal()}>
          <Plus className="h-4 w-4" /> Novo Fornecedor
        </Button>
      </Topbar>

      <div className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar fornecedor..."
              className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-white rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Nenhum fornecedor encontrado" action={{ label: 'Novo Fornecedor', onClick: () => openModal() }} />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">CNPJ</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Telefone</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">E-mail</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Categoria</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => (
                  <tr key={f.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === filtered.length - 1 ? 'border-b-0' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{f.nome}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{f.cnpj || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{f.telefone || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{f.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{f.categoria || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openModal(f)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setDeleting(f.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
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
        title={editing ? 'Editar Fornecedor' : 'Novo Fornecedor'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{editing ? 'Salvar' : 'Criar'}</Button>
          </>
        }
      >
        <form className="space-y-4">
          <Input
            label="CNPJ (busca automática)"
            placeholder="00.000.000/0001-00"
            {...register('cnpj', { onBlur: (e) => handleCNPJ(e.target.value) })}
          />
          <Input label="Nome *" error={errors.nome?.message} {...register('nome')} />
          <Input label="Telefone" {...register('telefone')} />
          <Input label="E-mail" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Categoria" placeholder="Ex: Construção, Elétrica..." {...register('categoria')} />
        </form>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Confirmar exclusão" size="sm"
        footer={<><Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="danger" onClick={() => deleting && handleDelete(deleting)}>Excluir</Button></>}>
        <p className="text-sm text-gray-600">Tem certeza que deseja excluir este fornecedor?</p>
      </Modal>
    </AppLayout>
  )
}
