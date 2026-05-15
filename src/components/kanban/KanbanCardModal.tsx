'use client'

import { useState } from 'react'
import { X, Trash2, ArrowRight, FolderOpen, Home, Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { KanbanCard, KanbanColumn, ModuleType } from './KanbanBoard'

interface Props {
  card: KanbanCard | null
  moduleType: ModuleType
  columns: KanbanColumn[]
  defaultColumnId: string
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

// Map modal fields → correct table columns per source_table
function buildPayload(sourceTable: string, colField: string, fields: any) {
  if (sourceTable === 'projetos') {
    return { nome: fields.title, descricao: fields.description || null, [colField]: fields.column_id }
  }
  if (sourceTable === 'patrimonios') {
    return { nome: fields.title, notas: fields.description || null, [colField]: fields.column_id }
  }
  if (sourceTable === 'bens_moveis') {
    return { nome: fields.title }
  }
  if (sourceTable === 'empresas') {
    return { nome: fields.title, setor: fields.description || null, [colField]: fields.column_id }
  }
  if (sourceTable === 'oportunidades') {
    return {
      titulo: fields.title,
      descricao: fields.description || null,
      [colField]: fields.column_id,
      valor_estimado: fields.value ? parseFloat(fields.value) : null,
      responsavel: fields.responsavel || null,
    }
  }
  return { nome: fields.title }
}

// Insert new card into the right table
async function insertCard(moduleType: ModuleType, title: string, colId: string, userId: string, supabase: any, extra?: any) {
  if (moduleType === 'projects') {
    return supabase.from('projetos').insert({ nome: title, status: colId, user_id: userId }).select().single()
  }
  if (moduleType === 'assets' || moduleType === 'main') {
    return supabase.from('patrimonios').insert({ nome: title, kanban_coluna: colId, status: 'ativo', user_id: userId }).select().single()
  }
  if (moduleType === 'businesses') {
    return (supabase as any).from('empresas').insert({ nome: title, fase: colId, status: 'ativa', user_id: userId }).select().single()
  }
  if (moduleType === 'pipeline') {
    return (supabase as any).from('oportunidades').insert({
      titulo: title, coluna: colId, user_id: userId,
      descricao: extra?.description || null,
      valor_estimado: extra?.value || null,
      responsavel: extra?.responsavel || null,
    }).select().single()
  }
  return { data: null, error: new Error('Módulo desconhecido') }
}

export function KanbanCardModal({ card, moduleType, columns, defaultColumnId, onClose, onSaved, onDeleted }: Props) {
  const isNew = !card
  const isPipeline = moduleType === 'pipeline'
  const isFechado = (card?.column_id === 'fechado') || (!isNew && card?.raw?.coluna === 'fechado')

  const [title, setTitle]             = useState(card?.title || '')
  const [description, setDescription] = useState(card?.description || card?.raw?.descricao || '')
  const [columnId, setColumnId]       = useState(card?.column_id || defaultColumnId)
  const [responsavel, setResponsavel] = useState(card?.raw?.responsavel || '')
  const [valorEst, setValorEst]       = useState(card?.raw?.valor_estimado?.toString() || '')
  const [saving, setSaving]           = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [converting, setConverting]   = useState(false)

  async function handleSave() {
    if (!title.trim()) { toast.error('Título obrigatório'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Não autenticado'); setSaving(false); return }

    if (isNew) {
      const { error } = await insertCard(moduleType, title.trim(), columnId, user.id, supabase, {
        description: description.trim(), value: valorEst ? parseFloat(valorEst) : null, responsavel: responsavel.trim(),
      })
      if (error) { toast.error(error.message || 'Erro ao criar card'); setSaving(false); return }
      toast.success('Card criado!')
    } else {
      const payload = buildPayload(card!.source_table, card!.source_col_field, {
        title: title.trim(), description: description.trim(), column_id: columnId,
        value: valorEst, responsavel: responsavel.trim(),
      })
      const { error } = await (supabase as any).from(card!.source_table).update(payload).eq('id', card!.id)
      if (error) { toast.error(error.message || 'Erro ao salvar'); setSaving(false); return }
      toast.success('Salvo!')
    }
    setSaving(false)
    onSaved()
  }

  async function handleDelete() {
    if (!card) return
    if (!confirm(`Excluir "${card.title}"?`)) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await (supabase as any).from(card.source_table).delete().eq('id', card.id)
    if (error) { toast.error(error.message); setDeleting(false); return }
    toast.success('Excluído!')
    setDeleting(false)
    onDeleted()
  }

  async function handleConverter(destino: 'projetos' | 'patrimonios' | 'empresas') {
    if (!card) return
    setConverting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Não autenticado'); setConverting(false); return }

    const nomeMap: Record<string, string> = { projetos: 'projetos', patrimonios: 'patrimonios', empresas: 'empresas' }
    const labelMap: Record<string, string> = { projetos: 'Projeto', patrimonios: 'Bem (Imóvel)', empresas: 'Negócio' }

    let error: any = null
    const sb = supabase as any
    if (destino === 'projetos') {
      const res = await sb.from('projetos').insert({ nome: card.title, descricao: description.trim() || null, status: 'planejamento', user_id: user.id })
      error = res.error
    } else if (destino === 'patrimonios') {
      const res = await sb.from('patrimonios').insert({ nome: card.title, notas: description.trim() || null, status: 'ativo', kanban_coluna: 'aquisicao', user_id: user.id })
      error = res.error
    } else if (destino === 'empresas') {
      const res = await sb.from('empresas').insert({ nome: card.title, setor: description.trim() || null, status: 'ativa', fase: 'captacao', user_id: user.id })
      error = res.error
    }

    if (error) { toast.error(error.message || 'Erro ao converter'); setConverting(false); return }

    // Mark oportunidade as converted
    await (supabase as any).from('oportunidades').update({ convertido: true }).eq('id', card.id)
    toast.success(`Convertido para ${labelMap[destino]}!`)
    setConverting(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{card?.icon || '💡'}</span>
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                {isNew ? (isPipeline ? 'Nova Oportunidade' : 'Novo card') : (isPipeline ? 'Oportunidade' : card!.source_table)}
              </span>
              {!isNew && card?.raw?.convertido && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded-full">Convertido</span>
              )}
            </div>
            <input
              className="w-full text-base font-semibold text-gray-900 border-0 focus:outline-none bg-transparent placeholder-gray-300"
              placeholder="Título..."
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isNew && (
              <button onClick={handleDelete} disabled={deleting}
                className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Column */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Fase / Coluna</label>
            <select value={columnId} onChange={e => setColumnId(e.target.value)}
              className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white">
              {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">
              {isPipeline ? 'Descrição da oportunidade' :
               card?.source_table === 'empresas' ? 'Setor / descrição' :
               card?.source_table === 'patrimonios' ? 'Notas' : 'Descrição'}
            </label>
            <textarea rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
              placeholder="Descreva..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Pipeline-specific fields */}
          {isPipeline && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Responsável</label>
                <input className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Nome" value={responsavel} onChange={e => setResponsavel(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Valor estimado (R$)</label>
                <input type="number" step="0.01" className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="0,00" value={valorEst} onChange={e => setValorEst(e.target.value)} />
              </div>
            </div>
          )}

          {/* Extra info for non-pipeline */}
          {!isNew && !isPipeline && card?.raw && (
            <div className="grid grid-cols-2 gap-2">
              {card.value != null && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-gray-400">Valor</p>
                  <p className="text-sm font-bold text-gray-800">{card.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
              )}
              {card.raw.cidade && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-gray-400">Localização</p>
                  <p className="text-sm text-gray-700">{[card.raw.cidade, card.raw.estado].filter(Boolean).join(', ')}</p>
                </div>
              )}
            </div>
          )}

          {/* CONVERTER — only when pipeline card is in "fechado" column */}
          {isPipeline && !isNew && (columnId === 'fechado' || isFechado) && !card?.raw?.convertido && (
            <div className="border border-green-200 bg-green-50 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" /> Converter para...
                </p>
                <p className="text-xs text-green-600 mt-0.5">Esta oportunidade foi fechada. Escolha onde ela será criada:</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleConverter('projetos')} disabled={converting}
                  className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-all disabled:opacity-50">
                  <FolderOpen className="h-5 w-5 text-purple-500" />
                  <span className="text-[11px] font-semibold text-purple-700">Projeto</span>
                </button>
                <button onClick={() => handleConverter('patrimonios')} disabled={converting}
                  className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50">
                  <Home className="h-5 w-5 text-blue-500" />
                  <span className="text-[11px] font-semibold text-blue-700">Bem (Imóvel)</span>
                </button>
                <button onClick={() => handleConverter('empresas')} disabled={converting}
                  className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-all disabled:opacity-50">
                  <Briefcase className="h-5 w-5 text-amber-500" />
                  <span className="text-[11px] font-semibold text-amber-700">Negócio</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/50 flex-shrink-0">
          <button onClick={onClose} className="px-4 h-9 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            {isNew ? 'Cancelar' : 'Fechar'}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 h-9 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors font-medium">
            {saving ? 'Salvando...' : isNew ? 'Criar' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
