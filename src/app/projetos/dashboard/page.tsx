'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, Target, FolderOpen,
  User, Users, BarChart2,
} from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Cell, PieChart, Pie,
  ReferenceLine,
} from 'recharts'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { formatBRL, formatShort } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const PERIOD_OPTIONS = [
  { value: 'dia',      label: 'Dia',       days: 30  },
  { value: 'semana',   label: 'Semana',    days: 84  },
  { value: 'mes',      label: 'Mês',       days: 365 },
  { value: 'ano',      label: 'Ano',       days: 1825},
  { value: 'tudo',     label: 'Tudo',      days: 9999},
]

const TABS = ['P&L Operacional', 'Investimentos', 'P&L por Projeto']

const COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16']

// ── helpers ─────────────────────────────────────────────────────────────────

function periodKey(dateStr: string, period: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (period === 'dia')    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  if (period === 'semana') {
    const wk = Math.floor(d.getDate() / 7)
    return `${d.toLocaleDateString('pt-BR', { month: 'short' })} S${wk + 1}`
  }
  if (period === 'mes')    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  return String(d.getFullYear())
}

function buildPeriodKeys(period: string, days: number): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  const now = new Date()
  for (let i = Math.min(days, 365 * 5); i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const k = periodKey(d.toISOString().split('T')[0], period)
    if (!seen.has(k)) { seen.add(k); keys.push(k) }
  }
  return keys
}

function KpiCard({
  label, value, sub, icon: Icon, color = 'blue', delta, trend,
}: { label: string; value: string; sub?: string; icon: any; color?: string; delta?: string; trend?: 'up'|'down' }) {
  const accent: Record<string, string> = {
    blue: 'border-l-blue-500', green: 'border-l-emerald-500', red: 'border-l-red-500',
    amber: 'border-l-amber-500', purple: 'border-l-violet-500', teal: 'border-l-teal-500',
    gray: 'border-l-slate-300',
  }
  const iconClr: Record<string, string> = {
    blue: 'text-blue-500', green: 'text-emerald-500', red: 'text-red-500',
    amber: 'text-amber-500', purple: 'text-violet-500', teal: 'text-teal-500',
    gray: 'text-slate-400',
  }
  const trendCls = trend === 'up' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
  return (
    <div className={`bg-white rounded-lg border border-slate-200 border-l-[3px] ${accent[color] ?? accent.blue} p-4`}>
      <div className="flex items-start justify-between mb-3">
        {Icon && <Icon size={14} className={`${iconClr[color] ?? iconClr.blue} flex-shrink-0`} />}
        {delta && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trendCls}`}>
            {trend === 'up' ? '▲' : '▼'} {delta}
          </span>
        )}
      </div>
      <p className="text-[26px] font-bold text-slate-900 leading-none tracking-tight font-mono mb-1.5">{value}</p>
      <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-slate-200 mb-2 border-b border-slate-700 pb-1.5 text-[11px]">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-slate-400 flex-1 text-[10px]">{p.name}:</span>
          <span className="font-bold text-white">{typeof p.value === 'number' ? formatBRL(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProjetosDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('P&L Operacional')
  const [period, setPeriod] = useState('mes')
  const [projetoFilter, setProjetoFilter] = useState('todos')
  const [rawData, setRawData] = useState<any>({
    projetos: [], aportes: [], despesas: [], movimentacoes: [],
  })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [projRes, aportRes, movRes] = await Promise.all([
      supabase.from('projetos').select('*').order('nome'),
      supabase.from('aportes').select('*').order('data'),
      supabase.from('movimentacoes').select('*').order('data'),
    ])
    const despRes = await (supabase as any).from('despesas_operacionais').select('*').order('data')
    setRawData({
      projetos:       projRes.data  || [],
      aportes:        aportRes.data || [],
      despesas:       despRes.error ? [] : (despRes.data || []),
      movimentacoes:  movRes.data   || [],
    })
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const periodDays = PERIOD_OPTIONS.find(p => p.value === period)?.days ?? 365

  // Date cutoff
  const cutoff = useMemo(() => {
    if (period === 'tudo') return new Date('2000-01-01').toISOString().split('T')[0]
    const d = new Date(); d.setDate(d.getDate() - periodDays)
    return d.toISOString().split('T')[0]
  }, [period, periodDays])

  // Filtered by project + period
  const apF = useMemo(() =>
    rawData.aportes.filter((a: any) =>
      (projetoFilter === 'todos' || a.projeto_id === projetoFilter) &&
      (a.data || '') >= cutoff
    ), [rawData.aportes, projetoFilter, cutoff])

  const despF = useMemo(() =>
    rawData.despesas.filter((d: any) =>
      (projetoFilter === 'todos' || d.projeto_id === projetoFilter) &&
      (d.data || '') >= cutoff
    ), [rawData.despesas, projetoFilter, cutoff])

  const movF = useMemo(() =>
    rawData.movimentacoes.filter((m: any) => (m.data || '') >= cutoff),
    [rawData.movimentacoes, cutoff]
  )

  // Totals
  const totalAportes   = apF.reduce((s: number, a: any) => s + (a.valor || 0), 0)
  const totalDespesas  = despF.reduce((s: number, d: any) => s + (d.valor || 0), 0)
  const totalReceita   = movF.filter((m: any) => m.tipo === 'entrada').reduce((s: number, m: any) => s + m.valor, 0)
  const totalSaidas    = movF.filter((m: any) => m.tipo === 'saida').reduce((s: number, m: any) => s + m.valor, 0)
  const lucroOp        = totalReceita - totalDespesas - totalSaidas

  const totalAportesAll = rawData.aportes.reduce((s: number, a: any) => s + (a.valor || 0), 0)
  const meuAporte       = rawData.aportes.filter((a: any) => a.tipo !== 'aporte_socio').reduce((s: number, a: any) => s + (a.valor || 0), 0)
  const socioAporte     = rawData.aportes.filter((a: any) => a.tipo === 'aporte_socio').reduce((s: number, a: any) => s + (a.valor || 0), 0)

  // ── Time-series P&L ──────────────────────────────────────────────────────
  const timeData = useMemo(() => {
    const keys = buildPeriodKeys(period, periodDays).slice(-( period === 'dia' ? 30 : period === 'semana' ? 12 : period === 'mes' ? 12 : period === 'ano' ? 5 : 20))
    const map: Record<string, { receita: number; despesas: number; saidas: number; aportes: number }> = {}
    keys.forEach(k => { map[k] = { receita: 0, despesas: 0, saidas: 0, aportes: 0 } })

    movF.forEach((m: any) => {
      const k = periodKey(m.data, period)
      if (map[k]) {
        if (m.tipo === 'entrada') map[k].receita += m.valor
        else map[k].saidas += m.valor
      }
    })
    despF.forEach((d: any) => {
      const k = periodKey(d.data, period)
      if (map[k]) map[k].despesas += d.valor
    })
    apF.forEach((a: any) => {
      if (!a.data) return
      const k = periodKey(a.data, period)
      if (map[k]) map[k].aportes += (a.valor || 0)
    })

    return keys.map(k => ({
      periodo: k,
      receita: map[k].receita,
      despesas_op: map[k].despesas,
      outras_saidas: map[k].saidas,
      lucro: map[k].receita - map[k].despesas - map[k].saidas,
      aportes: map[k].aportes,
    }))
  }, [period, periodDays, movF, despF, apF])

  // ── Per-project P&L ──────────────────────────────────────────────────────
  const projetosPL = useMemo(() =>
    rawData.projetos.map((p: any) => {
      const ap   = rawData.aportes.filter((a: any) => a.projeto_id === p.id).reduce((s: number, a: any) => s + (a.valor || 0), 0)
      const desp = rawData.despesas.filter((d: any) => d.projeto_id === p.id).reduce((s: number, d: any) => s + d.valor, 0)
      const roi  = ap > 0 && p.valor_total ? ((p.valor_total - ap) / ap * 100) : 0
      return {
        id: p.id, nome: p.nome, status: p.status,
        nomeShort: p.nome.length > 20 ? p.nome.slice(0, 20) + '…' : p.nome,
        aportes: ap, despesas_op: desp,
        valor_total: p.valor_total || 0,
        lucro_teorico: (p.valor_total || 0) - ap,
        meuAp:   rawData.aportes.filter((a: any) => a.projeto_id === p.id && a.tipo !== 'aporte_socio').reduce((s: number, a: any) => s + (a.valor || 0), 0),
        socioAp: rawData.aportes.filter((a: any) => a.projeto_id === p.id && a.tipo === 'aporte_socio').reduce((s: number, a: any) => s + (a.valor || 0), 0),
        roi,
      }
    }).sort((a: any, b: any) => b.aportes - a.aportes),
    [rawData]
  )

  const pieAportes = [
    { name: 'Capital Próprio', value: meuAporte,   color: '#3b82f6' },
    { name: 'Aporte de Sócios', value: socioAporte, color: '#8b5cf6' },
  ].filter(d => d.value > 0)

  if (loading) return (
    <AppLayout>
      <Topbar title="Dashboard de Projetos" subtitle="P&L • Aportes • Despesas • Lucro" />
      <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-28 bg-white rounded-lg animate-pulse" />)}
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <Topbar title="Dashboard de Projetos" subtitle="P&L • Aportes • Despesas • Lucro" />

      <div className="p-6 space-y-5">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tab bar */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Period filter — only for P&L tab */}
          {tab === 'P&L Operacional' && (
            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
              {PERIOD_OPTIONS.map(p => (
                <button key={p.value} onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === p.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Project filter */}
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={() => setProjetoFilter('todos')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${projetoFilter === 'todos' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              Todos
            </button>
            {rawData.projetos.map((p: any) => (
              <button key={p.id} onClick={() => setProjetoFilter(p.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${projetoFilter === p.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                {p.nome}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ TAB: P&L OPERACIONAL ═══ */}
        {tab === 'P&L Operacional' && (
          <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Receita Operacional" value={formatShort(totalReceita)} sub="entradas no período" icon={TrendingUp} color="green" />
              <KpiCard label="Despesas Operacionais" value={formatShort(totalDespesas + totalSaidas)} sub="saídas no período" icon={TrendingDown} color="red" />
              <KpiCard
                label="Lucro Operacional"
                value={formatShort(Math.abs(lucroOp))}
                sub={lucroOp >= 0 ? 'receita > despesas' : 'despesas > receita'}
                icon={DollarSign}
                color={lucroOp >= 0 ? 'green' : 'red'}
                trend={lucroOp >= 0 ? 'up' : 'down'}
                delta={lucroOp >= 0 ? 'Lucro' : 'Prejuízo'}
              />
              <KpiCard label="Aportes no Período" value={formatShort(totalAportes)} sub="investimento aplicado" icon={Target} color="purple" />
            </div>

            {/* Main P&L Chart */}
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Receita vs. Despesas vs. Lucro</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Período: {PERIOD_OPTIONS.find(p => p.value === period)?.label}</p>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500" /> Receita</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-400" /> Despesas</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-0.5 bg-blue-500" /> Lucro</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={timeData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} width={44} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine yAxisId="left" y={0} stroke="#e2e8f0" />
                  <Bar yAxisId="left" dataKey="receita"      name="Receita"        fill="#22c55e" fillOpacity={0.85} radius={[3,3,0,0]} barSize={12} />
                  <Bar yAxisId="left" dataKey="despesas_op"  name="Desp. Op."      fill="#ef4444" fillOpacity={0.75} radius={[3,3,0,0]} barSize={12} />
                  <Bar yAxisId="left" dataKey="outras_saidas" name="Outras Saídas" fill="#f97316" fillOpacity={0.6}  radius={[3,3,0,0]} barSize={12} />
                  <Line yAxisId="right" type="monotone" dataKey="lucro" name="Lucro" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Aportes por período */}
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Aportes (Investimento) por Período</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={timeData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="aportes" name="Aportes" fill="#8b5cf6" fillOpacity={0.85} radius={[3,3,0,0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {[
                { label: 'Receita Total', value: totalReceita, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Despesas Operacionais', value: totalDespesas, color: 'text-red-500', bg: 'bg-red-50' },
                { label: 'Outras Saídas', value: totalSaidas, color: 'text-orange-500', bg: 'bg-orange-50' },
              ].map(item => (
                <div key={item.label} className={`${item.bg} rounded-lg border border-slate-200 p-5`}>
                  <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                  <p className={`text-2xl font-bold ${item.color}`}>{formatBRL(item.value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ TAB: INVESTIMENTOS ═══ */}
        {tab === 'Investimentos' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Total Investido" value={formatShort(totalAportesAll)} sub="todos os projetos" icon={Target} color="purple" />
              <KpiCard label="Capital Próprio" value={formatShort(meuAporte)} sub={totalAportesAll > 0 ? `${(meuAporte/totalAportesAll*100).toFixed(0)}% do total` : '—'} icon={User} color="blue" />
              <KpiCard label="Aporte de Sócios" value={formatShort(socioAporte)} sub={totalAportesAll > 0 ? `${(socioAporte/totalAportesAll*100).toFixed(0)}% do total` : '—'} icon={Users} color="purple" />
              <KpiCard label="Projetos" value={String(rawData.projetos.length)} sub={`${rawData.projetos.filter((p: any) => p.status === 'ativo').length} ativos`} icon={FolderOpen} color="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Pie composição */}
              <div className="bg-white rounded-lg border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Composição dos Aportes</h3>
                {pieAportes.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-10">Nenhum aporte registrado</p>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={pieAportes} cx="50%" cy="50%" outerRadius={70} innerRadius={40} dataKey="value" paddingAngle={3}>
                          {pieAportes.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="w-full space-y-2">
                      {pieAportes.map(e => (
                        <div key={e.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
                            <span className="text-slate-600">{e.name}</span>
                          </div>
                          <span className="font-semibold text-slate-900">{formatShort(e.value)} <span className="text-slate-400">({totalAportesAll > 0 ? (e.value/totalAportesAll*100).toFixed(0) : 0}%)</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Aportes por projeto */}
              <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Aportes por Projeto — Próprio vs. Sócios</h3>
                {projetosPL.filter((p: any) => p.aportes > 0).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-10">Nenhum aporte registrado</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={projetosPL.filter((p: any) => p.aportes > 0)} barSize={16}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="nomeShort" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} width={44} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="meuAp"   name="Capital Próprio" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="socioAp" name="Sócios"          stackId="a" fill="#8b5cf6" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Participation table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">Participação por Projeto</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Projeto</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-slate-500">Capital Próprio</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-slate-500">Sócios</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-slate-500">Total</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-500 min-w-[140px]">Minha Participação</th>
                  </tr>
                </thead>
                <tbody>
                  {projetosPL.map((p: any, i: number) => {
                    const myPct = p.aportes > 0 ? (p.meuAp / p.aportes * 100) : 100
                    return (
                      <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${i === projetosPL.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-5 py-3 font-medium text-slate-900 text-xs">{p.nome}</td>
                        <td className="px-5 py-3">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${p.status === 'ativo' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{p.status || '—'}</span>
                        </td>
                        <td className="px-5 py-3 text-right text-xs font-semibold text-blue-700">{formatBRL(p.meuAp)}</td>
                        <td className="px-5 py-3 text-right text-xs font-semibold text-purple-700">{formatBRL(p.socioAp)}</td>
                        <td className="px-5 py-3 text-right text-xs font-bold text-slate-900">{formatBRL(p.aportes)}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-purple-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${myPct}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-slate-700 w-8 text-right">{myPct.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ TAB: P&L POR PROJETO ═══ */}
        {tab === 'P&L por Projeto' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Total Investido" value={formatShort(rawData.aportes.reduce((s: number, a: any) => s + (a.valor || 0), 0))} sub="todos os aportes" icon={Target} color="purple" />
              <KpiCard label="Total Desp. Op." value={formatShort(rawData.despesas.reduce((s: number, d: any) => s + d.valor, 0))} sub="despesas de operação" icon={TrendingDown} color="red" />
              <KpiCard label="Valor Total Previsto" value={formatShort(rawData.projetos.reduce((s: number, p: any) => s + (p.valor_total || 0), 0))} sub="soma dos valores meta" icon={BarChart2} color="blue" />
              <KpiCard
                label="Lucro Teórico Total"
                value={formatShort(Math.abs(projetosPL.reduce((s: number, p: any) => s + p.lucro_teorico, 0)))}
                sub="valor_total − aportes"
                icon={DollarSign}
                color={projetosPL.reduce((s: number, p: any) => s + p.lucro_teorico, 0) >= 0 ? 'green' : 'red'}
              />
            </div>

            {/* Horizontal grouped bar */}
            {projetosPL.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Aportes vs. Despesas Operacionais por Projeto</h3>
                <ResponsiveContainer width="100%" height={Math.max(220, projetosPL.length * 52)}>
                  <BarChart data={projetosPL} layout="vertical" barSize={13} margin={{ right: 80, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="nomeShort" tick={{ fontSize: 10, fill: '#64748b' }} width={120} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="aportes"    name="Aportes (Invest.)" fill="#8b5cf6" fillOpacity={0.85} radius={[0,3,3,0]}
                      label={{ position: 'right', fontSize: 9, fill: '#8b5cf6', formatter: (v: number) => v > 0 ? formatShort(v) : '' }} />
                    <Bar dataKey="despesas_op" name="Desp. Operacionais" fill="#ef4444" fillOpacity={0.75} radius={[0,3,3,0]}
                      label={{ position: 'right', fontSize: 9, fill: '#ef4444', formatter: (v: number) => v > 0 ? formatShort(v) : '' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* P&L table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">P&L Completo por Projeto</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Lucro Teórico = Valor Total Meta − Aportes</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Projeto</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Aportes</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Desp. Op.</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Meta</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Lucro Teórico</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projetosPL.length === 0 ? (
                      <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-400">Nenhum projeto cadastrado</td></tr>
                    ) : projetosPL.map((p: any, i: number) => (
                      <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${i === projetosPL.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-5 py-3 font-medium text-slate-900 text-xs">{p.nome}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${p.status === 'ativo' ? 'bg-green-50 text-green-700 border-green-200' : p.status === 'pausado' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{p.status || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-purple-700">{formatBRL(p.aportes)}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-red-500">{p.despesas_op > 0 ? formatBRL(p.despesas_op) : '—'}</td>
                        <td className="px-4 py-3 text-right text-xs text-slate-500">{p.valor_total > 0 ? formatBRL(p.valor_total) : '—'}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold">
                          {p.valor_total > 0 ? <span className={p.lucro_teorico >= 0 ? 'text-green-600' : 'text-red-500'}>{p.lucro_teorico >= 0 ? '+' : ''}{formatBRL(p.lucro_teorico)}</span> : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-bold">
                          {p.roi !== 0 ? <span className={p.roi >= 0 ? 'text-green-600' : 'text-red-500'}>{p.roi >= 0 ? '+' : ''}{p.roi.toFixed(1)}%</span> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {projetosPL.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td className="px-5 py-3 text-xs font-bold text-slate-700" colSpan={2}>Total</td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-purple-700">{formatBRL(projetosPL.reduce((s: number, p: any) => s + p.aportes, 0))}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-red-500">{formatBRL(projetosPL.reduce((s: number, p: any) => s + p.despesas_op, 0))}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-slate-700">{formatBRL(projetosPL.reduce((s: number, p: any) => s + p.valor_total, 0))}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold">
                          <span className={projetosPL.reduce((s: number, p: any) => s + p.lucro_teorico, 0) >= 0 ? 'text-green-600' : 'text-red-500'}>
                            {formatBRL(projetosPL.reduce((s: number, p: any) => s + p.lucro_teorico, 0))}
                          </span>
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
