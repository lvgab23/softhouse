'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Briefcase, DollarSign, TrendingUp, TrendingDown, Percent,
  ArrowUpRight, ArrowDownRight, Target, BarChart2, Globe, X,
  Receipt, Tag,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  ComposedChart, Line, ReferenceLine, AreaChart, Area,
} from 'recharts'
import { Topbar } from '@/components/layout/topbar'
import { formatBRL, formatShort } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// ── Constants ──────────────────────────────────────────────────────────────
const C = {
  blue: '#3b82f6', green: '#22c55e', red: '#ef4444', amber: '#f59e0b',
  purple: '#8b5cf6', cyan: '#06b6d4', teal: '#14b8a6', orange: '#f97316',
  slate: '#64748b',
}
const PALETTE = [C.blue, C.green, C.amber, C.purple, C.cyan, C.teal, C.orange, C.red]

const FASE_LABELS: Record<string, string> = {
  captacao: 'Captação', analise: 'Análise', aprovacao: 'Aprovação',
  em_execucao: 'Em Execução', concluido: 'Concluído', cancelado: 'Cancelado',
}
const FASE_COLORS: Record<string, string> = {
  captacao: C.blue, analise: C.amber, aprovacao: C.orange,
  em_execucao: C.green, concluido: C.teal, cancelado: C.red,
}

const TABS = ['Visão Geral', 'P&L e Investimentos', 'Custos', 'Detalhes']

const CAT_NEG_LABEL: Record<string, string> = {
  folha_pagamento: 'Folha Pagto', aluguel: 'Aluguel', impostos: 'Impostos',
  marketing: 'Marketing', tecnologia: 'Tecnologia', contabilidade: 'Contabilidade',
  seguros: 'Seguros', manutencao: 'Manutenção', logistica: 'Logística',
  fornecedores: 'Fornecedores', outros: 'Outros',
}
const CAT_NEG_COLOR = ['#3b82f6','#ef4444','#f59e0b','#ec4899','#06b6d4','#8b5cf6','#14b8a6','#f97316','#22c55e','#64748b','#94a3b8']

// ── Shared UI ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color = 'blue', trend, delta }: any) {
  const accent: Record<string, string> = {
    blue: 'border-l-blue-500', green: 'border-l-emerald-500', red: 'border-l-red-500',
    amber: 'border-l-amber-500', purple: 'border-l-violet-500', teal: 'border-l-teal-500',
    gray: 'border-l-slate-300', cyan: 'border-l-cyan-500',
  }
  const iconClr: Record<string, string> = {
    blue: 'text-blue-500', green: 'text-emerald-500', red: 'text-red-500',
    amber: 'text-amber-500', purple: 'text-violet-500', teal: 'text-teal-500',
    gray: 'text-slate-400', cyan: 'text-cyan-500',
  }
  const trendCls = trend === 'up' ? 'bg-emerald-50 text-emerald-700' : trend === 'down' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'
  return (
    <div className={`bg-white rounded-lg border border-slate-200 border-l-[3px] ${accent[color] ?? accent.blue} p-4`}>
      <div className="flex items-start justify-between mb-3">
        {Icon && <Icon size={14} className={`${iconClr[color] ?? iconClr.blue} flex-shrink-0`} />}
        {trend && delta && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trendCls}`}>
            {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'} {delta}
          </span>
        )}
      </div>
      <p className="text-[26px] font-bold text-slate-900 leading-none tracking-tight font-mono mb-1.5">{value}</p>
      <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-lg border border-slate-200 p-5 ${className}`}>{children}</div>
}

function Title({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4 pb-3 border-b border-slate-100">
      <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-500">{title}</h3>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-slate-200 mb-2 border-b border-slate-700 pb-1.5 text-[11px]">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.fill || p.color }} />
          <span className="text-slate-400 flex-1 text-[10px]">{p.name}:</span>
          <span className="font-bold text-white">{typeof p.value === 'number' ? formatBRL(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

function FaseBadge({ fase }: { fase: string }) {
  const map: Record<string, string> = {
    captacao: 'bg-blue-50 text-blue-700 border-blue-200', analise: 'bg-amber-50 text-amber-700 border-amber-200',
    aprovacao: 'bg-orange-50 text-orange-700 border-orange-200', em_execucao: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    concluido: 'bg-teal-50 text-teal-700 border-teal-200', cancelado: 'bg-red-50 text-red-600 border-red-200',
  }
  return <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border tracking-wide ${map[fase] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>{FASE_LABELS[fase] || fase.replace(/_/g, ' ')}</span>
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ativa: 'bg-emerald-50 text-emerald-700 border-emerald-200', inativa: 'bg-slate-50 text-slate-500 border-slate-200',
    em_negociacao: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  return <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border tracking-wide ${map[status] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>{status?.replace(/_/g, ' ')}</span>
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function NegociosDashboardPage() {
  const [loading, setLoading]         = useState(true)
  const [empresas, setEmpresas]       = useState<any[]>([])
  const [socios, setSocios]           = useState<any[]>([])
  const [despesas, setDespesas]       = useState<any[]>([])
  const [activeTab, setTab]           = useState('Visão Geral')
  const [empresaFilter, setEmpresa]   = useState<string | null>(null)
  const [filterStatus, setStatus]     = useState<string>('')
  const [filterFase, setFase]         = useState<string>('')

  useEffect(() => {
    async function load() {
      await fetch('/api/admin/migrate-patrimonio', { method: 'POST' }).catch(() => {})
      const sb = createClient()
      const [empRes, socRes, dRes] = await Promise.all([
        (sb as any).from('empresas').select('*').order('nome'),
        (sb as any).from('socios').select('*').order('nome'),
        (sb as any).from('despesas_operacionais')
          .select('*')
          .not('empresa_id', 'is', null)
          .order('data', { ascending: true }),
      ])
      setEmpresas(empRes.error ? [] : (empRes.data || []))
      setSocios(socRes.error ? [] : (socRes.data || []))
      setDespesas(dRes.error ? [] : (dRes.data || []))
      setLoading(false)
    }
    load()
  }, [])

  const selectedEmpresa = useMemo(
    () => empresaFilter ? empresas.find(e => e.id === empresaFilter) || null : null,
    [empresaFilter, empresas]
  )

  const filtered = useMemo(() => {
    let list = empresas
    if (empresaFilter) list = list.filter(e => e.id === empresaFilter)
    if (filterStatus) list = list.filter(e => e.status === filterStatus)
    if (filterFase)   list = list.filter(e => e.fase === filterFase)
    return list
  }, [empresas, empresaFilter, filterStatus, filterFase])

  // ── Metrics ──────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalInvest  = filtered.reduce((s, e) => s + (e.valor_investimento || 0), 0)
    const totalRetorno = filtered.reduce((s, e) => s + (e.valor_retorno || 0), 0)
    const roi          = totalInvest > 0 ? ((totalRetorno - totalInvest) / totalInvest * 100) : 0
    const ativas       = filtered.filter(e => e.status === 'ativa').length
    const emExec       = filtered.filter(e => e.fase === 'em_execucao').length
    const lucroPot     = totalRetorno - totalInvest
    return { totalInvest, totalRetorno, roi, ativas, emExec, lucroPot }
  }, [filtered])

  // ── Chart: distribuição por fase ─────────────────────────────────────────
  const faseChartData = useMemo(() => {
    const map: Record<string, { count: number; investimento: number }> = {}
    filtered.forEach(e => {
      const f = e.fase || 'outros'
      if (!map[f]) map[f] = { count: 0, investimento: 0 }
      map[f].count++
      map[f].investimento += e.valor_investimento || 0
    })
    return Object.entries(map).map(([fase, d]) => ({
      fase: FASE_LABELS[fase] || fase,
      quantidade: d.count,
      investimento: d.investimento,
      fill: FASE_COLORS[fase] || C.slate,
    }))
  }, [filtered])

  // ── Chart: setor distribution ─────────────────────────────────────────
  const setorData = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(e => { const s = e.setor || 'Outros'; map[s] = (map[s] || 0) + (e.valor_investimento || 1) })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filtered])

  // ── Chart: P&L comparativo por empresa ───────────────────────────────────
  const plData = useMemo(() => {
    return filtered.slice(0, 10).map(e => ({
      nome: e.nome.length > 18 ? e.nome.slice(0, 18) + '…' : e.nome,
      investimento: e.valor_investimento || 0,
      retorno:      e.valor_retorno || 0,
      lucro:        (e.valor_retorno || 0) - (e.valor_investimento || 0),
    })).sort((a, b) => b.investimento - a.investimento)
  }, [filtered])

  // ── Ranking ROI ────────────────────────────────────────────────────────
  const roiRanking = useMemo(() => {
    return filtered
      .filter(e => e.valor_investimento && e.valor_retorno)
      .map(e => ({
        nome: e.nome.length > 22 ? e.nome.slice(0, 22) + '…' : e.nome,
        roi: ((e.valor_retorno - e.valor_investimento) / e.valor_investimento * 100),
        investimento: e.valor_investimento,
        retorno: e.valor_retorno,
      }))
      .sort((a, b) => b.roi - a.roi)
  }, [filtered])

  // ── Despesas de negócios ───────────────────────────────────────────────
  const despesasFiltradas = useMemo(() => {
    if (!empresaFilter) return despesas
    return despesas.filter(d => d.empresa_id === empresaFilter)
  }, [despesas, empresaFilter])

  const totalDespesas = useMemo(() => despesasFiltradas.reduce((s, d) => s + (d.valor || 0), 0), [despesasFiltradas])

  const despesasPorCategoria = useMemo(() => {
    const map: Record<string, number> = {}
    despesasFiltradas.forEach(d => { const c = d.categoria || 'outros'; map[c] = (map[c] || 0) + d.valor })
    return Object.entries(map).map(([cat, val], i) => ({
      name: CAT_NEG_LABEL[cat] || cat, value: val,
      color: CAT_NEG_COLOR[i % CAT_NEG_COLOR.length],
    })).sort((a, b) => b.value - a.value)
  }, [despesasFiltradas])

  const despesasMensal = useMemo(() => {
    const map: Record<string, number> = {}
    despesasFiltradas.forEach(d => { if (d.data) { const m = d.data.slice(0, 7); map[m] = (map[m] || 0) + d.valor } })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([mes, total]) => ({
      mes: mes.replace('-', '/'), total,
    }))
  }, [despesasFiltradas])

  const despesasPorEmpresa = useMemo(() => {
    const map: Record<string, { nome: string; total: number }> = {}
    despesas.forEach(d => {
      if (!d.empresa_id) return
      const nome = empresas.find(e => e.id === d.empresa_id)?.nome || d.empresa_id
      if (!map[d.empresa_id]) map[d.empresa_id] = { nome, total: 0 }
      map[d.empresa_id].total += d.valor
    })
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8)
  }, [despesas, empresas])

  // P&L real: lucro bruto menos despesas reais por empresa
  const plRealData = useMemo(() => {
    return filtered.slice(0, 10).map(e => {
      const despEmpresa = despesas.filter(d => d.empresa_id === e.id).reduce((s, d) => s + d.valor, 0)
      const lucro = (e.valor_retorno || 0) - (e.valor_investimento || 0) - despEmpresa
      return {
        nome: e.nome.length > 16 ? e.nome.slice(0, 16) + '…' : e.nome,
        investimento: e.valor_investimento || 0,
        retorno: e.valor_retorno || 0,
        despesas: despEmpresa,
        lucroLiquido: lucro,
      }
    }).sort((a, b) => b.investimento - a.investimento)
  }, [filtered, despesas])

  if (loading) {
    return (
      <>
        <Topbar title="Dashboard de Negócios" subtitle="Portfólio de empresas e investimentos" />
        <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 bg-white rounded-lg border border-slate-200 animate-pulse" />)}
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar title="Dashboard de Negócios" subtitle={selectedEmpresa ? `Empresa: ${selectedEmpresa.nome}` : 'Portfólio de empresas e investimentos'} />

      <div className="p-6 space-y-5">

        {/* ── Top controls ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
            {TABS.map(tab => (
              <button key={tab} onClick={() => setTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs transition-colors ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-700'}`}>
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterStatus} onChange={e => setStatus(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 outline-none focus:border-blue-300">
              <option value="">Todos os status</option>
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
              <option value="em_negociacao">Em Negociação</option>
            </select>
            <select value={filterFase} onChange={e => setFase(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 outline-none focus:border-blue-300">
              <option value="">Todas as fases</option>
              {Object.entries(FASE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* ── Empresa filter pills ── */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium mb-2">Filtrar por empresa</p>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setEmpresa(null)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${!empresaFilter ? 'bg-[#0f172a] text-white border-transparent' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              Todas ({empresas.length})
            </button>
            {empresas.map(e => {
              const roi = e.valor_investimento && e.valor_retorno
                ? ((e.valor_retorno - e.valor_investimento) / e.valor_investimento * 100) : null
              return (
                <button key={e.id} onClick={() => setEmpresa(e.id === empresaFilter ? null : e.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors max-w-[200px] truncate ${empresaFilter === e.id ? 'bg-[#0f172a] text-white border-transparent' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  title={e.nome}>
                  {e.nome}
                  {roi !== null && <span className={`ml-1 ${roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>{roi >= 0 ? '+' : ''}{roi.toFixed(0)}%</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label={selectedEmpresa ? 'Empresa' : 'Empresas no Portfólio'} value={selectedEmpresa ? '1' : String(filtered.length)}
            sub={selectedEmpresa ? (selectedEmpresa.setor || '—') : `${metrics.ativas} ativas · ${metrics.emExec} em execução`} icon={Briefcase} color="purple" />
          <KpiCard label="Capital Investido" value={formatShort(metrics.totalInvest)} sub="valor total aplicado" icon={Target} color="blue" />
          <KpiCard label="Retorno Esperado"  value={formatShort(metrics.totalRetorno)} sub="estimativa de retorno" icon={TrendingUp} color="green"
            trend={metrics.totalRetorno >= metrics.totalInvest ? 'up' : 'down'}
            delta={formatShort(Math.abs(metrics.lucroPot))} />
          <KpiCard label="ROI Estimado" value={metrics.totalInvest > 0 ? `${metrics.roi.toFixed(1)}%` : '—'}
            sub="retorno vs. capital investido" icon={Percent}
            color={metrics.roi >= 0 ? 'green' : 'red'} trend={metrics.roi >= 0 ? 'up' : 'down'} delta={metrics.roi >= 0 ? 'Positivo' : 'Negativo'} />
        </div>

        {/* ════════ VISÃO GERAL ════════ */}
        {activeTab === 'Visão Geral' && (
          <div className="space-y-5">

            {/* Selected empresa detail */}
            {selectedEmpresa && (
              <Panel className="border-l-4 border-l-amber-400">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{selectedEmpresa.nome}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{selectedEmpresa.setor || 'Sem setor'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaseBadge fase={selectedEmpresa.fase || 'captacao'} />
                    <StatusBadge status={selectedEmpresa.status || 'inativa'} />
                    <button onClick={() => setEmpresa(null)} className="text-slate-300 hover:text-slate-600"><X size={14} /></button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { l: 'CNPJ',        v: selectedEmpresa.cnpj || '—' },
                    { l: 'Investimento', v: formatBRL(selectedEmpresa.valor_investimento || 0), cls: 'text-blue-700' },
                    { l: 'Retorno',      v: formatBRL(selectedEmpresa.valor_retorno || 0),      cls: 'text-green-600' },
                    { l: 'Lucro Potencial', v: formatBRL((selectedEmpresa.valor_retorno || 0) - (selectedEmpresa.valor_investimento || 0)),
                      cls: ((selectedEmpresa.valor_retorno || 0) - (selectedEmpresa.valor_investimento || 0)) >= 0 ? 'text-green-600' : 'text-red-500' },
                    { l: 'ROI', v: selectedEmpresa.valor_investimento
                        ? `${(((selectedEmpresa.valor_retorno || 0) - selectedEmpresa.valor_investimento) / selectedEmpresa.valor_investimento * 100).toFixed(1)}%`
                        : '—',
                      cls: ((selectedEmpresa.valor_retorno || 0) >= selectedEmpresa.valor_investimento) ? 'text-green-600' : 'text-red-500' },
                  ].map(f => (
                    <div key={f.l}>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{f.l}</p>
                      <p className={`text-sm font-bold ${f.cls || 'text-slate-900'}`}>{f.v}</p>
                    </div>
                  ))}
                </div>
                {selectedEmpresa.descricao && (
                  <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">{selectedEmpresa.descricao}</p>
                )}
                {selectedEmpresa.website && (
                  <a href={selectedEmpresa.website} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2">
                    <Globe size={12} /> {selectedEmpresa.website}
                  </a>
                )}
              </Panel>
            )}

            {/* Charts: fase + setor */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Panel>
                <Title title="Distribuição por Fase" sub="empresas e capital por estágio" />
                {faseChartData.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Sem dados</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={faseChartData} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="fase" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: any, n: string) => [n === 'investimento' ? formatBRL(v) : v, n === 'investimento' ? 'Capital' : 'Empresas']} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="quantidade" name="Empresas" radius={[4,4,0,0]}>
                        {faseChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Panel>

              <Panel>
                <Title title="Distribuição por Setor" sub="capital investido por segmento" />
                {setorData.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Sem dados</div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={200}>
                      <PieChart>
                        <Pie data={setorData} cx="50%" cy="50%" outerRadius={88} innerRadius={54} dataKey="value" paddingAngle={2}>
                          {setorData.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="none" />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [formatBRL(v), 'Capital']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2.5">
                      {setorData.map((d, i) => {
                        const total = setorData.reduce((s, x) => s + x.value, 0)
                        const pct = total > 0 ? (d.value / total * 100) : 0
                        return (
                          <div key={d.name}>
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                                <span className="text-[11px] text-slate-600 truncate max-w-[90px]">{d.name}</span>
                              </div>
                              <span className="text-[11px] font-semibold">{pct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </Panel>
            </div>

            {/* Cards grid: top companies */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-3">
                {selectedEmpresa ? 'Outras Empresas do Portfólio' : 'Empresas por Capital Investido'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(selectedEmpresa ? empresas.filter(e => e.id !== empresaFilter) : filtered)
                  .sort((a, b) => (b.valor_investimento || 0) - (a.valor_investimento || 0))
                  .slice(0, 6)
                  .map((emp, i) => {
                    const roi = emp.valor_investimento && emp.valor_retorno
                      ? (((emp.valor_retorno - emp.valor_investimento) / emp.valor_investimento) * 100) : null
                    const lucro = (emp.valor_retorno || 0) - (emp.valor_investimento || 0)
                    return (
                      <button key={emp.id} onClick={() => setEmpresa(emp.id === empresaFilter ? null : emp.id)}
                        className={`bg-white rounded-lg border p-5 flex flex-col gap-3 shadow-sm text-left transition-all hover:shadow-md ${empresaFilter === emp.id ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            {!selectedEmpresa && (
                              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                            )}
                            <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{emp.nome}</p>
                          </div>
                          <FaseBadge fase={emp.fase || 'captacao'} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {emp.setor && <span className="text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">{emp.setor}</span>}
                          <StatusBadge status={emp.status || 'inativa'} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase tracking-wide">Investido</p>
                            <p className="text-xs font-bold text-blue-700">{emp.valor_investimento ? formatShort(emp.valor_investimento) : '—'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase tracking-wide">Retorno</p>
                            <p className="text-xs font-bold text-green-600">{emp.valor_retorno ? formatShort(emp.valor_retorno) : '—'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase tracking-wide">ROI</p>
                            <p className={`text-xs font-bold ${roi !== null ? (roi >= 0 ? 'text-green-600' : 'text-red-500') : 'text-slate-400'}`}>
                              {roi !== null ? `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%` : '—'}
                            </p>
                          </div>
                        </div>
                        {lucro !== 0 && (
                          <div className={`flex items-center justify-between text-xs font-medium px-2 py-1.5 rounded-lg ${lucro >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                            <span>{lucro >= 0 ? 'Lucro Potencial' : 'Prejuízo Potencial'}</span>
                            <span className="font-bold">{lucro >= 0 ? '+' : ''}{formatShort(lucro)}</span>
                          </div>
                        )}
                      </button>
                    )
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ════════ P&L E INVESTIMENTOS ════════ */}
        {activeTab === 'P&L e Investimentos' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Capital Total" value={formatShort(metrics.totalInvest)} sub="investimento total" icon={Target} color="blue" />
              <KpiCard label="Retorno Esperado" value={formatShort(metrics.totalRetorno)} sub="estimativa total" icon={TrendingUp} color="green" />
              <KpiCard label="Lucro Potencial" value={formatShort(Math.abs(metrics.lucroPot))}
                sub={metrics.lucroPot >= 0 ? 'resultado positivo' : 'resultado negativo'} icon={DollarSign}
                color={metrics.lucroPot >= 0 ? 'green' : 'red'} trend={metrics.lucroPot >= 0 ? 'up' : 'down'} delta={metrics.lucroPot >= 0 ? 'Lucro' : 'Prejuízo'} />
              <KpiCard label="ROI Médio Portfólio" value={`${metrics.roi.toFixed(1)}%`} sub="vs. capital aplicado" icon={Percent}
                color={metrics.roi >= 0 ? 'green' : 'red'} trend={metrics.roi >= 0 ? 'up' : 'down'} delta={metrics.roi >= 0 ? 'Positivo' : 'Negativo'} />
            </div>

            {/* ComposedChart: invest + retorno + lucro */}
            {plData.length > 0 && (
              <Panel>
                <Title title="Investimento × Retorno × Lucro por Empresa" sub="comparativo de capital e resultados esperados" />
                <ResponsiveContainer width="100%" height={Math.max(240, plData.length * 52)}>
                  <BarChart data={plData} layout="vertical" barSize={12} margin={{ top: 0, right: 90, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: '#64748b' }} width={130} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine x={0} stroke="#e2e8f0" />
                    <Bar dataKey="investimento" name="Investimento" fill={C.blue}   fillOpacity={0.85} radius={[0,3,3,0]} label={{ position: 'right', fontSize: 9, fill: C.blue,  formatter: (v: number) => v > 0 ? formatShort(v) : '' }} />
                    <Bar dataKey="retorno"      name="Retorno"      fill={C.green}  fillOpacity={0.8}  radius={[0,3,3,0]} label={{ position: 'right', fontSize: 9, fill: C.green, formatter: (v: number) => v > 0 ? formatShort(v) : '' }} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            )}

            {/* ROI Ranking */}
            {roiRanking.length > 0 && (
              <Panel>
                <Title title="Ranking de ROI" sub="empresas com maior retorno sobre investimento" />
                <ResponsiveContainer width="100%" height={Math.max(200, roiRanking.length * 44)}>
                  <BarChart data={roiRanking} layout="vertical" barSize={16} margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v.toFixed(0)}%`} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: '#64748b' }} width={140} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number, n: string) => [n === 'roi' ? `${v.toFixed(1)}%` : formatBRL(v), n === 'roi' ? 'ROI' : n]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <ReferenceLine x={0} stroke="#e2e8f0" />
                    <Bar dataKey="roi" name="roi" radius={[0,3,3,0]}
                      label={{ position: 'right', fontSize: 9, formatter: (v: number) => `${v.toFixed(1)}%` }}>
                      {roiRanking.map((e: any, i: number) => <Cell key={i} fill={e.roi >= 0 ? C.green : C.red} fillOpacity={0.82} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            )}
          </div>
        )}

        {/* ════════ CUSTOS ════════ */}
        {activeTab === 'Custos' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Total de Despesas" value={formatShort(totalDespesas)}
                sub={empresaFilter ? 'empresa selecionada' : 'todas as empresas'} icon={Receipt} color="red" />
              <KpiCard label="Custo Médio Mensal"
                value={formatShort(despesasMensal.length > 0 ? totalDespesas / despesasMensal.length : 0)}
                sub="média por mês" icon={TrendingDown} color="amber" />
              <KpiCard label="Categorias de Custo" value={String(despesasPorCategoria.length)}
                sub="tipos de despesa" icon={Tag} color="blue" />
              <KpiCard label="Empresas com Custos"
                value={String(new Set(despesas.map(d => d.empresa_id)).size)}
                sub="registraram despesas" icon={Briefcase} color="gray" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Custos por categoria */}
              <Panel>
                <Title title="Custos por Categoria" sub={empresaFilter ? 'empresa selecionada' : 'total do portfólio'} />
                {despesasPorCategoria.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Nenhuma despesa registrada</div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="45%" height={200}>
                      <PieChart>
                        <Pie data={despesasPorCategoria} cx="50%" cy="50%" outerRadius={88} innerRadius={50} dataKey="value" paddingAngle={2}>
                          {despesasPorCategoria.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [formatBRL(v), 'Total']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2 overflow-y-auto max-h-52">
                      {despesasPorCategoria.map(e => {
                        const pct = totalDespesas > 0 ? (e.value / totalDespesas * 100) : 0
                        return (
                          <div key={e.name}>
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                                <span className="text-[11px] text-slate-600 truncate max-w-[90px]">{e.name}</span>
                              </div>
                              <span className="text-[11px] font-semibold">{pct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: e.color }} />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{formatBRL(e.value)}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </Panel>

              {/* Ranking por empresa */}
              <Panel>
                <Title title="Custos por Empresa" sub="total acumulado" />
                {despesasPorEmpresa.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Nenhuma despesa registrada</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={despesasPorEmpresa} layout="vertical" barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: '#64748b' }} width={120} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => [formatBRL(v), 'Despesas']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="total" name="Total" fill="#ef4444" fillOpacity={0.82} radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Panel>
            </div>

            {/* Evolução mensal */}
            {despesasMensal.length > 1 && (
              <Panel>
                <Title title="Evolução Mensal de Despesas" sub="histórico de custos operacionais" />
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={despesasMensal}>
                    <defs>
                      <linearGradient id="gradNegDesp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v: number) => [formatBRL(v), 'Despesas']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="total" name="Despesas" stroke="#ef4444" strokeWidth={2} fill="url(#gradNegDesp)" dot={{ fill: '#ef4444', r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>
            )}

            {/* P&L real com despesas */}
            {plRealData.some(d => d.despesas > 0) && (
              <Panel>
                <Title title="P&L Real — Investimento × Retorno × Despesas × Lucro Líquido" sub="resultado após descontar custos operacionais" />
                <ResponsiveContainer width="100%" height={Math.max(240, plRealData.length * 56)}>
                  <BarChart data={plRealData} layout="vertical" barSize={10} margin={{ top: 0, right: 80, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: '#64748b' }} width={130} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine x={0} stroke="#e2e8f0" />
                    <Bar dataKey="investimento" name="Investimento" fill={C.blue}   fillOpacity={0.8}  radius={[0,3,3,0]} />
                    <Bar dataKey="retorno"      name="Retorno"      fill={C.green}  fillOpacity={0.8}  radius={[0,3,3,0]} />
                    <Bar dataKey="despesas"     name="Despesas"     fill={C.red}    fillOpacity={0.8}  radius={[0,3,3,0]} />
                    <Bar dataKey="lucroLiquido" name="Lucro Líquido" fill={C.teal} fillOpacity={0.85} radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            )}

            {despesas.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center">
                  <Receipt className="h-6 w-6 text-red-400" />
                </div>
                <p className="text-sm font-medium text-slate-500">Nenhuma despesa cadastrada</p>
                <p className="text-xs text-slate-400">Acesse <strong>Negócios → Desp. Operacionais</strong> para registrar custos</p>
              </div>
            )}
          </div>
        )}

        {/* ════════ DETALHES ════════ */}
        {activeTab === 'Detalhes' && (
          <div className="space-y-5">
            {/* P&L resumo */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Panel>
                <Title title="Resumo Financeiro do Portfólio" />
                <div className="space-y-3">
                  {[
                    { label: 'Capital Total Investido', value: metrics.totalInvest, positive: false, bold: false },
                    { label: 'Retorno Total Esperado',  value: metrics.totalRetorno, positive: true, bold: false },
                    { label: 'Lucro Potencial',         value: metrics.lucroPot, positive: metrics.lucroPot >= 0, bold: true },
                  ].map(r => (
                    <div key={r.label} className={`flex items-center justify-between ${r.bold ? 'pt-2 border-t border-slate-100' : ''}`}>
                      <span className={`text-xs ${r.bold ? 'font-bold text-slate-800' : 'text-slate-500'}`}>{r.label}</span>
                      <span className={`text-xs font-semibold ${r.bold ? 'text-sm' : ''} ${r.positive ? 'text-green-600' : r.bold && !r.positive ? 'text-red-500' : 'text-blue-700'}`}>
                        {r.bold && r.value >= 0 ? '+' : r.bold && r.value < 0 ? '' : ''}{formatBRL(r.value)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-500">ROI Médio do Portfólio</span>
                    <span className={`text-xs font-bold ${metrics.roi >= 0 ? 'text-green-600' : 'text-red-500'}`}>{metrics.roi.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Empresas Ativas</span>
                    <span className="text-xs font-semibold text-slate-700">{metrics.ativas} de {filtered.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Em Execução</span>
                    <span className="text-xs font-semibold text-green-600">{metrics.emExec}</span>
                  </div>
                </div>
              </Panel>

              {socios.length > 0 && (
                <Panel>
                  <Title title="Sócios" sub="participação societária" />
                  <div className="space-y-3">
                    {socios.slice(0, 8).map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                        <div>
                          <p className="text-xs font-medium text-slate-800">{s.nome}</p>
                          <p className="text-[10px] text-slate-400">{s.cpf_cnpj || s.email || '—'}</p>
                        </div>
                        <div className="text-right">
                          {s.percentual_participacao && <p className="text-xs font-semibold text-blue-700">{s.percentual_participacao}%</p>}
                          {s.valor_participacao && <p className="text-[10px] text-slate-500">{formatShort(s.valor_participacao)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </div>

            {/* Full table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800">Portfólio de Negócios</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{filtered.length} empresa{filtered.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 bg-slate-50/50">
                    {['Empresa', 'Setor', 'Fase', 'Status', 'Investimento', 'Retorno', 'Lucro Potencial', 'ROI'].map(h => (
                      <th key={h} className={`py-3 px-4 text-xs font-medium text-slate-500 ${h === 'Empresa' ? 'text-left pl-5' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filtered.length === 0
                      ? <tr><td colSpan={8} className="px-5 py-8 text-center text-xs text-slate-300">Nenhuma empresa</td></tr>
                      : filtered.map((e: any, i: number) => {
                        const lucro = (e.valor_retorno || 0) - (e.valor_investimento || 0)
                        const roi   = e.valor_investimento ? (lucro / e.valor_investimento * 100) : null
                        return (
                          <tr key={i} className={`border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer ${empresaFilter === e.id ? 'bg-amber-50/30' : ''}`} onClick={() => setEmpresa(e.id === empresaFilter ? null : e.id)}>
                            <td className="px-5 py-3 text-xs font-medium text-slate-900">{e.nome}</td>
                            <td className="px-4 py-3 text-right text-xs text-slate-500">{e.setor || '—'}</td>
                            <td className="px-4 py-3 text-right"><FaseBadge fase={e.fase || 'captacao'} /></td>
                            <td className="px-4 py-3 text-right"><StatusBadge status={e.status || 'inativa'} /></td>
                            <td className="px-4 py-3 text-right text-xs font-semibold text-blue-700">{e.valor_investimento ? formatBRL(e.valor_investimento) : '—'}</td>
                            <td className="px-4 py-3 text-right text-xs font-semibold text-green-600">{e.valor_retorno ? formatBRL(e.valor_retorno) : '—'}</td>
                            <td className="px-4 py-3 text-right text-xs font-semibold">{e.valor_investimento ? <span className={lucro >= 0 ? 'text-green-600' : 'text-red-500'}>{lucro >= 0 ? '+' : ''}{formatBRL(lucro)}</span> : '—'}</td>
                            <td className="px-4 py-3 text-right text-xs font-semibold">{roi !== null ? <span className={roi >= 0 ? 'text-green-600' : 'text-red-500'}>{roi >= 0 ? '+' : ''}{roi.toFixed(1)}%</span> : '—'}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                  {filtered.length > 0 && (
                    <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td colSpan={4} className="px-5 py-3 text-xs font-bold text-slate-700">Total</td>
                      <td className="px-4 py-3 text-right text-xs font-bold text-blue-700">{formatBRL(metrics.totalInvest)}</td>
                      <td className="px-4 py-3 text-right text-xs font-bold text-green-600">{formatBRL(metrics.totalRetorno)}</td>
                      <td className="px-4 py-3 text-right text-xs font-bold"><span className={metrics.lucroPot >= 0 ? 'text-green-600' : 'text-red-500'}>{metrics.lucroPot >= 0 ? '+' : ''}{formatBRL(metrics.lucroPot)}</span></td>
                      <td className="px-4 py-3 text-right text-xs font-bold"><span className={metrics.roi >= 0 ? 'text-green-600' : 'text-red-500'}>{metrics.roi.toFixed(1)}%</span></td>
                    </tr></tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
