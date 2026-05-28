'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, RefreshCw, Eye, Bell, CheckCircle2,
  AlertTriangle, Clock, ShieldCheck, PlayCircle,
  Newspaper, Search, ChevronDown, ChevronRight,
  ExternalLink, Building2, User, FileText, BadgeCheck,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

type Monitorado = {
  id: string; documento: string; tipo: 'CPF' | 'CNPJ'; nome: string | null
  ativo: boolean; frequencia: string; ultima_verificacao: string | null
  proximo_verificacao: string | null; score_ultimo: number | null
  nivel_ultimo: string | null; mudanca_detectada: boolean; created_at: string
}

type DiarioMonitorado = {
  id: string; termo: string; tipo: string; ativo: boolean
  ultima_busca: string | null; total_resultados: number; novos_resultados: number
  created_at: string
}

type DiarioResultado = {
  id: string; fonte: string; fonte_tipo: string; data_publicacao: string | null
  titulo: string; resumo: string; url: string; lido: boolean
}

// ── Configs ──────────────────────────────────────────────────────────────────

const NIVEL_CFG: Record<string, { label: string; color: string; bg: string }> = {
  CRITICO: { label: 'Crítico', color: 'text-red-600', bg: 'bg-red-100' },
  ALTO:    { label: 'Alto',    color: 'text-orange-600', bg: 'bg-orange-100' },
  MEDIO:   { label: 'Médio',  color: 'text-yellow-600', bg: 'bg-yellow-100' },
  BAIXO:   { label: 'Baixo',  color: 'text-blue-600', bg: 'bg-blue-100' },
  LIMPO:   { label: 'Limpo',  color: 'text-green-600', bg: 'bg-green-100' },
}
const FREQ_LABELS: Record<string, string> = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal' }

const TIPO_CFG: Record<string, { label: string; icon: any; color: string }> = {
  nome:    { label: 'Nome',    icon: User,      color: '#6366f1' },
  cpf:     { label: 'CPF',     icon: BadgeCheck, color: '#0ea5e9' },
  cnpj:    { label: 'CNPJ',    icon: Building2, color: '#f59e0b' },
  empresa: { label: 'Empresa', icon: Building2, color: '#10b981' },
}

const FONTE_TIPO_CFG: Record<string, { label: string; color: string; bg: string; order: number }> = {
  municipal:         { label: 'Municipal',         color: 'text-green-700',   bg: 'bg-green-100',   order: 1 },
  estadual:          { label: 'Estadual',           color: 'text-teal-700',    bg: 'bg-teal-100',    order: 2 },
  federal:           { label: 'Federal',            color: 'text-blue-700',    bg: 'bg-blue-100',    order: 3 },
  judicial_superior: { label: 'Superior',           color: 'text-purple-700',  bg: 'bg-purple-100',  order: 4 },
  judicial_federal:  { label: 'Justiça Federal',    color: 'text-indigo-700',  bg: 'bg-indigo-100',  order: 5 },
  judicial_estadual: { label: 'Justiça Estadual',   color: 'text-violet-700',  bg: 'bg-violet-100',  order: 6 },
  judicial:          { label: 'Judicial',           color: 'text-purple-700',  bg: 'bg-purple-100',  order: 4 },
}

function formatDoc(doc: string, tipo: string) {
  if (tipo === 'CNPJ') return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

// ── Compliance Add Modal ─────────────────────────────────────────────────────

function AddComplianceModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [doc, setDoc] = useState(''); const [tipo, setTipo] = useState<'CPF' | 'CNPJ'>('CNPJ')
  const [nome, setNome] = useState(''); const [frequencia, setFrequencia] = useState('semanal')
  const [saving, setSaving] = useState(false); const [erro, setErro] = useState('')

  async function handleSave() {
    const c = doc.replace(/\D/g, '')
    if ((tipo === 'CNPJ' && c.length !== 14) || (tipo === 'CPF' && c.length !== 11)) { setErro(`${tipo} inválido`); return }
    setSaving(true); setErro('')
    const res = await fetch('/api/compliance/monitor', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documento: c, tipo, nome: nome || undefined, frequencia }),
    })
    setSaving(false)
    if (res.ok) { onSave(); onClose() } else setErro('Erro ao salvar. Verifique se o documento já está monitorado.')
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900">Adicionar ao Monitoramento</h2>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
          <div className="flex gap-2">
            {(['CNPJ', 'CPF'] as const).map(t => (
              <button key={t} onClick={() => setTipo(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${tipo === t ? 'bg-[#0f172a] text-white border-[#0f172a]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{tipo}</label>
          <input value={doc} onChange={e => setDoc(e.target.value)} placeholder={tipo === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00'}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nome / Apelido (opcional)</label>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Fornecedor ABC"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Frequência</label>
          <select value={frequencia} onChange={e => setFrequencia(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="diaria">Diária</option><option value="semanal">Semanal</option><option value="mensal">Mensal</option>
          </select>
        </div>
        {erro && <p className="text-xs text-red-600">{erro}</p>}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Adicionar'}</Button>
        </div>
      </div>
    </div>
  )
}

// ── Diários Add Modal ────────────────────────────────────────────────────────

function AddDiarioModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [termo, setTermo] = useState(''); const [tipo, setTipo] = useState('nome')
  const [saving, setSaving] = useState(false); const [erro, setErro] = useState('')

  async function handleSave() {
    if (!termo.trim()) { setErro('Informe o termo de busca'); return }
    setSaving(true); setErro('')
    const res = await fetch('/api/diarios-oficiais', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ termo, tipo }),
    })
    if (!res.ok) { setErro('Erro ao salvar. Verifique se o termo já está monitorado.'); setSaving(false); return }
    const data = await res.json()
    // Já dispara busca inicial
    await fetch('/api/diarios-oficiais/buscar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: data.id }),
    })
    setSaving(false); onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900">Monitorar nos Diários Oficiais</h2>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(TIPO_CFG).map(([key, cfg]) => (
              <button key={key} onClick={() => setTipo(key)}
                className={`py-2.5 rounded-lg text-xs font-semibold border flex flex-col items-center gap-1 transition-colors ${tipo === key ? 'bg-[#0f172a] text-white border-[#0f172a]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                <cfg.icon className="h-4 w-4" />{cfg.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {tipo === 'cpf' ? 'CPF' : tipo === 'cnpj' ? 'CNPJ' : tipo === 'empresa' ? 'Nome da empresa' : 'Nome da pessoa'}
          </label>
          <input value={termo} onChange={e => setTermo(e.target.value)}
            placeholder={tipo === 'cpf' ? '000.000.000-00' : tipo === 'cnpj' ? '00.000.000/0000-00' : 'Ex: João da Silva'}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p className="text-[10px] text-gray-400 mt-1">
            Será buscado em Diários Municipais, DOU federal e portais judiciais.
          </p>
        </div>
        {erro && <p className="text-xs text-red-600">{erro}</p>}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? <><RefreshCw className="h-3 w-3 animate-spin mr-1" />Buscando...</> : 'Adicionar e Buscar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Diário Term Row ──────────────────────────────────────────────────────────

function DiarioTermRow({ term, onRemove, onRefresh }: {
  term: DiarioMonitorado; onRemove: (id: string) => void; onRefresh: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [resultados, setResultados] = useState<DiarioResultado[]>([])
  const [loadingRes, setLoadingRes] = useState(false)
  const tipoCfg = TIPO_CFG[term.tipo] || TIPO_CFG.nome

  async function loadResults() {
    if (open) { setOpen(false); return }
    setLoadingRes(true); setOpen(true)
    const res = await fetch(`/api/diarios-oficiais/buscar?id=${term.id}`)
    const data = await res.json()
    setResultados(Array.isArray(data) ? data : [])
    setLoadingRes(false)
  }

  const byTipo: Record<string, DiarioResultado[]> = {}
  for (const r of resultados) {
    if (!byTipo[r.fonte_tipo]) byTipo[r.fonte_tipo] = []
    byTipo[r.fonte_tipo].push(r)
  }

  return (
    <div className="border-b border-gray-50 last:border-b-0">
      <div
        className="p-4 flex items-center gap-3 hover:bg-gray-50/60 transition-colors cursor-pointer"
        onClick={loadResults}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: tipoCfg.color + '18' }}>
          <tipoCfg.icon className="h-4 w-4" style={{ color: tipoCfg.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{term.termo}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: tipoCfg.color + '15', color: tipoCfg.color }}>
              {tipoCfg.label}
            </span>
            {term.novos_resultados > 0 && (
              <span className="text-[11px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                <Bell className="h-3 w-3" /> {term.novos_resultados} novo{term.novos_resultados > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px] text-gray-400">
              {term.total_resultados} resultado{term.total_resultados !== 1 ? 's' : ''}
            </span>
            {term.ultima_busca && (
              <span className="text-[11px] text-gray-400">Última busca: {formatDate(term.ultima_busca)}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); onRefresh(term.id) }}
            title="Buscar agora"
            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={e => { e.stopPropagation(); onRemove(term.id) }}
            title="Remover"
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
          {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4">
          {loadingRes ? (
            <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
              <RefreshCw className="h-4 w-4 animate-spin" /> Buscando em todas as fontes...
            </div>
          ) : resultados.length === 0 ? (
            <div className="py-4 text-sm text-gray-400 text-center">Nenhum resultado. Clique em atualizar para buscar.</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(FONTE_TIPO_CFG)
                .sort((a, b) => a[1].order - b[1].order)
                .map(([tipo, cfg]) => {
                  const items = byTipo[tipo] || []
                  if (!items.length) return null
                  const realItems = items.filter(r => r.data_publicacao)
                  const linkItems = items.filter(r => !r.data_publicacao)
                  return (
                    <div key={tipo}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        {realItems.length > 0 && (
                          <span className="text-[11px] font-semibold text-green-600">{realItems.length} publicação{realItems.length > 1 ? 'ões' : ''} encontrada{realItems.length > 1 ? 's' : ''}</span>
                        )}
                        {linkItems.length > 0 && (
                          <span className="text-[11px] text-gray-400">{linkItems.length} fonte{linkItems.length > 1 ? 's' : ''} p/ verificar</span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {/* Resultados reais primeiro */}
                        {realItems.map(r => (
                          <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
                            className="block p-3 rounded-lg border border-green-100 bg-green-50/40 hover:border-green-300 hover:bg-green-50 transition-all group">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-bold bg-green-200 text-green-800 px-1.5 py-0.5 rounded">ENCONTRADO</span>
                                  <p className="text-xs font-semibold text-gray-800 group-hover:text-green-800 leading-snug truncate">{r.titulo}</p>
                                </div>
                                {r.data_publicacao && <p className="text-[10px] text-gray-500 mt-0.5">{formatDate(r.data_publicacao)}</p>}
                                <p className="text-[11px] text-gray-600 mt-1 leading-relaxed line-clamp-3">{r.resumo}</p>
                                <p className="text-[10px] text-gray-400 mt-1 truncate">{r.fonte}</p>
                              </div>
                              <ExternalLink className="h-3.5 w-3.5 text-green-400 group-hover:text-green-600 flex-shrink-0 mt-0.5" />
                            </div>
                          </a>
                        ))}
                        {/* Links para verificação */}
                        {linkItems.length > 0 && (
                          <details className="group/det">
                            <summary className="cursor-pointer text-[11px] text-gray-400 hover:text-gray-600 py-1 flex items-center gap-1 select-none list-none">
                              <ChevronRight className="h-3 w-3 group-open/det:rotate-90 transition-transform" />
                              Ver {linkItems.length} fonte{linkItems.length > 1 ? 's' : ''} para verificação manual
                            </summary>
                            <div className="mt-1.5 space-y-1">
                              {linkItems.map(r => (
                                <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all group text-xs">
                                  <span className="text-gray-600 group-hover:text-blue-700 truncate">{r.fonte}</span>
                                  <ExternalLink className="h-3 w-3 text-gray-300 group-hover:text-blue-400 flex-shrink-0 ml-2" />
                                </a>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function MonitoramentoPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'compliance' | 'diarios'>('compliance')

  // Compliance state
  const [lista, setLista] = useState<Monitorado[]>([])
  const [loadingC, setLoadingC] = useState(true)
  const [showAddC, setShowAddC] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [runningAll, setRunningAll] = useState(false)

  // Diários state
  const [diarios, setDiarios] = useState<DiarioMonitorado[]>([])
  const [loadingD, setLoadingD] = useState(true)
  const [showAddD, setShowAddD] = useState(false)
  const [runningDiario, setRunningDiario] = useState<string | null>(null)

  // Pesquisa avulsa
  const [searchTermo, setSearchTermo] = useState('')
  const [searchTipo, setSearchTipo] = useState('nome')
  const [searching, setSearching] = useState(false)
  const [searchDone, setSearchDone] = useState(false)
  const [searchReais, setSearchReais] = useState(0)
  const [searchResultados, setSearchResultados] = useState<(DiarioResultado & { _key: string })[]>([])

  const carregarCompliance = useCallback(async () => {
    setLoadingC(true)
    const res = await fetch('/api/compliance/monitor')
    const data = await res.json()
    setLista(Array.isArray(data) ? data : [])
    setLoadingC(false)
  }, [])

  const carregarDiarios = useCallback(async () => {
    setLoadingD(true)
    const res = await fetch('/api/diarios-oficiais')
    const data = await res.json()
    setDiarios(Array.isArray(data) ? data : [])
    setLoadingD(false)
  }, [])

  useEffect(() => {
    // Auto-migrate
    fetch('/api/admin/migrate-diarios').catch(() => {})
    carregarCompliance()
    carregarDiarios()
  }, [carregarCompliance, carregarDiarios])

  // Compliance handlers
  async function handleRemoveC(id: string) {
    if (!confirm('Remover este documento do monitoramento?')) return
    await fetch(`/api/compliance/monitor?id=${id}`, { method: 'DELETE' })
    setLista(prev => prev.filter(m => m.id !== id))
  }
  async function handleRun(id: string) {
    setRunning(id)
    await fetch('/api/compliance/monitor/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await carregarCompliance(); setRunning(null)
  }
  async function handleRunAll() {
    setRunningAll(true)
    await fetch('/api/compliance/monitor/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    await carregarCompliance(); setRunningAll(false)
  }

  // Diários handlers
  async function handleRemoveDiario(id: string) {
    if (!confirm('Remover este termo do monitoramento?')) return
    await fetch(`/api/diarios-oficiais?id=${id}`, { method: 'DELETE' })
    setDiarios(prev => prev.filter(d => d.id !== id))
  }
  async function handleRefreshDiario(id: string) {
    setRunningDiario(id)
    await fetch('/api/diarios-oficiais/buscar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    })
    await carregarDiarios(); setRunningDiario(null)
  }
  async function handleRefreshAllDiarios() {
    setRunningDiario('all')
    await fetch('/api/diarios-oficiais/buscar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    })
    await carregarDiarios(); setRunningDiario(null)
  }

  async function handlePesquisar(e?: React.FormEvent) {
    e?.preventDefault()
    if (!searchTermo.trim()) return
    setSearching(true); setSearchDone(false); setSearchResultados([])
    const res = await fetch('/api/diarios-oficiais/pesquisar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ termo: searchTermo.trim(), tipo: searchTipo }),
    })
    setSearching(false)
    if (!res.ok) return
    const data = await res.json()
    setSearchReais(data.reais || 0)
    setSearchResultados((data.resultados || []).map((r: any, i: number) => ({ ...r, _key: String(i) })))
    setSearchDone(true)
  }

  async function handleAddSearchToMonitor() {
    const res = await fetch('/api/diarios-oficiais', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ termo: searchTermo.trim(), tipo: searchTipo }),
    })
    if (res.ok) { await carregarDiarios() }
  }

  const vencidos = lista.filter(m => !m.proximo_verificacao || new Date(m.proximo_verificacao) <= new Date()).length
  const diariosComNovos = diarios.filter(d => d.novos_resultados > 0).length

  return (
    <AppLayout>
      <Topbar title="Monitoramento" subtitle="Compliance e Diários Oficiais">
        {tab === 'compliance' && vencidos > 0 && (
          <Button variant="outline" size="sm" onClick={handleRunAll} disabled={runningAll}>
            {runningAll ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Verificar vencidos ({vencidos})
          </Button>
        )}
        {tab === 'diarios' && diarios.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleRefreshAllDiarios} disabled={runningDiario === 'all'}>
            {runningDiario === 'all' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar todos
          </Button>
        )}
        <Button size="sm" onClick={() => tab === 'compliance' ? setShowAddC(true) : setShowAddD(true)}>
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </Topbar>

      {showAddC && <AddComplianceModal onClose={() => setShowAddC(false)} onSave={carregarCompliance} />}
      {showAddD && <AddDiarioModal onClose={() => setShowAddD(false)} onSave={carregarDiarios} />}

      <div className="p-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
          {([
            { key: 'compliance', icon: ShieldCheck, label: 'Compliance', count: lista.length },
            { key: 'diarios',    icon: Newspaper,   label: 'Diários Oficiais', count: diarios.length, badge: diariosComNovos },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <t.icon className="h-4 w-4" />
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === t.key ? 'bg-gray-100 text-gray-600' : 'bg-gray-200 text-gray-500'}`}>
                {t.count}
              </span>
              {t.badge != null && t.badge > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-red-500 text-white">{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Compliance ─────────────────────────────────────────────── */}
        {tab === 'compliance' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Monitorados', value: lista.length, icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Com Alertas', value: lista.filter(m => m.nivel_ultimo === 'CRITICO' || m.nivel_ultimo === 'ALTO').length, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Mudanças', value: lista.filter(m => m.mudanca_detectada).length, icon: Bell, color: 'text-orange-600', bg: 'bg-orange-50' },
                { label: 'A Verificar', value: vencidos, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border border-black/[0.07] p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-gray-900">{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-black/[0.07]">
              {loadingC ? (
                <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
              ) : lista.length === 0 ? (
                <div className="p-12 flex flex-col items-center gap-3">
                  <ShieldCheck className="h-10 w-10 text-gray-200" />
                  <p className="text-sm text-gray-500 font-medium">Nenhum documento monitorado</p>
                  <Button size="sm" className="mt-2" onClick={() => setShowAddC(true)}><Plus className="h-4 w-4" /> Adicionar primeiro</Button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {lista.map(mon => {
                    const nivelCfg = mon.nivel_ultimo ? (NIVEL_CFG[mon.nivel_ultimo] || NIVEL_CFG.LIMPO) : null
                    const vencido = !mon.proximo_verificacao || new Date(mon.proximo_verificacao) <= new Date()
                    return (
                      <div key={mon.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900 truncate">{mon.nome || formatDoc(mon.documento, mon.tipo)}</span>
                            {mon.nome && <span className="text-xs text-gray-400">{formatDoc(mon.documento, mon.tipo)}</span>}
                            <span className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">{mon.tipo}</span>
                            {mon.mudanca_detectada && <span className="text-[11px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1"><Bell className="h-3 w-3" /> Mudança</span>}
                            {vencido && <span className="text-[11px] bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded font-medium flex items-center gap-1"><Clock className="h-3 w-3" /> Verificação pendente</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-[11px] text-gray-400">Frequência: {FREQ_LABELS[mon.frequencia] || mon.frequencia}</span>
                            {mon.ultima_verificacao && <span className="text-[11px] text-gray-400">Última: {formatDate(mon.ultima_verificacao)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {nivelCfg && mon.score_ultimo !== null ? (
                            <div className={`text-center px-3 py-1.5 rounded-lg ${nivelCfg.bg}`}>
                              <p className={`text-sm font-black ${nivelCfg.color}`}>{mon.score_ultimo}</p>
                              <p className={`text-[10px] font-semibold ${nivelCfg.color}`}>{nivelCfg.label}</p>
                            </div>
                          ) : (
                            <div className="text-center px-3 py-1.5 rounded-lg bg-gray-50"><p className="text-xs text-gray-400">Não verificado</p></div>
                          )}
                          <button onClick={() => handleRun(mon.id)} disabled={running === mon.id} title="Verificar agora"
                            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50">
                            <RefreshCw className={`h-4 w-4 ${running === mon.id ? 'animate-spin' : ''}`} />
                          </button>
                          {mon.score_ultimo !== null && (
                            <button onClick={() => router.push('/compliance/dashboard')} title="Ver histórico"
                              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><Eye className="h-4 w-4" /></button>
                          )}
                          <button onClick={() => handleRemoveC(mon.id)} title="Remover"
                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Como funciona o monitoramento</p>
                <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                  Os documentos cadastrados são re-verificados na frequência configurada nas mesmas fontes: Receita Federal, Portal da Transparência, CGU PEP, Banco Central e PGFN. Quando o score muda, um alerta é gerado automaticamente.
                </p>
              </div>
            </div>
          </>
        )}

        {/* ── Tab: Diários Oficiais ─────────────────────────────────────── */}
        {tab === 'diarios' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Termos monitorados', value: diarios.length, icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { label: 'Com novidades', value: diariosComNovos, icon: Bell, color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Total publicações', value: diarios.reduce((a, d) => a + d.total_resultados, 0), icon: Newspaper, color: 'text-green-600', bg: 'bg-green-50' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border border-black/[0.07] p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-gray-900">{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Pesquisa avulsa ─────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-black/[0.07] overflow-hidden">
              <form onSubmit={handlePesquisar} className="p-4 flex flex-col gap-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5" /> Pesquisa avulsa nos Diários
                </p>
                <div className="flex gap-2">
                  <div className="flex gap-1 flex-shrink-0">
                    {Object.entries(TIPO_CFG).map(([key, cfg]) => (
                      <button key={key} type="button" onClick={() => setSearchTipo(key)}
                        className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1 ${searchTipo === key ? 'bg-[#0f172a] text-white border-[#0f172a]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                        <cfg.icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{cfg.label}</span>
                      </button>
                    ))}
                  </div>
                  <input
                    value={searchTermo}
                    onChange={e => { setSearchTermo(e.target.value); setSearchDone(false) }}
                    placeholder={searchTipo === 'cpf' ? 'CPF a pesquisar' : searchTipo === 'cnpj' ? 'CNPJ a pesquisar' : searchTipo === 'empresa' ? 'Nome da empresa' : 'Nome da pessoa'}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="submit" disabled={searching || !searchTermo.trim()}
                    className="px-4 py-2 bg-[#0f172a] text-white text-sm font-semibold rounded-lg hover:bg-[#1e293b] disabled:opacity-40 transition-colors flex items-center gap-2 flex-shrink-0">
                    {searching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="hidden sm:inline">{searching ? 'Pesquisando...' : 'Pesquisar'}</span>
                  </button>
                </div>
              </form>

              {searching && (
                <div className="px-4 pb-4 flex items-center gap-2 text-sm text-gray-400">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Consultando todas as fontes — pode levar alguns segundos...
                </div>
              )}

              {searchDone && searchResultados.length > 0 && (() => {
                const byTipo: Record<string, typeof searchResultados> = {}
                for (const r of searchResultados) {
                  if (!byTipo[r.fonte_tipo]) byTipo[r.fonte_tipo] = []
                  byTipo[r.fonte_tipo].push(r)
                }
                const alreadyMonitored = diarios.some(d => d.termo.toLowerCase() === searchTermo.trim().toLowerCase())
                return (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">
                          Resultados para <span className="text-[#0f172a]">"{searchTermo}"</span>
                        </span>
                        {searchReais > 0 && (
                          <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            {searchReais} publicaç{searchReais > 1 ? 'ões' : 'ão'} encontrada{searchReais > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {!alreadyMonitored && (
                        <button onClick={handleAddSearchToMonitor}
                          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 px-3 py-1.5 rounded-lg transition-colors bg-indigo-50 hover:bg-indigo-100">
                          <Plus className="h-3.5 w-3.5" /> Adicionar ao monitoramento
                        </button>
                      )}
                      {alreadyMonitored && (
                        <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Já monitorado
                        </span>
                      )}
                    </div>
                    {Object.entries(FONTE_TIPO_CFG)
                      .sort((a, b) => a[1].order - b[1].order)
                      .map(([tipo, cfg]) => {
                        const items = byTipo[tipo] || []
                        if (!items.length) return null
                        const realItems = items.filter(r => r.data_publicacao)
                        const linkItems = items.filter(r => !r.data_publicacao)
                        return (
                          <div key={tipo}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                              {realItems.length > 0 && (
                                <span className="text-[11px] font-semibold text-green-600">{realItems.length} publicaç{realItems.length > 1 ? 'ões' : 'ão'} encontrada{realItems.length > 1 ? 's' : ''}</span>
                              )}
                              {linkItems.length > 0 && (
                                <span className="text-[11px] text-gray-400">{linkItems.length} fonte{linkItems.length > 1 ? 's' : ''} p/ verificar</span>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              {realItems.map(r => (
                                <a key={r._key} href={r.url} target="_blank" rel="noopener noreferrer"
                                  className="block p-3 rounded-lg border border-green-100 bg-green-50/40 hover:border-green-300 hover:bg-green-50 transition-all group">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold bg-green-200 text-green-800 px-1.5 py-0.5 rounded">ENCONTRADO</span>
                                        <p className="text-xs font-semibold text-gray-800 group-hover:text-green-800 leading-snug truncate">{r.titulo}</p>
                                      </div>
                                      {r.data_publicacao && <p className="text-[10px] text-gray-500 mt-0.5">{formatDate(r.data_publicacao)}</p>}
                                      <p className="text-[11px] text-gray-600 mt-1 leading-relaxed line-clamp-3">{r.resumo}</p>
                                      <p className="text-[10px] text-gray-400 mt-1 truncate">{r.fonte}</p>
                                    </div>
                                    <ExternalLink className="h-3.5 w-3.5 text-green-400 group-hover:text-green-600 flex-shrink-0 mt-0.5" />
                                  </div>
                                </a>
                              ))}
                              {linkItems.length > 0 && (
                                <details className="group/det">
                                  <summary className="cursor-pointer text-[11px] text-gray-400 hover:text-gray-600 py-1 flex items-center gap-1 select-none list-none">
                                    <ChevronRight className="h-3 w-3 group-open/det:rotate-90 transition-transform" />
                                    Ver {linkItems.length} fonte{linkItems.length > 1 ? 's' : ''} para verificação manual
                                  </summary>
                                  <div className="mt-1.5 space-y-1">
                                    {linkItems.map(r => (
                                      <a key={r._key} href={r.url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all group text-xs">
                                        <span className="text-gray-600 group-hover:text-blue-700 truncate">{r.fonte}</span>
                                        <ExternalLink className="h-3 w-3 text-gray-300 group-hover:text-blue-400 flex-shrink-0 ml-2" />
                                      </a>
                                    ))}
                                  </div>
                                </details>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )
              })()}

              {searchDone && searchResultados.length === 0 && (
                <div className="px-4 pb-4 text-sm text-gray-400 flex items-center gap-2">
                  <Search className="h-4 w-4" /> Nenhum resultado encontrado para "{searchTermo}".
                </div>
              )}
            </div>

            {/* ── Lista de monitoramentos ──────────────────────────── */}
            <div className="bg-white rounded-xl border border-black/[0.07]">
              {loadingD ? (
                <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
              ) : diarios.length === 0 ? (
                <div className="p-12 flex flex-col items-center gap-3">
                  <Newspaper className="h-10 w-10 text-gray-200" />
                  <p className="text-sm text-gray-500 font-medium">Nenhum termo monitorado</p>
                  <p className="text-xs text-gray-400 text-center max-w-xs">
                    Adicione nomes, CPFs ou empresas para monitorar notificações, intimações e decisões nos Diários Oficiais.
                  </p>
                  <Button size="sm" className="mt-2" onClick={() => setShowAddD(true)}><Plus className="h-4 w-4" /> Adicionar primeiro</Button>
                </div>
              ) : (
                <div>
                  {diarios.map(d => (
                    <DiarioTermRow
                      key={d.id}
                      term={{ ...d, novos_resultados: runningDiario === d.id ? 0 : d.novos_resultados }}
                      onRemove={handleRemoveDiario}
                      onRefresh={handleRefreshDiario}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex gap-3">
              <Newspaper className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div className="w-full">
                <p className="text-sm font-semibold text-indigo-800">Fontes cobertas — {
                  [37 + 27 + 5 + 11 + 37 + 2].reduce((a, b) => a + b, 0)
                } portais monitorados</p>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { label: 'Querido Diário',    desc: '2000+ municípios + estados',   badge: 'municipal',         real: true  },
                    { label: 'DO Estadual',        desc: 'Todos os 27 estados + DF',     badge: 'estadual',          real: false },
                    { label: 'DOU / INLABS',       desc: 'Diário Oficial da União',      badge: 'federal',           real: true  },
                    { label: 'STF / STJ / TST',    desc: 'Tribunais superiores',         badge: 'judicial_superior', real: true  },
                    { label: 'TRF 1 a 6',          desc: 'Justiça Federal + DJe',        badge: 'judicial_federal',  real: true  },
                    { label: 'Todos os 27 TJs',    desc: 'DJe estadual + DataJud',       badge: 'judicial_estadual', real: true  },
                  ].map(f => {
                    const cfg = FONTE_TIPO_CFG[f.badge]
                    return (
                      <div key={f.label} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-indigo-100">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-700 truncate">{f.label}</p>
                          <p className="text-[10px] text-gray-400 truncate">{f.desc}</p>
                        </div>
                        {f.real && <span className="text-[9px] ml-auto bg-green-100 text-green-700 px-1 py-0.5 rounded font-bold flex-shrink-0">API</span>}
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-indigo-600 mt-2.5">
                  Para DOU completo: configure <code className="bg-indigo-100 px-1 rounded text-[11px]">INLABS_EMAIL</code> + <code className="bg-indigo-100 px-1 rounded text-[11px]">INLABS_PASSWORD</code> (gratuito em inlabs.in.gov.br).
                  Para DataJud personalizado: configure <code className="bg-indigo-100 px-1 rounded text-[11px]">DATAJUD_API_KEY</code>.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
