'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Plus, Search, X, CheckSquare, Clock, Pencil, Check } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { KanbanCardDetail } from './KanbanCardDetail'

export type BoardType = 'bens' | 'negocios' | 'projetos' | 'pipeline' | 'adm'

export interface FullKanbanCard {
  id: string
  board_type: BoardType
  column_id: string
  title: string
  description: string | null
  priority: 'baixa' | 'media' | 'alta' | 'urgente'
  responsible: string | null
  due_date: string | null
  tags: string[]
  category: string | null
  related_object_id: string | null
  related_object_name: string | null
  related_object_type: string | null
  valor_estimado: number | null
  valor_real: number | null
  tipo_destino: string | null
  convertido: boolean
  position: number
  created_at: string
  updated_at: string
  user_id: string
  checklist_items?: Array<{ id: string; is_completed: boolean }>
}

export interface FullKanbanColumn {
  id: string
  label: string
  color: string
  light: string
  text: string
  border: string
  isCustom?: boolean
}

// ─── Columns per board ────────────────────────────────────────────────────────
const BOARD_COLS: Record<BoardType, FullKanbanColumn[]> = {
  adm: [
    { id: 'adm_col1', label: 'A Fazer',               color: '#6366f1', light: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
    { id: 'adm_col2', label: 'Fazendo',               color: '#3b82f6', light: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    { id: 'adm_col3', label: 'Aguardando Terceiros',  color: '#f59e0b', light: '#fffbeb', text: '#b45309', border: '#fde68a' },
    { id: 'adm_col4', label: 'Pausado',               color: '#94a3b8', light: '#f8fafc', text: '#475569', border: '#e2e8f0' },
    { id: 'adm_col5', label: 'Finalizado',            color: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  ],
  pipeline: [
    { id: 'primeira_reuniao', label: 'Primeira Reunião', color: '#6366f1', light: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
    { id: 'em_analise',       label: 'Em Análise',       color: '#3b82f6', light: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    { id: 'analisado',        label: 'Analisado',        color: '#f59e0b', light: '#fffbeb', text: '#b45309', border: '#fde68a' },
    { id: 'em_compliance',    label: 'Em Compliance',    color: '#f97316', light: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    { id: 'em_fechamento',    label: 'Em Fechamento',    color: '#8b5cf6', light: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
    { id: 'fechado',          label: 'Fechado',          color: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  ],
  bens: [
    { id: 'aquisicao',    label: 'Ideia / Aquisição',    color: '#6366f1', light: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
    { id: 'em_analise',   label: 'Em Análise',           color: '#3b82f6', light: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    { id: 'documentacao', label: 'Documentação',         color: '#f59e0b', light: '#fffbeb', text: '#b45309', border: '#fde68a' },
    { id: 'escritura',    label: 'Escritura / Contrato', color: '#f97316', light: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    { id: 'registro',     label: 'Registro',             color: '#8b5cf6', light: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
    { id: 'manutencao',   label: 'Manutenção',           color: '#ef4444', light: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
    { id: 'em_operacao',  label: 'Em Operação',          color: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    { id: 'pendencias',   label: 'Pendências',           color: '#ec4899', light: '#fdf2f8', text: '#be185d', border: '#fbcfe8' },
    { id: 'concluido',    label: 'Concluído',            color: '#64748b', light: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
  ],
  negocios: [
    { id: 'oportunidade',  label: 'Oportunidade',           color: '#8b5cf6', light: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
    { id: 'em_analise',    label: 'Em Análise',             color: '#3b82f6', light: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    { id: 'due_diligence', label: 'Due Diligence',          color: '#f59e0b', light: '#fffbeb', text: '#b45309', border: '#fde68a' },
    { id: 'negociacao',    label: 'Negociação',             color: '#f97316', light: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    { id: 'contrato',      label: 'Contrato',               color: '#06b6d4', light: '#ecfeff', text: '#0e7490', border: '#a5f3fc' },
    { id: 'investido',     label: 'Investimento Realizado', color: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    { id: 'em_operacao',   label: 'Em Operação',            color: '#10b981', light: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
    { id: 'monitoramento', label: 'Monitoramento',          color: '#6366f1', light: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
    { id: 'encerrado',     label: 'Encerrado',              color: '#64748b', light: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
  ],
  projetos: [
    { id: 'planejamento', label: 'Planejamento', color: '#3b82f6', light: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    { id: 'em_andamento', label: 'Em Andamento', color: '#f59e0b', light: '#fffbeb', text: '#b45309', border: '#fde68a' },
    { id: 'revisao',      label: 'Revisão',      color: '#f97316', light: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    { id: 'ativo',        label: 'Ativo',        color: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    { id: 'pausado',      label: 'Pausado',      color: '#94a3b8', light: '#f8fafc', text: '#475569', border: '#e2e8f0' },
    { id: 'encerrado',    label: 'Encerrado',    color: '#64748b', light: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
  ],
}

// Source table config for auto-sync
const SYNC_CONFIG: Partial<Record<BoardType, {
  table: string; titleField: string; descField?: string; valueField?: string
  defaultCol: string; icon: string
}>> = {
  projetos: { table: 'projetos',    titleField: 'nome', descField: 'descricao',  defaultCol: 'planejamento', icon: '📁' },
  bens:     { table: 'patrimonios', titleField: 'nome', descField: 'notas',      defaultCol: 'aquisicao',    icon: '🏠' },
  negocios: { table: 'empresas',    titleField: 'nome', descField: 'setor',      defaultCol: 'oportunidade', icon: '🏢' },
}

const PRIORITY_COLOR: Record<string, string> = {
  baixa: '#22c55e', media: '#f59e0b', alta: '#f97316', urgente: '#ef4444',
}

const COL_COLORS = [
  { color: '#3b82f6', light: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  { color: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  { color: '#f59e0b', light: '#fffbeb', text: '#b45309', border: '#fde68a' },
  { color: '#8b5cf6', light: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
  { color: '#ef4444', light: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  { color: '#06b6d4', light: '#ecfeff', text: '#0e7490', border: '#a5f3fc' },
  { color: '#f97316', light: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  { color: '#64748b', light: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
]

function isOverdue(due: string | null) {
  if (!due) return false
  return new Date(due) < new Date(new Date().toDateString())
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

interface Props { boardType: BoardType; title: string; subtitle: string }

export function KanbanFullBoard({ boardType, title, subtitle }: Props) {
  const storageKey = `kanban_full_cols_${boardType}`

  const [cards, setCards]             = useState<FullKanbanCard[]>([])
  const [columns, setColumns]         = useState<FullKanbanColumn[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [selectedCardId, setSelected] = useState<string | null>(null)
  const [quickAddCol, setQuickAdd]    = useState<string | null>(null)
  const [quickTitle, setQuickTitle]   = useState('')
  const [addingCol, setAddingCol]     = useState(false)
  const [newColLabel, setNewColLabel] = useState('')
  const [newColColorIdx, setNewColColorIdx] = useState(0)
  const [creating, setCreating]       = useState(false)
  const [syncing, setSyncing]         = useState(false)
  const [editingColId, setEditingColId]     = useState<string | null>(null)
  const [editingColLabel, setEditingColLabel] = useState('')
  const labelsKey = `kanban_col_labels_${boardType}`

  const loadColumns = useCallback(() => {
    const defaults = BOARD_COLS[boardType]
    try {
      const saved    = JSON.parse(localStorage.getItem(storageKey) || '[]') as FullKanbanColumn[]
      const labels   = JSON.parse(localStorage.getItem(`kanban_col_labels_${boardType}`) || '{}') as Record<string, string>
      const customIds = new Set(saved.map(c => c.id))
      const cols = [...defaults.filter(d => !customIds.has(d.id)), ...saved]
      // Apply saved label overrides
      setColumns(cols.map(c => labels[c.id] ? { ...c, label: labels[c.id] } : c))
    } catch { setColumns(BOARD_COLS[boardType]) }
  }, [boardType, storageKey])

  function saveColLabel(colId: string, newLabel: string) {
    if (!newLabel.trim()) return
    const labels = JSON.parse(localStorage.getItem(labelsKey) || '{}') as Record<string, string>
    labels[colId] = newLabel.trim()
    localStorage.setItem(labelsKey, JSON.stringify(labels))
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, label: newLabel.trim() } : c))
    setEditingColId(null)
  }

  // ── Auto-sync original records into kanban_cards ─────────────────────────────
  const syncFromOriginalTable = useCallback(async (sb: any, userId: string, existingCards: FullKanbanCard[]) => {
    const syncCfg = SYNC_CONFIG[boardType]
    if (!syncCfg) return existingCards

    setSyncing(true)
    const { data: records } = await sb.from(syncCfg.table).select('*').eq('user_id', userId)
    if (!records) { setSyncing(false); return existingCards }

    const existingObjectIds = new Set(existingCards.map(c => c.related_object_id).filter(Boolean))
    const toCreate = records.filter((r: any) => !existingObjectIds.has(r.id))

    if (toCreate.length === 0) { setSyncing(false); return existingCards }

    const inserts = toCreate.map((r: any, i: number) => ({
      board_type: boardType,
      column_id: syncCfg.defaultCol,
      title: r[syncCfg.titleField] || '(sem título)',
      description: syncCfg.descField ? (r[syncCfg.descField] || null) : null,
      related_object_id: r.id,
      related_object_type: syncCfg.table,
      related_object_name: r[syncCfg.titleField] || null,
      user_id: userId,
      position: existingCards.length + i,
    }))

    const { data: created } = await sb.from('kanban_cards')
      .insert(inserts)
      .select('*, checklist_items:kanban_checklist_items(id, is_completed)')

    setSyncing(false)
    return [...existingCards, ...(created || [])]
  }, [boardType])

  const fetchCards = useCallback(async () => {
    const sb = createClient() as any
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data, error } = await sb
      .from('kanban_cards')
      .select('*, checklist_items:kanban_checklist_items(id, is_completed)')
      .eq('board_type', boardType)
      .order('position')

    if (error) { toast.error(error.message); setLoading(false); return }

    const synced = await syncFromOriginalTable(sb, user.id, data || [])
    setCards(synced as FullKanbanCard[])
    setLoading(false)
  }, [boardType, syncFromOriginalTable])

  useEffect(() => { loadColumns(); fetchCards() }, [loadColumns, fetchCards])

  // ── Drag & Drop ──────────────────────────────────────────────────────────────
  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return
    const dstCol = destination.droppableId
    setCards(prev => prev.map(c => c.id === draggableId ? { ...c, column_id: dstCol } : c))
    const sb = createClient() as any
    const { error } = await sb.from('kanban_cards').update({ column_id: dstCol, updated_at: new Date().toISOString() }).eq('id', draggableId)
    if (error) { toast.error('Erro ao mover'); fetchCards(); return }
    const card = cards.find(c => c.id === draggableId)
    const oldLabel = columns.find(c => c.id === card?.column_id)?.label
    const newLabel = columns.find(c => c.id === dstCol)?.label
    const { data: { user } } = await sb.auth.getUser()
    if (user) await sb.from('kanban_activity_logs').insert({ card_id: draggableId, user_id: user.id, action_type: 'moved', old_value: oldLabel, new_value: newLabel })
    toast.success(`Movido para ${newLabel || dstCol}`)
  }

  // ── Quick add card ───────────────────────────────────────────────────────────
  async function handleQuickAdd(colId: string) {
    if (!quickTitle.trim()) return
    setCreating(true)
    const sb = createClient() as any
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { toast.error('Não autenticado'); setCreating(false); return }
    const { data, error } = await sb.from('kanban_cards').insert({
      board_type: boardType, column_id: colId, title: quickTitle.trim(),
      user_id: user.id, position: cards.filter(c => c.column_id === colId).length,
    }).select('*, checklist_items:kanban_checklist_items(id, is_completed)').single()
    if (error) { toast.error(error.message); setCreating(false); return }
    await sb.from('kanban_activity_logs').insert({ card_id: data.id, user_id: user.id, action_type: 'created', new_value: data.title })
    setCards(prev => [...prev, data as FullKanbanCard])
    setQuickTitle(''); setQuickAdd(null); setCreating(false)
    setSelected(data.id)
  }

  // ── Add column ──────────────────────────────────────────────────────────────
  function saveNewColumn() {
    if (!newColLabel.trim()) return
    const id = newColLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (columns.find(c => c.id === id)) { toast.error('Coluna já existe'); return }
    const colorConf = COL_COLORS[newColColorIdx]
    const newCol: FullKanbanColumn = { id, label: newColLabel.trim(), ...colorConf, isCustom: true }
    const updated = [...columns, newCol]
    setColumns(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated.filter(c => c.isCustom)))
    setNewColLabel(''); setAddingCol(false)
    toast.success(`Coluna "${newCol.label}" criada!`)
  }

  function deleteColumn(col: FullKanbanColumn) {
    if (!col.isCustom) { toast.error('Colunas padrão não podem ser removidas'); return }
    if (!confirm(`Remover coluna "${col.label}"?`)) return
    setCards(prev => prev.map(c => c.column_id === col.id ? { ...c, column_id: columns[0].id } : c))
    const updated = columns.filter(c => c.id !== col.id)
    setColumns(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated.filter(c => c.isCustom)))
  }

  const grouped = useMemo(() => {
    const g: Record<string, FullKanbanCard[]> = {}
    columns.forEach(c => { g[c.id] = [] })
    const q = search.toLowerCase()
    cards.forEach(card => {
      if (q && !card.title.toLowerCase().includes(q) && !card.description?.toLowerCase().includes(q)) return
      const colId = columns.find(c => c.id === card.column_id) ? card.column_id : columns[0]?.id
      if (colId) (g[colId] = g[colId] || []).push(card)
    })
    return g
  }, [cards, columns, search])

  const selectedCard = selectedCardId ? cards.find(c => c.id === selectedCardId) ?? null : null

  const stats = useMemo(() => ({
    total: cards.length,
    active: cards.filter(c => !['encerrado','concluido','fechado'].includes(c.column_id)).length,
    done: cards.filter(c => ['encerrado','concluido','fechado','investido'].includes(c.column_id)).length,
  }), [cards])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-6 pt-4 pb-2 flex items-center gap-3 flex-wrap">
        <div className="flex gap-3">
          {[
            { label: 'Total', value: stats.total, color: '#6366f1' },
            { label: 'Em andamento', value: stats.active, color: '#f59e0b' },
            { label: 'Concluídos', value: stats.done, color: '#22c55e' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-black/[0.07] px-4 py-2.5">
              <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
              <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
          {syncing && <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 rounded-xl border border-blue-100"><div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/><span className="text-xs text-blue-600">Sincronizando...</span></div>}
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            className="h-9 w-48 rounded-lg border border-gray-200 bg-white pl-8 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3 w-3 text-gray-400" /></button>}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto px-6 pb-6 pt-2">
        {loading ? (
          <div className="flex gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="w-60 flex-shrink-0 space-y-2">
                <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                <div className="h-28 bg-white rounded-xl animate-pulse" />
                <div className="h-20 bg-white rounded-xl animate-pulse opacity-60" />
              </div>
            ))}
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 min-w-max pb-2 items-start">
              {columns.map(col => {
                const colCards = grouped[col.id] || []
                return (
                  <div key={col.id} className="w-64 flex-shrink-0 flex flex-col gap-2">
                    {/* Column header */}
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border group"
                      style={{ background: col.light, borderColor: col.border }}>
                      {editingColId === col.id ? (
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <input
                            autoFocus
                            value={editingColLabel}
                            onChange={e => setEditingColLabel(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveColLabel(col.id, editingColLabel)
                              if (e.key === 'Escape') setEditingColId(null)
                            }}
                            className="flex-1 min-w-0 text-xs font-semibold bg-white/80 border border-white rounded px-1.5 py-0.5 focus:outline-none"
                            style={{ color: col.text }}
                          />
                          <button onClick={() => saveColLabel(col.id, editingColLabel)}
                            className="p-0.5 rounded hover:bg-white/50 flex-shrink-0" style={{ color: col.text }}>
                            <Check className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: col.color }} />
                          <span className="text-xs font-semibold truncate" style={{ color: col.text }}>{col.label}</span>
                          {(boardType === 'pipeline' || boardType === 'adm') && (
                            <button
                              onClick={() => { setEditingColId(col.id); setEditingColLabel(col.label) }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/50 flex-shrink-0 transition-opacity"
                              style={{ color: col.text }}
                              title="Renomear coluna"
                            >
                              <Pencil className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs font-bold bg-white/70 rounded-full w-5 h-5 flex items-center justify-center" style={{ color: col.text }}>
                          {colCards.length}
                        </span>
                        {col.isCustom && editingColId !== col.id && (
                          <button onClick={() => deleteColumn(col)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-100 text-gray-300 hover:text-red-400 transition-opacity">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Cards */}
                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.droppableProps}
                          className={`flex flex-col gap-2 min-h-[80px] rounded-xl p-2 transition-colors ${snapshot.isDraggingOver ? 'bg-slate-100 ring-2 ring-slate-200' : 'bg-slate-50/60'}`}>
                          {colCards.map((card, index) => {
                            const totalCheck = card.checklist_items?.length ?? 0
                            const doneCheck  = card.checklist_items?.filter(i => i.is_completed).length ?? 0
                            const overdue    = isOverdue(card.due_date)
                            return (
                              <Draggable key={card.id} draggableId={card.id} index={index}>
                                {(provided, snapshot) => (
                                  <div ref={provided.innerRef} {...provided.draggableProps}
                                    className={snapshot.isDragging ? 'rotate-1 scale-[1.02]' : ''}>
                                    <div {...provided.dragHandleProps}
                                      onClick={() => setSelected(card.id)}
                                      className="bg-white rounded-xl border border-black/[0.07] shadow-sm hover:shadow-md hover:border-black/[0.14] transition-all cursor-pointer group/card overflow-hidden">
                                      {/* Priority strip */}
                                      <div className="h-1 w-full" style={{ background: PRIORITY_COLOR[card.priority] }} />
                                      <div className="p-3">
                                        {/* Linked badge */}
                                        {card.related_object_id && (
                                          <div className="flex items-center gap-1 mb-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                            <span className="text-[10px] text-blue-500 font-medium truncate">{card.related_object_name || 'Vinculado'}</span>
                                          </div>
                                        )}
                                        {/* Category + Tags */}
                                        {(card.category || (card.tags?.length ?? 0) > 0) && (
                                          <div className="flex flex-wrap gap-1 mb-2">
                                            {card.category && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">{card.category}</span>}
                                            {card.tags?.slice(0, 2).map(tag => <span key={tag} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px]">{tag}</span>)}
                                          </div>
                                        )}
                                        {/* Title */}
                                        <p className="text-xs font-semibold text-gray-900 leading-tight group-hover/card:text-blue-700 transition-colors mb-2">{card.title}</p>
                                        {card.description && <p className="text-[10px] text-gray-400 line-clamp-2 mb-2">{card.description}</p>}
                                        {/* Valor estimado (pipeline) */}
                                        {card.valor_estimado && (
                                          <p className="text-xs font-bold text-green-600 mb-2">{fmtBRL(card.valor_estimado)}</p>
                                        )}
                                        {/* Checklist progress */}
                                        {totalCheck > 0 && (
                                          <div className="mb-2">
                                            <div className="flex items-center gap-1.5 mb-1">
                                              <CheckSquare className="h-3 w-3 text-gray-400" />
                                              <span className="text-[10px] text-gray-400">{doneCheck}/{totalCheck}</span>
                                            </div>
                                            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                              <div className="h-full bg-green-400 rounded-full transition-all"
                                                style={{ width: `${Math.round(doneCheck / totalCheck * 100)}%` }} />
                                            </div>
                                          </div>
                                        )}
                                        {/* Convertido badge (pipeline) */}
                                        {card.convertido && (
                                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded-full">Convertido</span>
                                        )}
                                        {/* Footer */}
                                        <div className="flex items-center justify-between gap-2">
                                          {card.responsible && (
                                            <span className="text-[10px] text-gray-500 flex items-center gap-1 truncate">
                                              <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-[8px] font-bold text-slate-600">
                                                {card.responsible.charAt(0).toUpperCase()}
                                              </div>
                                              <span className="truncate">{card.responsible}</span>
                                            </span>
                                          )}
                                          {card.due_date && (
                                            <span className={`text-[10px] flex items-center gap-1 flex-shrink-0 font-medium ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
                                              <Clock className="h-3 w-3" />{fmtDate(card.due_date)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            )
                          })}
                          {provided.placeholder}

                          {/* Quick add */}
                          {quickAddCol === col.id ? (
                            <div className="bg-white rounded-xl border border-gray-200 p-2 shadow-sm">
                              <textarea autoFocus rows={2} value={quickTitle}
                                onChange={e => setQuickTitle(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickAdd(col.id) } if (e.key === 'Escape') { setQuickAdd(null); setQuickTitle('') } }}
                                placeholder="Título do card..."
                                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none mb-2" />
                              <div className="flex gap-1.5">
                                <button onClick={() => handleQuickAdd(col.id)} disabled={creating || !quickTitle.trim()}
                                  className="flex-1 h-7 bg-slate-800 text-white text-xs rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
                                  {creating ? '...' : 'Adicionar'}
                                </button>
                                <button onClick={() => { setQuickAdd(null); setQuickTitle('') }} className="px-2 h-7 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => { setQuickAdd(col.id); setQuickTitle('') }}
                              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] text-gray-400 hover:text-gray-600 hover:bg-white/80 border border-dashed border-gray-200 hover:border-gray-300 transition-all mt-0.5">
                              <Plus className="h-3 w-3" /> Adicionar card
                            </button>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )
              })}

              {/* Add column */}
              <div className="w-56 flex-shrink-0">
                {addingCol ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm space-y-2">
                    <input autoFocus value={newColLabel} onChange={e => setNewColLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveNewColumn(); if (e.key === 'Escape') setAddingCol(false) }}
                      placeholder="Nome da coluna..."
                      className="w-full h-8 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-slate-300" />
                    <div className="flex gap-1 flex-wrap">
                      {COL_COLORS.map((c, i) => (
                        <button key={i} onClick={() => setNewColColorIdx(i)}
                          className={`w-5 h-5 rounded-full border-2 transition-all ${newColColorIdx === i ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                          style={{ background: c.color }} />
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={saveNewColumn} className="flex-1 h-8 bg-slate-800 text-white text-xs rounded-lg hover:bg-slate-700">Criar</button>
                      <button onClick={() => { setAddingCol(false); setNewColLabel('') }} className="px-3 h-8 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddingCol(true)}
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-white/60 border border-dashed border-gray-200 text-gray-400 text-xs font-medium hover:bg-white hover:text-gray-600 hover:border-gray-300 transition-all">
                    <Plus className="h-4 w-4" /> Adicionar coluna
                  </button>
                )}
              </div>
            </div>
          </DragDropContext>
        )}
      </div>

      {/* Card detail modal */}
      {selectedCard && (
        <KanbanCardDetail
          card={selectedCard}
          columns={columns}
          boardType={boardType}
          onClose={() => setSelected(null)}
          onSaved={(updated) => {
            setCards(prev => prev.map(c => c.id === selectedCard.id ? { ...c, ...updated } : c))
          }}
          onDeleted={() => {
            setCards(prev => prev.filter(c => c.id !== selectedCard.id))
            setSelected(null)
          }}
          onReload={fetchCards}
        />
      )}
    </div>
  )
}
