'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, ArrowLeft, LayoutGrid, Pin } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { usePortfolio } from '@/lib/portfolio-context'
import { KanbanFullBoard, type FullKanbanColumn } from '@/components/kanban/KanbanFullBoard'

interface BoardRow {
  id: string
  name: string
  color: string
  icon: string | null
  columns: FullKanbanColumn[]
  position: number
  created_at: string
}

const BOARD_COLORS = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b', '#0ea5e9']

// Colunas iniciais de um quadro novo (o usuário pode personalizar depois)
const DEFAULT_COLS: FullKanbanColumn[] = [
  { id: 'a_fazer',   label: 'A Fazer',   color: '#6366f1', light: '#eef2ff', text: '#4338ca', border: '#c7d2fe', isCustom: true },
  { id: 'fazendo',   label: 'Fazendo',   color: '#f59e0b', light: '#fffbeb', text: '#b45309', border: '#fde68a', isCustom: true },
  { id: 'concluido', label: 'Concluído', color: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0', isCustom: true },
]

export default function KanbanPage() {
  const { activeOwnerId } = usePortfolio()
  const [boards, setBoards]   = useState<BoardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<BoardRow | 'pipeline' | null>(null)

  // Modais
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing]   = useState<BoardRow | null>(null)
  const [name, setName]         = useState('')
  const [color, setColor]       = useState(BOARD_COLORS[0])
  const [saving, setSaving]     = useState(false)
  const [deleteBoard, setDeleteBoard] = useState<BoardRow | null>(null)

  const fetchBoards = useCallback(async () => {
    if (!activeOwnerId) return
    const sb = createClient() as any
    const { data, error } = await sb
      .from('kanban_boards')
      .select('*')
      .eq('user_id', activeOwnerId)
      .order('position')
      .order('created_at')
    if (error) { toast.error(error.message); setLoading(false); return }
    setBoards((data || []) as BoardRow[])
    setLoading(false)
  }, [activeOwnerId])

  useEffect(() => { fetchBoards() }, [fetchBoards])

  function openCreate() {
    setEditing(null); setName(''); setColor(BOARD_COLORS[0]); setFormOpen(true)
  }
  function openEdit(b: BoardRow) {
    setEditing(b); setName(b.name); setColor(b.color || BOARD_COLORS[0]); setFormOpen(true)
  }

  async function saveBoard() {
    if (!name.trim()) { toast.error('Dê um nome ao quadro'); return }
    setSaving(true)
    const sb = createClient() as any
    if (editing) {
      const { error } = await sb.from('kanban_boards').update({ name: name.trim(), color }).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Quadro atualizado!')
    } else {
      const { error } = await sb.from('kanban_boards').insert({
        name: name.trim(), color, columns: DEFAULT_COLS, position: boards.length,
      })
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Quadro criado!')
    }
    setSaving(false); setFormOpen(false)
    fetchBoards()
  }

  async function confirmDelete() {
    if (!deleteBoard) return
    const sb = createClient() as any
    const { error } = await sb.from('kanban_boards').delete().eq('id', deleteBoard.id)
    if (error) { toast.error(error.message); return }
    toast.success('Quadro excluído')
    setDeleteBoard(null)
    fetchBoards()
  }

  // Objeto estável passado ao board (evita recarregar em loop)
  const boardProp = useMemo(
    () => (selected && selected !== 'pipeline' ? { id: selected.id, initialColumns: selected.columns } : undefined),
    [selected]
  )

  // ── Visão de um quadro aberto ────────────────────────────────────────────────
  if (selected) {
    const isPipeline = selected === 'pipeline'
    const title = isPipeline ? 'Pipeline de Oportunidades' : selected.name
    return (
      <AppLayout>
        <Topbar title={title} subtitle="Kanban" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-4">
            <button
              onClick={() => { setSelected(null); fetchBoards() }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
              <ArrowLeft className="h-4 w-4" /> Voltar aos quadros
            </button>
          </div>
          {isPipeline ? (
            <KanbanFullBoard boardType="pipeline" title={title} subtitle="" />
          ) : (
            <KanbanFullBoard key={selected.id} boardType="adm" title={title} subtitle="" board={boardProp} />
          )}
        </div>
      </AppLayout>
    )
  }

  // ── Lista de quadros ("Seus quadros") ────────────────────────────────────────
  return (
    <AppLayout>
      <Topbar title="Kanban" subtitle="Seus quadros de tarefas">
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Novo quadro</Button>
      </Topbar>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-2 mb-4">
          <LayoutGrid className="h-5 w-5 text-gray-400" />
          <h2 className="text-base font-bold text-gray-800">Seus quadros</h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white rounded-xl animate-pulse border border-black/[0.06]" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Pipeline fixado (separado, intacto) */}
            <button
              onClick={() => setSelected('pipeline')}
              className="relative h-28 rounded-xl overflow-hidden text-left group border border-black/[0.08] shadow-sm hover:shadow-md transition-all"
              style={{ background: 'linear-gradient(135deg, #4338ca, #6366f1)' }}>
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5">
                <Pin className="h-3 w-3 text-white" /><span className="text-[10px] text-white font-medium">Fixado</span>
              </div>
              <div className="absolute inset-0 p-4 flex flex-col justify-end">
                <p className="text-white font-bold text-sm leading-tight">Pipeline de Oportunidades</p>
                <p className="text-white/70 text-[11px] mt-0.5">Quadro do sistema</p>
              </div>
            </button>

            {/* Quadros do usuário */}
            {boards.map(b => (
              <div key={b.id}
                className="relative h-28 rounded-xl overflow-hidden group border border-black/[0.08] shadow-sm hover:shadow-md transition-all cursor-pointer"
                style={{ background: `linear-gradient(135deg, ${b.color}, ${b.color}cc)` }}
                onClick={() => setSelected(b)}>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => { e.stopPropagation(); openEdit(b) }}
                    className="p-1.5 rounded-lg bg-white/20 hover:bg-white/40 text-white" title="Editar quadro">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setDeleteBoard(b) }}
                    className="p-1.5 rounded-lg bg-white/20 hover:bg-red-500/70 text-white" title="Excluir quadro">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="absolute inset-0 p-4 flex flex-col justify-end">
                  <p className="text-white font-bold text-sm leading-tight">{b.name}</p>
                  <p className="text-white/70 text-[11px] mt-0.5">{b.columns?.length || 0} colunas</p>
                </div>
              </div>
            ))}

            {/* Criar novo quadro */}
            <button
              onClick={openCreate}
              className="h-28 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-white transition-all">
              <Plus className="h-6 w-6" />
              <span className="text-sm font-medium">Criar novo quadro</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal criar/editar */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar quadro' : 'Novo quadro'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={saveBoard} loading={saving}>{editing ? 'Salvar' : 'Criar'}</Button>
          </>
        }>
        <div className="space-y-4">
          <Input label="Nome do quadro *" placeholder="Ex: ADM Super Santos" value={name}
            onChange={e => setName(e.target.value)} autoFocus />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Cor</label>
            <div className="flex flex-wrap gap-2">
              {BOARD_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          {!editing && (
            <p className="text-[11px] text-gray-400">
              O quadro começa com as colunas <b>A Fazer</b>, <b>Fazendo</b> e <b>Concluído</b>. Você pode
              adicionar, renomear, reordenar e excluir colunas dentro do quadro.
            </p>
          )}
        </div>
      </Modal>

      {/* Modal excluir */}
      <Modal
        open={!!deleteBoard}
        onClose={() => setDeleteBoard(null)}
        title="Excluir quadro"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteBoard(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDelete}>Excluir</Button>
          </>
        }>
        <p className="text-sm text-gray-600">
          Tem certeza que deseja excluir o quadro <b>{deleteBoard?.name}</b>? Todos os cards dele
          serão removidos. Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </AppLayout>
  )
}
