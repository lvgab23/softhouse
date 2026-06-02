'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  X, Trash2, Plus, CheckSquare, Clock, User2, Calendar,
  Flag, MessageSquare, ChevronDown, ChevronRight, Check, Tag,
  Link2, Activity, Circle, ArrowRight, FolderOpen, Home, Briefcase,
  DollarSign, Paperclip, FileText, Image, ExternalLink, Upload, Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { CurrencyInput } from '@/components/ui/currency-input'
import type { FullKanbanCard, FullKanbanColumn, BoardType } from './KanbanFullBoard'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChecklistItem {
  id: string; card_id: string; title: string
  is_completed: boolean; order_index: number; created_at: string; completed_at: string | null
}
interface KanbanTask {
  id: string; card_id: string; title: string; responsible: string | null
  status: 'pendente' | 'em_andamento' | 'concluido'; priority: 'baixa' | 'media' | 'alta'
  due_date: string | null; notes: string | null; created_at: string; completed_at: string | null
}
interface CardComment {
  id: string; card_id: string; user_id: string; user_email: string | null
  comment: string; created_at: string
}
interface ActivityLog {
  id: string; card_id: string; action_type: string
  old_value: string | null; new_value: string | null; created_at: string
}
interface CardAttachment {
  id: string; card_id: string; user_id: string; type: 'file' | 'link'
  name: string; url: string; file_path: string | null
  mime_type: string | null; size_bytes: number | null; created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIORITY_OPTIONS = [
  { value: 'baixa',   label: 'Baixa',   color: '#22c55e', bg: '#f0fdf4', text: '#15803d' },
  { value: 'media',   label: 'Média',   color: '#f59e0b', bg: '#fffbeb', text: '#b45309' },
  { value: 'alta',    label: 'Alta',    color: '#f97316', bg: '#fff7ed', text: '#c2410c' },
  { value: 'urgente', label: 'Urgente', color: '#ef4444', bg: '#fef2f2', text: '#b91c1c' },
]

const TASK_STATUS = [
  { value: 'pendente',     label: 'Pendente',     color: '#94a3b8' },
  { value: 'em_andamento', label: 'Em andamento', color: '#f59e0b' },
  { value: 'concluido',    label: 'Concluído',    color: '#22c55e' },
]

const BOARD_CATEGORIES: Record<BoardType, string[]> = {
  pipeline: ['Imóvel', 'Empresa', 'Projeto', 'Investimento', 'Parceria', 'Outro'],
  bens:     ['Imóvel', 'Veículo', 'Usina', 'Equipamento', 'Terreno', 'Participação', 'Outro'],
  negocios: ['Empresa', 'Franquia', 'Compra de Participação', 'Investimento', 'Parceria', 'Operação', 'Renda Passiva'],
  projetos: ['Projeto', 'Tarefa', 'Iniciativa', 'Outro'],
  adm:      ['Administrativo', 'Financeiro', 'Jurídico', 'RH', 'TI', 'Operacional', 'Outro'],
}

const ACTION_LABELS: Record<string, string> = {
  created:           'Card criado',
  moved:             'Movido de coluna',
  title_changed:     'Título alterado',
  desc_changed:      'Descrição atualizada',
  priority_changed:  'Prioridade alterada',
  responsible_changed: 'Responsável alterado',
  due_date_changed:  'Prazo alterado',
  checklist_added:   'Item de checklist adicionado',
  checklist_done:    'Item de checklist concluído',
  checklist_undone:  'Item de checklist desmarcado',
  task_added:        'Tarefa adicionada',
  task_done:         'Tarefa concluída',
  comment_added:     'Comentário adicionado',
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'agora há pouco'
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function priorityConf(p: string) {
  return PRIORITY_OPTIONS.find(o => o.value === p) || PRIORITY_OPTIONS[1]
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  card: FullKanbanCard
  columns: FullKanbanColumn[]
  boardType: BoardType
  onClose: () => void
  onSaved: (updated: Partial<FullKanbanCard>) => void
  onDeleted: () => void
  onReload: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────
export function KanbanCardDetail({ card, columns, boardType, onClose, onSaved, onDeleted, onReload }: Props) {
  const supabase = createClient() as any

  // card fields (local state mirrors DB)
  const [title, setTitle]             = useState(card.title)
  const [description, setDescription] = useState(card.description || '')
  const [priority, setPriority]       = useState(card.priority)
  const [responsible, setResponsible] = useState(card.responsible || '')
  const [dueDate, setDueDate]         = useState(card.due_date || '')
  const [category, setCategory]       = useState(card.category || '')
  const [columnId, setColumnId]         = useState(card.column_id)
  const [tags, setTags]                 = useState<string[]>(card.tags || [])
  const [tagInput, setTagInput]         = useState('')
  const [relatedName, setRelatedName]   = useState(card.related_object_name || '')
  const [valorEst, setValorEst]         = useState<number | null>(card.valor_estimado ?? null)
  const [valorReal, setValorReal]       = useState<number | null>(card.valor_real ?? null)
  const [converting, setConverting]     = useState(false)

  // related data
  const [checklist, setChecklist]       = useState<ChecklistItem[]>([])
  const [tasks, setTasks]               = useState<KanbanTask[]>([])
  const [comments, setComments]         = useState<CardComment[]>([])
  const [activity, setActivity]         = useState<ActivityLog[]>([])
  const [attachments, setAttachments]   = useState<CardAttachment[]>([])

  // ui state
  const [loading, setLoading]             = useState(true)
  const [newCheckTitle, setNewCheckTitle] = useState('')
  const [addingCheck, setAddingCheck]     = useState(false)
  const [newTaskTitle, setNewTaskTitle]   = useState('')
  const [addingTask, setAddingTask]       = useState(false)
  const [newComment, setNewComment]       = useState('')
  const [submittingComment, setSubmitting] = useState(false)
  const [showActivity, setShowActivity]   = useState(false)
  const [expandedTask, setExpandedTask]   = useState<string | null>(null)
  const [userId, setUserId]               = useState('')
  const [userEmail, setUserEmail]         = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)
  const [addingLink, setAddingLink]       = useState(false)
  const [linkName, setLinkName]           = useState('')
  const [linkUrl, setLinkUrl]             = useState('')
  const [previewAtt, setPreviewAtt]       = useState<CardAttachment | null>(null)
  const fileInputRef                      = useRef<HTMLInputElement>(null)

  const commentsEndRef = useRef<HTMLDivElement>(null)

  // ── Load all data ────────────────────────────────────────────────────────────
  const loadDetail = useCallback(async () => {
    setLoading(true)
    const [{ data: cl }, { data: tk }, { data: cm }, { data: ac }, { data: at }, { data: { user } }] = await Promise.all([
      supabase.from('kanban_checklist_items').select('*').eq('card_id', card.id).order('order_index'),
      supabase.from('kanban_tasks').select('*').eq('card_id', card.id).order('created_at'),
      supabase.from('kanban_comments').select('*').eq('card_id', card.id).order('created_at'),
      supabase.from('kanban_activity_logs').select('*').eq('card_id', card.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('kanban_attachments').select('*').eq('card_id', card.id).order('created_at'),
      supabase.auth.getUser(),
    ])
    setChecklist(cl || [])
    setTasks(tk || [])
    setComments(cm || [])
    setActivity(ac || [])
    setAttachments(at || [])
    if (user) { setUserId(user.id); setUserEmail(user.email || '') }
    setLoading(false)
  }, [card.id])

  useEffect(() => { loadDetail() }, [loadDetail])
  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [comments])

  // ── Log helper ───────────────────────────────────────────────────────────────
  async function log(actionType: string, oldValue?: string, newValue?: string) {
    if (!userId) return
    await supabase.from('kanban_activity_logs').insert({ card_id: card.id, user_id: userId, action_type: actionType, old_value: oldValue ?? null, new_value: newValue ?? null })
    setActivity(prev => [{ id: crypto.randomUUID(), card_id: card.id, action_type: actionType, old_value: oldValue ?? null, new_value: newValue ?? null, created_at: new Date().toISOString() }, ...prev])
  }

  // ── Save field ───────────────────────────────────────────────────────────────
  async function saveField(field: string, value: any, logAction?: string, oldVal?: string, newVal?: string) {
    const { error } = await supabase.from('kanban_cards').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', card.id)
    if (error) { toast.error(error.message); return }
    if (logAction) await log(logAction, oldVal, newVal)
    onSaved({ [field]: value } as any)
  }

  // ── Title save ───────────────────────────────────────────────────────────────
  async function handleTitleBlur() {
    if (!title.trim()) { setTitle(card.title); return }
    if (title === card.title) return
    await saveField('title', title.trim(), 'title_changed', card.title, title.trim())
    toast.success('Título atualizado')
  }

  // ── Description save ─────────────────────────────────────────────────────────
  async function handleDescBlur() {
    if (description === (card.description || '')) return
    await saveField('description', description || null, 'desc_changed')
    toast.success('Descrição salva')
  }

  // ── Priority ─────────────────────────────────────────────────────────────────
  async function handlePriority(val: string) {
    const old = priority; setPriority(val as any)
    await saveField('priority', val, 'priority_changed', old, val)
  }

  // ── Column ───────────────────────────────────────────────────────────────────
  async function handleColumn(val: string) {
    const oldLabel = columns.find(c => c.id === columnId)?.label
    const newLabel = columns.find(c => c.id === val)?.label
    setColumnId(val)
    await saveField('column_id', val, 'moved', oldLabel, newLabel)
    toast.success(`Movido para ${newLabel}`)
  }

  // ── Responsible ──────────────────────────────────────────────────────────────
  async function handleResponsibleBlur() {
    if (responsible === (card.responsible || '')) return
    await saveField('responsible', responsible || null, 'responsible_changed', card.responsible || '', responsible)
  }

  // ── Due date ─────────────────────────────────────────────────────────────────
  async function handleDueDate(val: string) {
    setDueDate(val)
    await saveField('due_date', val || null, 'due_date_changed', card.due_date || '', val)
  }

  // ── Category ─────────────────────────────────────────────────────────────────
  async function handleCategory(val: string) {
    setCategory(val)
    await saveField('category', val || null)
  }

  // ── Tags ──────────────────────────────────────────────────────────────────────
  async function addTag() {
    const t = tagInput.trim()
    if (!t || tags.includes(t)) return
    const next = [...tags, t]
    setTags(next); setTagInput('')
    await saveField('tags', next)
  }
  async function removeTag(tag: string) {
    const next = tags.filter(t => t !== tag)
    setTags(next)
    await saveField('tags', next)
  }

  // ── Related object name ───────────────────────────────────────────────────────
  async function handleRelatedBlur() {
    if (relatedName === (card.related_object_name || '')) return
    await saveField('related_object_name', relatedName || null)
  }

  // ── Valores financeiros ──────────────────────────────────────────────────────
  async function handleValorEstBlur() {
    if (valorEst === card.valor_estimado) return
    await saveField('valor_estimado', valorEst)
  }
  async function handleValorRealBlur() {
    if (valorReal === card.valor_real) return
    await saveField('valor_real', valorReal)
  }

  // ── Converter (pipeline → projeto/bem/negócio) ───────────────────────────────
  async function handleConverter(destino: 'projetos' | 'patrimonios' | 'empresas') {
    if (!userId) return
    setConverting(true)
    const labelMap: Record<string, string> = { projetos: 'Projeto', patrimonios: 'Bem (Imóvel)', empresas: 'Negócio' }
    let error: any = null
    if (destino === 'projetos') {
      const res = await supabase.from('projetos').insert({ nome: title, descricao: description || null, status: 'planejamento', user_id: userId })
      error = res.error
    } else if (destino === 'patrimonios') {
      const res = await supabase.from('patrimonios').insert({ nome: title, notas: description || null, status: 'ativo', kanban_coluna: 'aquisicao', user_id: userId })
      error = res.error
    } else if (destino === 'empresas') {
      const res = await supabase.from('empresas').insert({ nome: title, setor: description || null, status: 'ativa', fase: 'oportunidade', user_id: userId })
      error = res.error
    }
    if (error) { toast.error(error.message || 'Erro ao converter'); setConverting(false); return }
    await saveField('convertido', true)
    await log('converted', undefined, labelMap[destino])
    toast.success(`Convertido para ${labelMap[destino]}!`)
    setConverting(false)
    onSaved({ convertido: true } as any)
  }

  // ── Checklist ────────────────────────────────────────────────────────────────
  async function addCheckItem() {
    if (!newCheckTitle.trim()) return
    const { data, error } = await supabase.from('kanban_checklist_items').insert({
      card_id: card.id, title: newCheckTitle.trim(), order_index: checklist.length,
    }).select().single()
    if (error) { toast.error(error.message); return }
    setChecklist(prev => [...prev, data])
    setNewCheckTitle('')
    await log('checklist_added', undefined, newCheckTitle.trim())
    onReload()
  }

  async function toggleCheck(item: ChecklistItem) {
    const done = !item.is_completed
    setChecklist(prev => prev.map(c => c.id === item.id ? { ...c, is_completed: done, completed_at: done ? new Date().toISOString() : null } : c))
    await supabase.from('kanban_checklist_items').update({ is_completed: done, completed_at: done ? new Date().toISOString() : null }).eq('id', item.id)
    await log(done ? 'checklist_done' : 'checklist_undone', undefined, item.title)
    onReload()
  }

  async function deleteCheck(id: string) {
    setChecklist(prev => prev.filter(c => c.id !== id))
    await supabase.from('kanban_checklist_items').delete().eq('id', id)
    onReload()
  }

  // ── Tasks ────────────────────────────────────────────────────────────────────
  async function addTask() {
    if (!newTaskTitle.trim()) return
    const { data, error } = await supabase.from('kanban_tasks').insert({
      card_id: card.id, title: newTaskTitle.trim(),
    }).select().single()
    if (error) { toast.error(error.message); return }
    setTasks(prev => [...prev, data])
    setNewTaskTitle(''); setAddingTask(false)
    await log('task_added', undefined, newTaskTitle.trim())
  }

  async function toggleTask(task: KanbanTask) {
    const next = task.status === 'concluido' ? 'pendente' : 'concluido'
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next, completed_at: next === 'concluido' ? new Date().toISOString() : null } : t))
    await supabase.from('kanban_tasks').update({ status: next, completed_at: next === 'concluido' ? new Date().toISOString() : null }).eq('id', task.id)
    if (next === 'concluido') await log('task_done', undefined, task.title)
  }

  async function updateTaskField(id: string, field: string, value: any) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
    await supabase.from('kanban_tasks').update({ [field]: value }).eq('id', id)
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    await supabase.from('kanban_tasks').delete().eq('id', id)
  }

  // ── Comments ─────────────────────────────────────────────────────────────────
  async function submitComment() {
    if (!newComment.trim() || !userId) return
    setSubmitting(true)
    const { data, error } = await supabase.from('kanban_comments').insert({
      card_id: card.id, user_id: userId, user_email: userEmail, comment: newComment.trim(),
    }).select().single()
    if (error) { toast.error(error.message); setSubmitting(false); return }
    setComments(prev => [...prev, data])
    setNewComment(''); setSubmitting(false)
    await log('comment_added')
  }

  async function deleteComment(id: string) {
    setComments(prev => prev.filter(c => c.id !== id))
    await supabase.from('kanban_comments').delete().eq('id', id)
  }

  // ── Attachments ───────────────────────────────────────────────────────────────
  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) { toast.error('Apenas PDF, JPG ou PNG'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('Arquivo maior que 10 MB'); return }

    setUploadingFile(true)
    const ext      = file.name.split('.').pop()
    const filePath = `${userId}/${card.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('kanban-attachments').upload(filePath, file)
    if (upErr) { toast.error(upErr.message || 'Erro no upload'); setUploadingFile(false); return }

    const { data: urlData } = supabase.storage.from('kanban-attachments').getPublicUrl(filePath)
    const publicUrl = urlData?.publicUrl || ''

    const { data, error } = await supabase.from('kanban_attachments').insert({
      card_id: card.id, user_id: userId, type: 'file',
      name: file.name, url: publicUrl, file_path: filePath,
      mime_type: file.type, size_bytes: file.size,
    }).select().single()

    if (error) { toast.error(error.message); setUploadingFile(false); return }
    setAttachments(prev => [...prev, data])
    toast.success('Arquivo enviado!')
    setUploadingFile(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function saveLink() {
    if (!linkName.trim() || !linkUrl.trim()) { toast.error('Preencha nome e URL'); return }
    if (!userId) return
    const { data, error } = await supabase.from('kanban_attachments').insert({
      card_id: card.id, user_id: userId, type: 'link',
      name: linkName.trim(), url: linkUrl.trim(),
    }).select().single()
    if (error) { toast.error(error.message); return }
    setAttachments(prev => [...prev, data])
    setLinkName(''); setLinkUrl(''); setAddingLink(false)
    toast.success('Link adicionado!')
  }

  async function deleteAttachment(att: CardAttachment) {
    if (!confirm(`Remover "${att.name}"?`)) return
    if (att.file_path) {
      await supabase.storage.from('kanban-attachments').remove([att.file_path])
    }
    await supabase.from('kanban_attachments').delete().eq('id', att.id)
    setAttachments(prev => prev.filter(a => a.id !== att.id))
    toast.success('Removido!')
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function attIcon(att: CardAttachment) {
    if (att.type === 'link') {
      const isDrive = att.url.includes('drive.google.com') || att.url.includes('docs.google.com')
      return isDrive
        ? <span className="text-[10px] font-bold text-blue-600 bg-blue-50 rounded px-1 flex-shrink-0">Drive</span>
        : <ExternalLink className="h-4 w-4 text-blue-500 flex-shrink-0" />
    }
    if (att.mime_type?.startsWith('image/')) return <Image className="h-4 w-4 text-purple-500 flex-shrink-0" />
    return <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
  }

  function getPreviewUrl(att: CardAttachment): string {
    const url = att.url
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/)
    if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`
    const docsMatch = url.match(/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([^/?]+)/)
    if (docsMatch) return `https://docs.google.com/${docsMatch[1]}/d/${docsMatch[2]}/preview`
    return url
  }

  function canPreview(att: CardAttachment): boolean {
    return att.mime_type?.startsWith('image/') ||
      att.mime_type === 'application/pdf' ||
      att.type === 'link'
  }

  // ── Delete card ───────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirm(`Excluir o card "${card.title}"?\nChecklist, tarefas e comentários também serão removidos.`)) return
    const { error } = await supabase.from('kanban_cards').delete().eq('id', card.id)
    if (error) { toast.error(error.message); return }
    toast.success('Card excluído')
    onDeleted()
  }

  const checkTotal = checklist.length
  const checkDone  = checklist.filter(c => c.is_completed).length
  const pConf      = priorityConf(priority)

  return (
    <>
    {/* ── Preview modal ─────────────────────────────────────────────────────── */}
    {previewAtt && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewAtt(null)} />
        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '92vh' }}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {attIcon(previewAtt)}
              <span className="text-sm font-semibold text-gray-800 truncate">{previewAtt.name}</span>
              {previewAtt.size_bytes && <span className="text-[10px] text-gray-400 flex-shrink-0">{formatSize(previewAtt.size_bytes)}</span>}
            </div>
            <a href={previewAtt.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 h-7 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 flex-shrink-0 transition-colors">
              <ExternalLink className="h-3 w-3" /> Abrir original
            </a>
            <button onClick={() => setPreviewAtt(null)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto bg-gray-100 min-h-0 flex items-center justify-center">
            {previewAtt.mime_type?.startsWith('image/') && (
              <img
                src={previewAtt.url}
                alt={previewAtt.name}
                className="max-w-full max-h-full object-contain p-4"
                style={{ maxHeight: 'calc(92vh - 56px)' }}
              />
            )}
            {previewAtt.mime_type === 'application/pdf' && (
              <iframe
                src={previewAtt.url}
                title={previewAtt.name}
                className="w-full border-0"
                style={{ height: 'calc(92vh - 56px)' }}
              />
            )}
            {previewAtt.type === 'link' && (() => {
              const isDrive = previewAtt.url.includes('drive.google.com') || previewAtt.url.includes('docs.google.com')
              if (isDrive) {
                return (
                  <div className="flex flex-col items-center justify-center gap-4 p-8 text-center" style={{ height: 'calc(92vh - 56px)' }}>
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
                      <span className="text-2xl font-black text-blue-600">G</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 mb-1">Arquivo do Google Drive</p>
                      <p className="text-sm text-gray-500 max-w-xs">O Google não permite visualização incorporada para arquivos privados. Clique abaixo para abrir diretamente no Drive.</p>
                    </div>
                    <a
                      href={previewAtt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" /> Abrir no Google Drive
                    </a>
                  </div>
                )
              }
              return (
                <iframe
                  src={getPreviewUrl(previewAtt)}
                  title={previewAtt.name}
                  className="w-full border-0"
                  style={{ height: 'calc(92vh - 56px)' }}
                  allow="autoplay"
                />
              )
            })()}
          </div>
        </div>
      </div>
    )}

    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-8">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 px-6 pt-5 pb-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{boardType}</span>
              <span className="text-gray-300">›</span>
              <span className="text-[10px] text-gray-400">{columns.find(c => c.id === columnId)?.label}</span>
            </div>
            <textarea
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              rows={1}
              className="w-full text-xl font-bold text-gray-900 border-0 focus:outline-none bg-transparent resize-none leading-tight"
              style={{ minHeight: '32px' }}
            />
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 mt-1">
            <button onClick={handleDelete} className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors" title="Excluir card">
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row overflow-y-auto max-h-[75vh]">

          {/* ── Main content ──────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 px-6 py-5 space-y-6 overflow-y-auto">

            {/* Description */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Descrição</p>
              <textarea rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                onBlur={handleDescBlur}
                placeholder="Adicione uma descrição mais detalhada..."
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none text-gray-700 placeholder-gray-300"
              />
            </div>

            {/* Checklist */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-gray-400" />
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Checklist</p>
                  {checkTotal > 0 && (
                    <span className="text-xs text-gray-400">{checkDone}/{checkTotal}</span>
                  )}
                </div>
                <button onClick={() => setAddingCheck(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Adicionar item
                </button>
              </div>
              {checkTotal > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full transition-all"
                        style={{ width: `${checkTotal ? Math.round(checkDone / checkTotal * 100) : 0}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 font-medium w-8 text-right">
                      {checkTotal ? Math.round(checkDone / checkTotal * 100) : 0}%
                    </span>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                {checklist.map(item => (
                  <div key={item.id} className="flex items-center gap-2 group py-1">
                    <button onClick={() => toggleCheck(item)} className="flex-shrink-0">
                      {item.is_completed
                        ? <div className="w-4 h-4 rounded bg-green-500 flex items-center justify-center"><Check className="h-2.5 w-2.5 text-white" /></div>
                        : <div className="w-4 h-4 rounded border-2 border-gray-300 hover:border-blue-400 transition-colors" />
                      }
                    </button>
                    <span className={`flex-1 text-sm ${item.is_completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.title}</span>
                    <button onClick={() => deleteCheck(item.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              {addingCheck && (
                <div className="mt-2 flex gap-2">
                  <input autoFocus value={newCheckTitle} onChange={e => setNewCheckTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addCheckItem(); if (e.key === 'Escape') { setAddingCheck(false); setNewCheckTitle('') } }}
                    placeholder="Novo item..."
                    className="flex-1 h-8 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-slate-300" />
                  <button onClick={addCheckItem} className="px-3 h-8 bg-slate-800 text-white text-xs rounded-lg hover:bg-slate-700 transition-colors">Adicionar</button>
                  <button onClick={() => { setAddingCheck(false); setNewCheckTitle('') }} className="px-2 h-8 border border-gray-200 text-gray-400 rounded-lg hover:bg-gray-50">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {checklist.length === 0 && !addingCheck && (
                <p className="text-xs text-gray-300 italic py-1">Nenhum item no checklist.</p>
              )}
            </div>

            {/* Tasks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Circle className="h-4 w-4 text-gray-400" />
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tarefas</p>
                  {tasks.length > 0 && <span className="text-xs text-gray-400">{tasks.filter(t => t.status === 'concluido').length}/{tasks.length}</span>}
                </div>
                <button onClick={() => setAddingTask(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Adicionar tarefa
                </button>
              </div>
              <div className="space-y-1.5">
                {tasks.map(task => {
                  const statusConf = TASK_STATUS.find(s => s.value === task.status) || TASK_STATUS[0]
                  const expanded   = expandedTask === task.id
                  return (
                    <div key={task.id} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/50 group">
                        <button onClick={() => toggleTask(task)} className="flex-shrink-0">
                          {task.status === 'concluido'
                            ? <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"><Check className="h-2.5 w-2.5 text-white" /></div>
                            : <div className="w-4 h-4 rounded-full border-2 border-gray-300 hover:border-blue-400 transition-colors" style={{ borderColor: statusConf.color }} />
                          }
                        </button>
                        <span className={`flex-1 text-sm min-w-0 truncate ${task.status === 'concluido' ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task.title}</span>
                        {task.responsible && <span className="text-[10px] text-gray-400 flex-shrink-0">{task.responsible}</span>}
                        {task.due_date && <span className="text-[10px] text-gray-400 flex-shrink-0">{formatDate(task.due_date)}</span>}
                        <button onClick={() => setExpandedTask(expanded ? null : task.id)} className="p-0.5 rounded text-gray-300 hover:text-gray-500 flex-shrink-0">
                          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </button>
                        <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all flex-shrink-0">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      {expanded && (
                        <div className="px-3 py-3 border-t border-gray-100 grid grid-cols-2 gap-2 bg-white">
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 font-medium">Responsável</label>
                            <input value={task.responsible || ''} onChange={e => updateTaskField(task.id, 'responsible', e.target.value)}
                              className="w-full h-7 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-slate-300" placeholder="Nome" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 font-medium">Status</label>
                            <select value={task.status} onChange={e => updateTaskField(task.id, 'status', e.target.value)}
                              className="w-full h-7 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none bg-white">
                              {TASK_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 font-medium">Prazo</label>
                            <input type="date" value={task.due_date || ''} onChange={e => updateTaskField(task.id, 'due_date', e.target.value || null)}
                              className="w-full h-7 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-slate-300" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-gray-400 font-medium">Prioridade</label>
                            <select value={task.priority} onChange={e => updateTaskField(task.id, 'priority', e.target.value)}
                              className="w-full h-7 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none bg-white">
                              <option value="baixa">Baixa</option>
                              <option value="media">Média</option>
                              <option value="alta">Alta</option>
                            </select>
                          </div>
                          <div className="col-span-2 space-y-1">
                            <label className="text-[10px] text-gray-400 font-medium">Observação</label>
                            <textarea rows={2} value={task.notes || ''} onChange={e => updateTaskField(task.id, 'notes', e.target.value || null)}
                              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-300 resize-none" placeholder="Observação..." />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {addingTask && (
                <div className="mt-2 flex gap-2">
                  <input autoFocus value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') { setAddingTask(false); setNewTaskTitle('') } }}
                    placeholder="Nome da tarefa..."
                    className="flex-1 h-8 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-slate-300" />
                  <button onClick={addTask} className="px-3 h-8 bg-slate-800 text-white text-xs rounded-lg hover:bg-slate-700">Adicionar</button>
                  <button onClick={() => { setAddingTask(false); setNewTaskTitle('') }} className="px-2 h-8 border border-gray-200 text-gray-400 rounded-lg hover:bg-gray-50">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {tasks.length === 0 && !addingTask && <p className="text-xs text-gray-300 italic py-1">Nenhuma tarefa.</p>}
            </div>

            {/* Comments */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4 text-gray-400" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Comentários {comments.length > 0 && `(${comments.length})`}
                </p>
              </div>
              <div className="space-y-3 mb-3 max-h-52 overflow-y-auto">
                {comments.map(c => (
                  <div key={c.id} className="flex gap-2.5 group">
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-600 mt-0.5">
                      {(c.user_email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-700">{c.user_id === userId ? 'Você' : (c.user_email?.split('@')[0] || 'Usuário')}</span>
                        <span className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</span>
                        {c.user_id === userId && (
                          <button onClick={() => deleteComment(c.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">{c.comment}</p>
                    </div>
                  </div>
                ))}
                <div ref={commentsEndRef} />
              </div>
              {comments.length === 0 && <p className="text-xs text-gray-300 italic mb-3">Nenhum comentário.</p>}
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white mt-0.5">
                  {userEmail.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <textarea rows={2} value={newComment} onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) submitComment() }}
                    placeholder="Escreva um comentário... (Ctrl+Enter para enviar)"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none text-gray-700 placeholder-gray-300" />
                  {newComment.trim() && (
                    <button onClick={submitComment} disabled={submittingComment}
                      className="mt-1.5 px-4 h-7 bg-slate-800 text-white text-xs rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
                      {submittingComment ? 'Enviando...' : 'Comentar'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-gray-400" />
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Documentos {attachments.length > 0 && `(${attachments.length})`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    title="Enviar PDF ou imagem"
                    className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800 border border-gray-200 rounded-lg px-2.5 h-7 hover:bg-gray-50 transition-colors disabled:opacity-50">
                    <Upload className="h-3 w-3" />
                    {uploadingFile ? 'Enviando...' : 'Arquivo'}
                  </button>
                  <button
                    onClick={() => setAddingLink(v => !v)}
                    title="Adicionar link Google Drive ou outro"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-2.5 h-7 hover:bg-blue-50 transition-colors">
                    <Link2 className="h-3 w-3" /> Link
                  </button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={uploadFile}
              />

              {addingLink && (
                <div className="mb-3 p-3 border border-blue-100 bg-blue-50/50 rounded-xl space-y-2">
                  <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide">Adicionar link</p>
                  <input
                    autoFocus
                    value={linkName}
                    onChange={e => setLinkName(e.target.value)}
                    placeholder="Nome do documento..."
                    className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
                  <input
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveLink(); if (e.key === 'Escape') { setAddingLink(false); setLinkName(''); setLinkUrl('') } }}
                    placeholder="https://drive.google.com/..."
                    className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setAddingLink(false); setLinkName(''); setLinkUrl('') }}
                      className="px-3 h-7 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                      Cancelar
                    </button>
                    <button onClick={saveLink}
                      className="px-3 h-7 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors">
                      Salvar link
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2.5 group px-3 py-2 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                    {att.mime_type?.startsWith('image/') ? (
                      <img
                        src={att.url} alt={att.name}
                        onClick={() => setPreviewAtt(att)}
                        className="w-9 h-9 object-cover rounded-lg flex-shrink-0 cursor-pointer border border-gray-200 hover:border-blue-300 transition-colors" />
                    ) : attIcon(att)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate font-medium">{att.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {att.type === 'link'
                          ? (att.url.includes('drive.google.com') || att.url.includes('docs.google.com') ? 'Google Drive' : 'Link externo')
                          : formatSize(att.size_bytes)}
                        {' · '}
                        {new Date(att.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    {canPreview(att) && (
                      <button
                        onClick={() => setPreviewAtt(att)}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 h-6 text-[10px] border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 flex-shrink-0 transition-all">
                        <Eye className="h-3 w-3" /> Ver
                      </button>
                    )}
                    <a href={att.url} target="_blank" rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-blue-50 text-gray-300 hover:text-blue-400 transition-all flex-shrink-0"
                      title="Abrir em nova aba">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <button
                      onClick={() => deleteAttachment(att)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all flex-shrink-0">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              {attachments.length === 0 && !addingLink && (
                <p className="text-xs text-gray-300 italic py-1">Nenhum documento anexado.</p>
              )}
            </div>

            {/* Activity */}
            <div>
              <button onClick={() => setShowActivity(v => !v)}
                className="flex items-center gap-2 mb-3 w-full text-left group">
                <Activity className="h-4 w-4 text-gray-400" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Histórico de atividades</p>
                {showActivity ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
              </button>
              {showActivity && (
                <div className="space-y-2">
                  {activity.length === 0 && <p className="text-xs text-gray-300 italic">Sem atividades registradas.</p>}
                  {activity.map(a => (
                    <div key={a.id} className="flex gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0 mt-1.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">{ACTION_LABELS[a.action_type] || a.action_type}</span>
                          {a.new_value && <span className="text-gray-400"> → <span className="text-gray-600">{a.new_value}</span></span>}
                        </p>
                        <p className="text-[10px] text-gray-400">{timeAgo(a.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right sidebar ──────────────────────────────────────────────────── */}
          <div className="w-full md:w-56 flex-shrink-0 bg-gray-50/50 border-t md:border-t-0 md:border-l border-gray-100 px-4 py-5 space-y-4">

            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Detalhes do card</p>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><Flag className="h-3 w-3" /> Prioridade</label>
              <div className="grid grid-cols-2 gap-1">
                {PRIORITY_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => handlePriority(opt.value)}
                    className={`h-7 rounded-lg text-xs font-medium border transition-all ${priority === opt.value ? 'border-transparent shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    style={priority === opt.value ? { background: opt.bg, color: opt.text, borderColor: opt.color } : {}}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Column */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Coluna / Fase</label>
              <select value={columnId} onChange={e => handleColumn(e.target.value)}
                className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white">
                {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>

            {/* Responsible */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><User2 className="h-3 w-3" /> Responsável</label>
              <input value={responsible} onChange={e => setResponsible(e.target.value)} onBlur={handleResponsibleBlur}
                placeholder="Nome ou e-mail"
                className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white" />
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Data de vencimento</label>
              <input type="date" value={dueDate} onChange={e => handleDueDate(e.target.value)}
                className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white" />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Categoria</label>
              <select value={category} onChange={e => handleCategory(e.target.value)}
                className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white">
                <option value="">— Selecione —</option>
                {BOARD_CATEGORIES[boardType].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><Tag className="h-3 w-3" /> Tags</label>
              <div className="flex flex-wrap gap-1 mb-1">
                {tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-medium">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-red-400"><X className="h-2.5 w-2.5" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  placeholder="Nova tag..."
                  className="flex-1 h-7 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-slate-300" />
                <button onClick={addTag} className="px-2 h-7 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Linked object */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><Link2 className="h-3 w-3" /> Objeto vinculado</label>
              <input value={relatedName} onChange={e => setRelatedName(e.target.value)} onBlur={handleRelatedBlur}
                placeholder={boardType === 'bens' ? 'Ex: Imóvel Av. Brasil' : boardType === 'negocios' ? 'Ex: Empresa XYZ' : 'Ex: Projeto ABC'}
                className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white" />
            </div>

            {/* Financeiro */}
            <div className="space-y-1.5 pt-2 border-t border-gray-100">
              <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5"><DollarSign className="h-3 w-3" /> Financeiro</label>
              <div className="space-y-1.5">
                <CurrencyInput
                  label="Valor estimado"
                  value={valorEst}
                  onChange={v => setValorEst(v)}
                  onBlur={handleValorEstBlur}
                  className="h-8 text-xs"
                />
                <CurrencyInput
                  label="Valor real"
                  value={valorReal}
                  onChange={v => setValorReal(v)}
                  onBlur={handleValorRealBlur}
                  className="h-8 text-xs"
                />
                {valorEst !== null && valorReal !== null && valorEst > 0 && (
                  <div className={`rounded-lg px-2.5 py-1.5 ${valorReal >= valorEst ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    <p className="text-[10px]">{valorReal >= valorEst ? '▲' : '▼'} Variação: {((valorReal / valorEst - 1) * 100).toFixed(1)}%</p>
                  </div>
                )}
              </div>
            </div>

            {/* Converter (pipeline em fechado) */}
            {boardType === 'pipeline' && (columnId === 'fechado') && !card.convertido && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-green-700 flex items-center gap-1.5">
                  <ArrowRight className="h-3 w-3" /> Converter para...
                </p>
                <p className="text-[10px] text-gray-400">Oportunidade fechada. Escolha o destino:</p>
                <button onClick={() => handleConverter('projetos')} disabled={converting}
                  className="w-full flex items-center gap-2 h-8 px-3 bg-white border border-purple-200 hover:bg-purple-50 rounded-lg text-xs font-medium text-purple-700 transition-all disabled:opacity-50">
                  <FolderOpen className="h-3.5 w-3.5" /> Projeto
                </button>
                <button onClick={() => handleConverter('patrimonios')} disabled={converting}
                  className="w-full flex items-center gap-2 h-8 px-3 bg-white border border-blue-200 hover:bg-blue-50 rounded-lg text-xs font-medium text-blue-700 transition-all disabled:opacity-50">
                  <Home className="h-3.5 w-3.5" /> Bem (Imóvel)
                </button>
                <button onClick={() => handleConverter('empresas')} disabled={converting}
                  className="w-full flex items-center gap-2 h-8 px-3 bg-white border border-amber-200 hover:bg-amber-50 rounded-lg text-xs font-medium text-amber-700 transition-all disabled:opacity-50">
                  <Briefcase className="h-3.5 w-3.5" /> Negócio
                </button>
              </div>
            )}
            {card.convertido && (
              <div className="pt-2 border-t border-gray-100">
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">✓ Convertido</span>
              </div>
            )}

            {/* Timestamps */}
            <div className="pt-2 border-t border-gray-100 space-y-1">
              <p className="text-[10px] text-gray-400">Criado em {new Date(card.created_at).toLocaleDateString('pt-BR')}</p>
              <p className="text-[10px] text-gray-400">Atualizado {timeAgo(card.updated_at)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
