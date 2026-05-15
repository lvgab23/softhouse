'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Plus, Search, X, AlertCircle, Clock, Pencil, Trash2, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatShort } from '@/lib/utils'
import { KanbanCardModal } from './KanbanCardModal'

export type ModuleType = 'projects' | 'assets' | 'businesses' | 'main' | 'pipeline'

export interface KanbanCard {
  id: string
  title: string
  description?: string
  column_id: string
  source_table: string
  source_col_field: string
  value?: number
  icon: string
  icon_color: string
  raw: any
}

export interface KanbanColumn {
  id: string
  label: string
  color: string   // hex
  light: string   // hex bg
  text: string    // hex text
  border: string  // hex border
  isCustom?: boolean
}

// ─── Default columns per module ────────────────────────────────────────────
const DEFAULT_COLS: Record<ModuleType, KanbanColumn[]> = {
  projects: [
    { id: 'planejamento', label: 'Planejamento', color: '#3b82f6', light: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    { id: 'em_andamento', label: 'Em Andamento', color: '#f59e0b', light: '#fffbeb', text: '#b45309', border: '#fde68a' },
    { id: 'revisao',      label: 'Revisão',       color: '#f97316', light: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    { id: 'ativo',        label: 'Ativo',          color: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    { id: 'pausado',      label: 'Pausado',        color: '#94a3b8', light: '#f8fafc', text: '#475569', border: '#e2e8f0' },
    { id: 'encerrado',    label: 'Encerrado',      color: '#64748b', light: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
  ],
  assets: [
    { id: 'em_analise',    label: 'Em Análise',       color: '#6366f1', light: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
    { id: 'aquisicao',     label: 'Em Aquisição',     color: '#3b82f6', light: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    { id: 'documentacao',  label: 'Documentação',     color: '#f59e0b', light: '#fffbeb', text: '#b45309', border: '#fde68a' },
    { id: 'regularizacao', label: 'Regularização',    color: '#f97316', light: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    { id: 'ativo',         label: 'Ativo',            color: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    { id: 'manutencao',    label: 'Manutenção',       color: '#ef4444', light: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
    { id: 'encerrado',     label: 'Vendido/Encerrado',color: '#64748b', light: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
  ],
  businesses: [
    { id: 'oportunidade',  label: 'Oportunidade',   color: '#8b5cf6', light: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
    { id: 'em_analise',    label: 'Em Análise',     color: '#3b82f6', light: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    { id: 'negociacao',    label: 'Negociação',     color: '#f59e0b', light: '#fffbeb', text: '#b45309', border: '#fde68a' },
    { id: 'due_diligence', label: 'Due Diligence',  color: '#f97316', light: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    { id: 'contrato',      label: 'Contrato',       color: '#06b6d4', light: '#ecfeff', text: '#0e7490', border: '#a5f3fc' },
    { id: 'ativo',         label: 'Ativo',          color: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    { id: 'encerrado',     label: 'Encerrado',      color: '#64748b', light: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
  ],
  main: [
    { id: 'negociacao',  label: 'Negociação',  color: '#3b82f6', light: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    { id: 'aquisicao',   label: 'Aquisição',   color: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    { id: 'registro',    label: 'Registro',    color: '#f59e0b', light: '#fffbeb', text: '#b45309', border: '#fde68a' },
    { id: 'manutencao',  label: 'Manutenção',  color: '#f97316', light: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    { id: 'avaliacao',   label: 'Avaliação',   color: '#8b5cf6', light: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
  ],
  pipeline: [
    { id: 'primeira_reuniao', label: 'Primeira Reunião', color: '#6366f1', light: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
    { id: 'em_analise',       label: 'Em Análise',       color: '#3b82f6', light: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    { id: 'analisado',        label: 'Analisado',        color: '#f59e0b', light: '#fffbeb', text: '#b45309', border: '#fde68a' },
    { id: 'em_compliance',    label: 'Em Compliance',    color: '#f97316', light: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    { id: 'em_fechamento',    label: 'Em Fechamento',    color: '#8b5cf6', light: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
    { id: 'fechado',          label: 'Fechado',          color: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  ],
}

// ─── Map raw DB row → KanbanCard ────────────────────────────────────────────
function mapCard(row: any, sourceTable: string, sourceColField: string, defaultColId: string, icon: string, iconColor: string): KanbanCard {
  return {
    id: row.id,
    title: row.nome || row.title || '(sem título)',
    description: row.descricao || row.notas || row.setor || row.observacoes || undefined,
    column_id: row[sourceColField] || defaultColId,
    source_table: sourceTable,
    source_col_field: sourceColField,
    value: row.valor_atual || row.valor_total || row.valor_aquisicao || row.valor_investimento || undefined,
    icon,
    icon_color: iconColor,
    raw: row,
  }
}

// ─── Load cards from DB by module ──────────────────────────────────────────
async function loadCards(moduleType: ModuleType, supabase: any): Promise<KanbanCard[]> {
  if (moduleType === 'projects') {
    const { data } = await supabase.from('projetos').select('*').order('created_at')
    return (data || []).map((r: any) => mapCard(r, 'projetos', 'status', 'planejamento', '📁', '#8b5cf6'))
  }
  if (moduleType === 'assets') {
    const [pa, bm] = await Promise.all([
      supabase.from('patrimonios').select('*').order('created_at'),
      supabase.from('bens_moveis').select('*').order('created_at'),
    ])
    const patrimonios = (pa.data || []).map((r: any) => mapCard(r, 'patrimonios', 'kanban_coluna', 'ativo', '🏠', '#3b82f6'))
    const bens = (bm.data || []).map((r: any) => {
      const colMap: Record<string, string> = { ativo: 'ativo', manutencao: 'manutencao', inativo: 'encerrado', vendido: 'encerrado' }
      const col = colMap[r.status] || 'ativo'
      return mapCard({ ...r, kanban_col: col }, 'bens_moveis', 'kanban_col', 'ativo', '🚗', '#22c55e')
    })
    return [...patrimonios, ...bens]
  }
  if (moduleType === 'businesses') {
    const { data } = await (supabase as any).from('empresas').select('*').order('created_at')
    return (data || []).map((r: any) => mapCard(r, 'empresas', 'fase', 'oportunidade', '🏢', '#f59e0b'))
  }
  if (moduleType === 'pipeline') {
    const { data } = await (supabase as any).from('oportunidades').select('*').order('created_at')
    return (data || []).map((r: any) => mapCard(
      { ...r, nome: r.titulo, descricao: r.descricao },
      'oportunidades', 'coluna', 'primeira_reuniao', '💡', '#6366f1'
    ))
  }
  // main
  const { data } = await supabase.from('patrimonios').select('*').order('created_at')
  return (data || []).map((r: any) => mapCard(r, 'patrimonios', 'kanban_coluna', 'negociacao', '🏠', '#3b82f6'))
}

// ─── Update card column in DB ────────────────────────────────────────────────
async function persistMove(card: KanbanCard, newColId: string, supabase: any) {
  if (card.source_table === 'projetos') {
    await supabase.from('projetos').update({ status: newColId }).eq('id', card.id)
  } else if (card.source_table === 'patrimonios') {
    await supabase.from('patrimonios').update({ kanban_coluna: newColId }).eq('id', card.id)
  } else if (card.source_table === 'bens_moveis') {
    const colMap: Record<string, string> = { ativo: 'ativo', manutencao: 'manutencao', encerrado: 'inativo' }
    const status = colMap[newColId] || 'ativo'
    await (supabase as any).from('bens_moveis').update({ status }).eq('id', card.id)
  } else if (card.source_table === 'empresas') {
    await (supabase as any).from('empresas').update({ fase: newColId }).eq('id', card.id)
  } else if (card.source_table === 'oportunidades') {
    await (supabase as any).from('oportunidades').update({ coluna: newColId }).eq('id', card.id)
  }
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

interface Props { moduleType: ModuleType; title: string; subtitle: string }

export function KanbanBoard({ moduleType, title, subtitle }: Props) {
  const storageKey = `kanban_custom_cols_${moduleType}`

  const [cards, setCards] = useState<KanbanCard[]>([])
  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null)
  const [createCol, setCreateCol] = useState<string | null>(null)

  // Add column form
  const [addingCol, setAddingCol] = useState(false)
  const [newColLabel, setNewColLabel] = useState('')
  const [newColColorIdx, setNewColColorIdx] = useState(0)

  // Load columns (defaults + saved custom)
  const loadColumns = useCallback(() => {
    const defaults = DEFAULT_COLS[moduleType]
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]') as KanbanColumn[]
      const customIds = new Set(saved.map(c => c.id))
      const merged = [...defaults.filter(d => !customIds.has(d.id)), ...saved]
      setColumns(merged)
    } catch {
      setColumns(defaults)
    }
  }, [moduleType, storageKey])

  const fetchCards = useCallback(async () => {
    const supabase = createClient()
    const loaded = await loadCards(moduleType, supabase)
    setCards(loaded)
    setLoading(false)
  }, [moduleType])

  useEffect(() => { loadColumns(); fetchCards() }, [loadColumns, fetchCards])

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const dstCol = destination.droppableId
    setCards(prev => prev.map(c => c.id === draggableId ? { ...c, column_id: dstCol } : c))

    const card = cards.find(c => c.id === draggableId)
    if (!card) return
    const supabase = createClient()
    try {
      await persistMove({ ...card, column_id: dstCol }, dstCol, supabase)
      const col = columns.find(c => c.id === dstCol)
      toast.success(`Movido para ${col?.label || dstCol}`)
    } catch {
      toast.error('Erro ao mover card')
      fetchCards()
    }
  }

  // ── Add column ─────────────────────────────────────────────────────────────
  function saveNewColumn() {
    if (!newColLabel.trim()) return
    const id = newColLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (columns.find(c => c.id === id)) { toast.error('Coluna já existe'); return }
    const colorConf = COL_COLORS[newColColorIdx]
    const newCol: KanbanColumn = { id, label: newColLabel.trim(), ...colorConf, isCustom: true }
    const updated = [...columns, newCol]
    setColumns(updated)
    const custom = updated.filter(c => c.isCustom)
    localStorage.setItem(storageKey, JSON.stringify(custom))
    setNewColLabel('')
    setAddingCol(false)
    toast.success(`Coluna "${newCol.label}" criada!`)
  }

  function deleteColumn(col: KanbanColumn) {
    if (!col.isCustom) { toast.error('Colunas padrão não podem ser removidas'); return }
    if (!confirm(`Remover coluna "${col.label}"? Os cards serão movidos para a primeira coluna.`)) return
    const firstColId = columns[0].id
    setCards(prev => prev.map(c => c.column_id === col.id ? { ...c, column_id: firstColId } : c))
    const updated = columns.filter(c => c.id !== col.id)
    setColumns(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated.filter(c => c.isCustom)))
    toast.success('Coluna removida')
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = cards.length
    const active = cards.filter(c => c.column_id === 'ativo' || c.column_id === 'em_andamento').length
    const done = cards.filter(c => c.column_id === 'encerrado' || c.column_id === 'concluido').length
    const totalValue = cards.reduce((s, c) => s + (c.value || 0), 0)
    return { total, active, done, totalValue }
  }, [cards])

  // ── Filter ─────────────────────────────────────────────────────────────────
  function filtered(colCards: KanbanCard[]) {
    if (!search.trim()) return colCards
    const q = search.toLowerCase()
    return colCards.filter(c => c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q))
  }

  // ── Group by column ────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const g: Record<string, KanbanCard[]> = {}
    columns.forEach(c => { g[c.id] = [] })
    cards.forEach(card => {
      const colId = columns.find(c => c.id === card.column_id) ? card.column_id : columns[0]?.id
      if (colId) (g[colId] = g[colId] || []).push(card)
    })
    return g
  }, [cards, columns])

  return (
    <div className="flex flex-col h-full">
      {/* Stats */}
      <div className="px-6 pt-4 pb-2 flex gap-3">
        {[
          { label: 'Total de cards', value: stats.total, color: '#6366f1' },
          { label: 'Em andamento', value: stats.active, color: '#f59e0b' },
          { label: 'Concluídos', value: stats.done, color: '#22c55e' },
          { label: 'Valor total', value: stats.totalValue > 0 ? formatShort(stats.totalValue) : '—', color: '#64748b', isText: true },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-black/[0.07] px-4 py-3 flex items-center gap-3">
            <div>
              <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          </div>
        ))}
        <div className="flex-1" />
        {/* Search */}
        <div className="relative self-center">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            className="h-9 w-52 rounded-lg border border-gray-200 bg-white pl-8 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3 w-3 text-gray-400" /></button>}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto px-6 pb-6 pt-3">
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
                const colCards = filtered(grouped[col.id] || [])
                const colValue = (grouped[col.id] || []).reduce((s, c) => s + (c.value || 0), 0)
                return (
                  <div key={col.id} className="w-64 flex-shrink-0 flex flex-col gap-2">
                    {/* Column header */}
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border group"
                      style={{ background: col.light, borderColor: col.border }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: col.color }} />
                        <span className="text-xs font-semibold truncate" style={{ color: col.text }}>{col.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {colValue > 0 && <span className="text-[10px] opacity-60" style={{ color: col.text }}>{formatShort(colValue)}</span>}
                        <span className="text-xs font-bold bg-white/70 rounded-full w-5 h-5 flex items-center justify-center" style={{ color: col.text }}>
                          {colCards.length}
                        </span>
                        {col.isCustom && (
                          <button onClick={() => deleteColumn(col)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-100 text-gray-300 hover:text-red-400">
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
                          {colCards.map((card, index) => (
                            <Draggable key={card.id} draggableId={card.id} index={index}>
                              {(provided, snapshot) => (
                                <div ref={provided.innerRef} {...provided.draggableProps}
                                  className={snapshot.isDragging ? 'rotate-1 scale-[1.02]' : ''}>
                                  <div {...provided.dragHandleProps}
                                    onClick={() => setSelectedCard(card)}
                                    className="bg-white rounded-xl border border-black/[0.07] p-3 shadow-sm hover:shadow-md hover:border-black/[0.14] transition-all cursor-pointer group/card">
                                    <div className="flex items-start gap-2 mb-1.5">
                                      <span className="text-sm flex-shrink-0 mt-0.5">{card.icon}</span>
                                      <p className="text-xs font-semibold text-gray-900 leading-tight group-hover/card:text-blue-700 transition-colors">{card.title}</p>
                                    </div>
                                    {card.description && (
                                      <p className="text-[10px] text-gray-400 line-clamp-2 mb-2 pl-6">{card.description}</p>
                                    )}
                                    {card.value && (
                                      <p className="text-xs font-bold text-gray-600 pl-6">{formatShort(card.value)}</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}

                          {/* Add card */}
                          <button onClick={() => setCreateCol(col.id)}
                            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] text-gray-400 hover:text-gray-600 hover:bg-white/80 border border-dashed border-gray-200 hover:border-gray-300 transition-all mt-0.5">
                            <Plus className="h-3 w-3" /> Adicionar card
                          </button>
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
                      <button onClick={saveNewColumn} className="flex-1 h-8 bg-slate-800 text-white text-xs rounded-lg hover:bg-slate-700 transition-colors">Criar</button>
                      <button onClick={() => { setAddingCol(false); setNewColLabel('') }}
                        className="px-3 h-8 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
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

      {/* Modal */}
      {(selectedCard !== null || createCol !== null) && (
        <KanbanCardModal
          card={selectedCard}
          moduleType={moduleType}
          columns={columns}
          defaultColumnId={createCol || selectedCard?.column_id || columns[0]?.id || ''}
          onClose={() => { setSelectedCard(null); setCreateCol(null) }}
          onSaved={() => { setSelectedCard(null); setCreateCol(null); fetchCards() }}
          onDeleted={() => { setSelectedCard(null); fetchCards() }}
        />
      )}
    </div>
  )
}
