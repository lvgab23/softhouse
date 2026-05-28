'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Wallet, TrendingUp, TrendingDown, Percent, Wrench, FolderOpen,
  Building2, DollarSign, Activity, Target, ArrowUpRight, ArrowDownRight,
  Briefcase, PiggyBank, Filter, AlertCircle, ChevronRight, X,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart, Line, ReferenceLine,
} from 'recharts'
import { Topbar } from '@/components/layout/topbar'
import { formatBRL, formatShort } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// ── Palettes / constants ────────────────────────────────────────────────────
const C = {
  blue: '#3b82f6', green: '#22c55e', red: '#ef4444', amber: '#f59e0b',
  purple: '#8b5cf6', cyan: '#06b6d4', pink: '#ec4899', teal: '#14b8a6',
  lime: '#84cc16', slate: '#64748b', orange: '#f97316',
}
const PALETTE = [C.blue, C.green, C.amber, C.purple, C.cyan, C.pink, C.teal, C.lime, C.orange, C.slate]

const BENS_TIPO: Record<string, string> = {
  automovel: 'Automóveis', moto: 'Motocicletas', caminhao: 'Caminhões',
  van: 'Utilitários', maquinario: 'Maquinário', equipamento: 'Equipamentos', outro: 'Outros Bens',
}

const PERIODS = [
  { label: 'Mês',      days: 30 },
  { label: 'Trimestre', days: 90 },
  { label: 'Ano',      days: 365 },
  { label: 'Tudo',     days: 0 },
]
const TABS = ['Consolidado', 'Projetos', 'Patrimônio', 'Negócios']

type ModuleKey = 'todos' | 'projetos' | 'bens' | 'negocios'
const MODULES: { key: ModuleKey; label: string; color: string }[] = [
  { key: 'todos',    label: 'Todos',    color: '#0f172a' },
  { key: 'projetos', label: 'Projetos', color: C.purple  },
  { key: 'bens',     label: 'Bens',     color: C.blue    },
  { key: 'negocios', label: 'Negócios', color: C.amber   },
]

// ── Shared UI ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color = 'blue', trend, delta }: any) {
  const accent: Record<string, string> = {
    blue: 'border-l-blue-500', green: 'border-l-emerald-500', red: 'border-l-red-500',
    amber: 'border-l-amber-500', purple: 'border-l-violet-500', teal: 'border-l-teal-500',
    slate: 'border-l-slate-400', cyan: 'border-l-cyan-500', gray: 'border-l-slate-300',
  }
  const iconClr: Record<string, string> = {
    blue: 'text-blue-500', green: 'text-emerald-500', red: 'text-red-500',
    amber: 'text-amber-500', purple: 'text-violet-500', teal: 'text-teal-500',
    slate: 'text-slate-400', cyan: 'text-cyan-500', gray: 'text-slate-400',
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

function PanelTitle({ title, sub }: { title: string; sub?: string }) {
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
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-slate-400 flex-1 text-[10px]">{p.name}:</span>
          <span className="font-bold text-white">{typeof p.value === 'number' ? formatBRL(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

function DonutLegend({ data, palette }: { data: { name: string; value: number }[]; palette: string[] }) {
  const total = data.reduce((s, x) => s + x.value, 0)
  return (
    <div className="flex-1 space-y-2.5">
      {data.slice(0, 7).map((item, i) => {
        const pct = total > 0 ? (item.value / total * 100) : 0
        return (
          <div key={item.name}>
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: palette[i % palette.length] }} />
                <span className="text-[11px] text-slate-600 truncate">{item.name}</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-700 ml-2">{pct.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: palette[i % palette.length] }} />
            </div>
          </div>
        )
      })}
      <p className="text-[10px] text-slate-300 pt-1">Total: {formatBRL(total)}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ativo: 'bg-green-50 text-green-700 border-green-200', ativa: 'bg-green-50 text-green-700 border-green-200',
    em_execucao: 'bg-blue-50 text-blue-700 border-blue-200', concluido: 'bg-teal-50 text-teal-700 border-teal-200',
    pausado: 'bg-amber-50 text-amber-700 border-amber-200', cancelado: 'bg-red-50 text-red-700 border-red-200',
    inativo: 'bg-slate-50 text-slate-400 border-slate-200', captacao: 'bg-purple-50 text-purple-700 border-purple-200',
    vendido: 'bg-slate-50 text-slate-400 border-slate-200',
  }
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${map[status] || 'bg-slate-50 text-slate-400 border-slate-200'}`}>{status.replace(/_/g, ' ')}</span>
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState('Consolidado')
  const [period, setPeriod]         = useState(PERIODS[2])
  const [moduleFilter, setModule]   = useState<ModuleKey>('todos')
  const [itemFilter, setItem]       = useState<string | null>(null)
  const [raw, setRaw]               = useState<any>({
    patrimonios: [], bensMoveis: [], movimentacoes: [], manutencoes: [],
    projetos: [], aportes: [], despesas: [], empresas: [], alugueis: [],
  })

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const [patriRes, movRes, manRes, projRes, aportRes, alugRes] = await Promise.all([
        sb.from('patrimonios').select('*, categorias(nome)'),
        sb.from('movimentacoes').select('*').order('data', { ascending: false }),
        sb.from('manutencoes').select('*, patrimonios(nome)').neq('status', 'concluida').order('created_at', { ascending: false }).limit(8),
        sb.from('projetos').select('*').order('nome'),
        sb.from('aportes').select('*, projetos(nome)').order('data', { ascending: false }),
        sb.from('alugueis').select('*').eq('status', 'ativo'),
      ])
      const [despRes, bensRes, empRes] = await Promise.all([
        (sb as any).from('despesas_operacionais').select('*, projetos(nome)').order('data', { ascending: false }),
        (sb as any).from('bens_moveis').select('*').order('nome'),
        (sb as any).from('empresas').select('*').order('nome'),
      ])
      setRaw({
        patrimonios: patriRes.data || [],
        bensMoveis: bensRes.error ? [] : (bensRes.data || []),
        movimentacoes: movRes.data || [],
        manutencoes: manRes.data || [],
        projetos: projRes.data || [],
        aportes: aportRes.data || [],
        despesas: despRes.error ? [] : (despRes.data || []),
        empresas: empRes.error ? [] : (empRes.data || []),
        alugueis: alugRes.data || [],
      })
      setLoading(false)
    }
    load()
  }, [])

  const dateFrom = useMemo(() => {
    if (period.days === 0) return '2000-01-01'
    const d = new Date(); d.setDate(d.getDate() - period.days)
    return d.toISOString().split('T')[0]
  }, [period])

  const handleModule = (m: ModuleKey) => { setModule(m); setItem(null) }

  // Items for the current module filter
  const moduleItems = useMemo(() => {
    if (moduleFilter === 'projetos') return raw.projetos.map((p: any) => ({ id: p.id, nome: p.nome, sub: p.status }))
    if (moduleFilter === 'bens') return [
      ...raw.patrimonios.filter((p: any) => p.status !== 'vendido').map((p: any) => ({ id: p.id, nome: p.nome, sub: p.categorias?.nome || 'Imóvel' })),
      ...raw.bensMoveis.map((b: any) => ({ id: `bm_${b.id}`, nome: b.nome, sub: BENS_TIPO[b.tipo] || 'Bem Móvel' })),
    ]
    if (moduleFilter === 'negocios') return raw.empresas.map((e: any) => ({ id: e.id, nome: e.nome, sub: e.setor }))
    return []
  }, [moduleFilter, raw])

  // Resolved selected item object
  const selectedItem = useMemo(() => {
    if (!itemFilter) return null
    if (moduleFilter === 'projetos') return raw.projetos.find((p: any) => p.id === itemFilter) || null
    if (moduleFilter === 'bens') {
      if (itemFilter.startsWith('bm_')) return raw.bensMoveis.find((b: any) => `bm_${b.id}` === itemFilter) || null
      return raw.patrimonios.find((p: any) => p.id === itemFilter) || null
    }
    if (moduleFilter === 'negocios') return raw.empresas.find((e: any) => e.id === itemFilter) || null
    return null
  }, [itemFilter, moduleFilter, raw])

  // ── Core metrics ────────────────────────────────────────────────────────
  const base = useMemo(() => {
    const imAtivos = raw.patrimonios.filter((p: any) => p.status !== 'vendido' && p.status !== 'inativo')
    const totalImoveis = imAtivos.reduce((s: number, p: any) => s + (p.valor_atual || p.valor_aquisicao || 0), 0)
    const totalImAq    = imAtivos.reduce((s: number, p: any) => s + (p.valor_aquisicao || 0), 0)
    const totalBens    = raw.bensMoveis.reduce((s: number, b: any) => s + (b.valor_atual || b.valor_aquisicao || 0), 0)
    const totalAportes = raw.aportes.reduce((s: number, a: any) => s + (a.valor || 0), 0)
    const totalEmpI    = raw.empresas.reduce((s: number, e: any) => s + (e.valor_investimento || 0), 0)
    const totalEmpR    = raw.empresas.reduce((s: number, e: any) => s + (e.valor_retorno || 0), 0)
    const aluguelMes   = raw.alugueis.reduce((s: number, a: any) => s + (a.valor_aluguel || 0), 0)
    return { imAtivos, totalImoveis, totalImAq, totalBens, totalAportes, totalEmpI, totalEmpR, aluguelMes }
  }, [raw])

  // Filtered metrics based on module + item + period
  const metrics = useMemo(() => {
    let movs  = raw.movimentacoes.filter((m: any) => m.data >= dateFrom)
    let desps = raw.despesas.filter((d: any) => d.data >= dateFrom)
    let aports = raw.aportes.filter((a: any) => (a.data || '') >= dateFrom)

    if (moduleFilter === 'projetos' && itemFilter) {
      movs   = movs.filter(() => false) // movimentacoes not linked to projetos directly
      desps  = desps.filter((d: any) => d.projeto_id === itemFilter)
      aports = aports.filter((a: any) => a.projeto_id === itemFilter)
    } else if (moduleFilter === 'projetos') {
      // no additional filter needed for projetos aggregate
    } else if (moduleFilter === 'bens' && itemFilter && !itemFilter.startsWith('bm_')) {
      movs = movs.filter((m: any) => m.patrimonio_id === itemFilter)
    } else if (moduleFilter === 'negocios') {
      movs  = movs.filter(() => false)
      desps = desps.filter(() => false)
    }

    const receita  = movs.filter((m: any) => m.tipo === 'entrada').reduce((s: number, m: any) => s + m.valor, 0)
    const saidas   = movs.filter((m: any) => m.tipo === 'saida').reduce((s: number, m: any) => s + m.valor, 0)
    const despesaP = desps.reduce((s: number, d: any) => s + d.valor, 0)
    const lucro    = receita - saidas - despesaP
    const totalAportP = aports.reduce((s: number, a: any) => s + (a.valor || 0), 0)

    return { receita, saidas, despesaP, lucro, totalAportP }
  }, [raw, dateFrom, moduleFilter, itemFilter])

  // ── Portfolio chart data ─────────────────────────────────────────────────
  const portfolioData = useMemo(() => {
    if (moduleFilter === 'todos') {
      // Combine ALL categories across all modules
      const map: Record<string, number> = {}
      raw.patrimonios.filter((p: any) => p.status !== 'vendido').forEach((p: any) => {
        const cat = p.categorias?.nome || 'Imóveis'
        map[cat] = (map[cat] || 0) + (p.valor_atual || p.valor_aquisicao || 0)
      })
      raw.bensMoveis.forEach((b: any) => {
        const tipo = BENS_TIPO[b.tipo] || 'Outros Bens'
        map[tipo] = (map[tipo] || 0) + (b.valor_atual || b.valor_aquisicao || 0)
      })
      if (base.totalAportes > 0) map['Projetos'] = base.totalAportes
      if (base.totalEmpI > 0)    map['Negócios'] = base.totalEmpI
      return Object.entries(map).map(([name, value]) => ({ name, value })).filter(x => x.value > 0).sort((a, b) => b.value - a.value)
    }

    if (moduleFilter === 'projetos') {
      if (itemFilter) {
        const proj = raw.projetos.find((p: any) => p.id === itemFilter)
        if (!proj) return []
        const val = raw.aportes.filter((a: any) => a.projeto_id === itemFilter).reduce((s: number, a: any) => s + (a.valor || 0), 0)
        return [{ name: proj.nome, value: val }]
      }
      return raw.projetos.map((p: any) => ({
        name: p.nome.length > 20 ? p.nome.slice(0, 20) + '…' : p.nome,
        value: raw.aportes.filter((a: any) => a.projeto_id === p.id).reduce((s: number, a: any) => s + (a.valor || 0), 0),
      })).filter((x: any) => x.value > 0).sort((a: any, b: any) => b.value - a.value)
    }

    if (moduleFilter === 'bens') {
      if (itemFilter) {
        if (itemFilter.startsWith('bm_')) {
          const bem = raw.bensMoveis.find((b: any) => `bm_${b.id}` === itemFilter)
          return bem ? [{ name: bem.nome, value: bem.valor_atual || bem.valor_aquisicao || 0 }] : []
        }
        const pat = raw.patrimonios.find((p: any) => p.id === itemFilter)
        return pat ? [{ name: pat.nome, value: pat.valor_atual || pat.valor_aquisicao || 0 }] : []
      }
      const map: Record<string, number> = {}
      raw.patrimonios.filter((p: any) => p.status !== 'vendido').forEach((p: any) => {
        const cat = p.categorias?.nome || 'Imóveis'
        map[cat] = (map[cat] || 0) + (p.valor_atual || p.valor_aquisicao || 0)
      })
      raw.bensMoveis.forEach((b: any) => {
        const tipo = BENS_TIPO[b.tipo] || 'Outros Bens'
        map[tipo] = (map[tipo] || 0) + (b.valor_atual || b.valor_aquisicao || 0)
      })
      return Object.entries(map).map(([name, value]) => ({ name, value })).filter(x => x.value > 0).sort((a, b) => b.value - a.value)
    }

    if (moduleFilter === 'negocios') {
      if (itemFilter) {
        const emp = raw.empresas.find((e: any) => e.id === itemFilter)
        return emp ? [{ name: emp.nome, value: emp.valor_investimento || 0 }] : []
      }
      return raw.empresas.map((e: any) => ({
        name: e.nome.length > 20 ? e.nome.slice(0, 20) + '…' : e.nome,
        value: e.valor_investimento || 0,
      })).filter((x: any) => x.value > 0).sort((a: any, b: any) => b.value - a.value)
    }
    return []
  }, [raw, moduleFilter, itemFilter, base])

  // ── Fluxo 12 meses ──────────────────────────────────────────────────────
  const fluxoMensal = useMemo(() => {
    const hoje = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - (11 - i), 1)
      const ini = d.toISOString().split('T')[0]
      const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
      const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })

      let movM  = raw.movimentacoes.filter((x: any) => x.data >= ini && x.data <= fim)
      let despM = raw.despesas.filter((x: any) => x.data >= ini && x.data <= fim)
      let aortM = raw.aportes.filter((x: any) => (x.data || '') >= ini && (x.data || '') <= fim)

      if (moduleFilter === 'bens' && itemFilter && !itemFilter.startsWith('bm_')) {
        movM = movM.filter((m: any) => m.patrimonio_id === itemFilter)
      }
      if (moduleFilter === 'projetos' && itemFilter) {
        despM = despM.filter((d: any) => d.projeto_id === itemFilter)
        aortM = aortM.filter((a: any) => a.projeto_id === itemFilter)
        movM  = []
      }
      if (moduleFilter === 'negocios') { movM = []; despM = [] }

      const receita  = movM.filter((x: any) => x.tipo === 'entrada').reduce((s: number, x: any) => s + x.valor, 0)
      const saidas   = movM.filter((x: any) => x.tipo === 'saida').reduce((s: number, x: any) => s + x.valor, 0)
      const despesas = despM.reduce((s: number, x: any) => s + x.valor, 0)
      const aportes  = aortM.reduce((s: number, x: any) => s + (x.valor || 0), 0)
      return { mes: key, receita, saidas, despesas, aportes, lucro: receita - saidas - despesas }
    })
  }, [raw, moduleFilter, itemFilter])

  // ── P&L projetos ────────────────────────────────────────────────────────
  const projetosPL = useMemo(() => {
    const list = itemFilter && moduleFilter === 'projetos'
      ? raw.projetos.filter((p: any) => p.id === itemFilter)
      : raw.projetos
    return list.map((p: any) => {
      const ap  = raw.aportes.filter((a: any) => a.projeto_id === p.id).reduce((s: number, a: any) => s + (a.valor || 0), 0)
      const dep = raw.despesas.filter((d: any) => d.projeto_id === p.id).reduce((s: number, d: any) => s + d.valor, 0)
      const vt  = p.valor_total || 0
      const lucro = vt > 0 ? vt - ap : 0
      const roi   = ap > 0 && vt > 0 ? ((vt - ap) / ap * 100) : 0
      return { id: p.id, nome: p.nome, status: p.status, aportes: ap, despesas: dep, valorTotal: vt, lucro, roi, nomeShort: p.nome.length > 22 ? p.nome.slice(0, 22) + '…' : p.nome }
    }).sort((a: any, b: any) => b.aportes - a.aportes)
  }, [raw, moduleFilter, itemFilter])

  if (loading) {
    return (
      <>
        <Topbar title="Dashboard Executivo" subtitle="Visão consolidada do portfólio" />
        <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 bg-white rounded-lg border border-slate-200 animate-pulse" />)}
        </div>
      </>
    )
  }

  const totalCarteira = base.totalImoveis + base.totalBens + base.totalEmpI

  return (
    <>
      <Topbar title="Dashboard Executivo" subtitle="Visão consolidada do portfólio" />

      <div className="p-6 space-y-5">

        {/* ── Top controls ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
            {PERIODS.map(p => (
              <button key={p.label} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period.label === p.label ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ════════ CONSOLIDADO ════════ */}
        {activeTab === 'Consolidado' && (
          <div className="space-y-5">

            {/* ── Filter bar ── */}
            <Panel className="!p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Filter className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-xs font-medium text-slate-500">Visualizar por:</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {MODULES.map(m => (
                    <button key={m.key} onClick={() => handleModule(m.key)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                        moduleFilter === m.key
                          ? 'text-white border-transparent shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                      style={moduleFilter === m.key ? { background: m.color, borderColor: m.color } : {}}>
                      {m.label}
                    </button>
                  ))}
                </div>
                {itemFilter && (
                  <button onClick={() => setItem(null)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 ml-auto">
                    <X className="h-3 w-3" /> Limpar seleção
                  </button>
                )}
              </div>

              {/* Item pills for selected module */}
              {moduleFilter !== 'todos' && moduleItems.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-2">
                    {moduleFilter === 'projetos' ? 'Projetos' : moduleFilter === 'bens' ? 'Ativos' : 'Empresas'}
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => setItem(null)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${!itemFilter ? 'bg-[#0f172a] text-white border-transparent' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      Todos
                    </button>
                    {moduleItems.map((item: any) => (
                      <button key={item.id} onClick={() => setItem(item.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border max-w-[180px] truncate ${itemFilter === item.id ? 'bg-[#0f172a] text-white border-transparent' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        title={item.nome}>
                        {item.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Panel>

            {/* ── KPIs ── */}
            {moduleFilter === 'todos' && (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <KpiCard label="Total do Portfólio" value={formatShort(totalCarteira)} sub={`${base.imAtivos.length + raw.bensMoveis.length} ativos`}
                  icon={Wallet} color="blue" trend={base.totalImoveis > base.totalImAq ? 'up' : 'neutral'} delta={`+${formatShort(base.totalImoveis - base.totalImAq)}`} />
                <KpiCard label="Receita (Período)" value={formatShort(metrics.receita)} sub="entradas" icon={TrendingUp} color="green" trend="up" delta={period.label} />
                <KpiCard label="Despesas (Período)" value={formatShort(metrics.saidas + metrics.despesaP)} sub="saídas + op." icon={TrendingDown} color="red" />
                <KpiCard label="Lucro (Período)" value={formatShort(Math.abs(metrics.lucro))} sub={metrics.lucro >= 0 ? 'positivo' : 'negativo'}
                  icon={DollarSign} color={metrics.lucro >= 0 ? 'green' : 'red'} trend={metrics.lucro >= 0 ? 'up' : 'down'} delta={metrics.lucro >= 0 ? 'Lucro' : 'Prejuízo'} />
                <KpiCard label="Aluguel/Mês" value={formatShort(base.aluguelMes)} sub={`${raw.alugueis.length} contratos`} icon={Building2} color="cyan" />
                <KpiCard label="Total Investido" value={formatShort(base.totalAportes + base.totalImAq)} sub="aportes + aquisições" icon={Target} color="purple" />
              </div>
            )}

            {moduleFilter === 'projetos' && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Total Aportes" value={formatShort(raw.aportes.filter((a: any) => !itemFilter || a.projeto_id === itemFilter).reduce((s: number, a: any) => s + (a.valor || 0), 0))}
                  sub="custo de implantação" icon={Target} color="purple" />
                <KpiCard label="Desp. Operacionais" value={formatShort(raw.despesas.filter((d: any) => !itemFilter || d.projeto_id === itemFilter).reduce((s: number, d: any) => s + d.valor, 0))}
                  sub="custos de operação" icon={TrendingDown} color="red" />
                <KpiCard label="Projetos" value={String(itemFilter ? 1 : raw.projetos.length)} sub={`${raw.projetos.filter((p: any) => p.status === 'ativo').length} ativos`} icon={FolderOpen} color="blue" />
                <KpiCard label="Aportes (Período)" value={formatShort(metrics.totalAportP)} sub={period.label} icon={DollarSign} color="green" />
              </div>
            )}

            {moduleFilter === 'bens' && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Carteira Imóveis" value={formatShort(base.totalImoveis)} sub={`${base.imAtivos.length} imóveis ativos`}
                  icon={Building2} color="blue" trend="up" delta={`+${formatShort(base.totalImoveis - base.totalImAq)}`} />
                <KpiCard label="Bens Móveis" value={formatShort(base.totalBens)} sub={`${raw.bensMoveis.length} bens`} icon={PiggyBank} color="cyan" />
                <KpiCard label="Aluguel/Mês" value={formatShort(base.aluguelMes)} sub={`${raw.alugueis.length} contratos`} icon={DollarSign} color="green" />
                <KpiCard label="ROI Médio" value={(() => {
                  const c = base.imAtivos.filter((p: any) => p.valor_aquisicao && p.valor_atual)
                  if (!c.length) return '—%'
                  return `${(c.reduce((s: number, p: any) => s + ((p.valor_atual - p.valor_aquisicao) / p.valor_aquisicao * 100), 0) / c.length).toFixed(1)}%`
                })()} sub="valorização vs. compra" icon={Percent} color="amber" />
              </div>
            )}

            {moduleFilter === 'negocios' && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Empresas" value={String(itemFilter ? 1 : raw.empresas.length)} sub={`${raw.empresas.filter((e: any) => e.status === 'ativa').length} ativas`} icon={Briefcase} color="purple" />
                <KpiCard label="Capital Investido" value={formatShort(raw.empresas.filter((e: any) => !itemFilter || e.id === itemFilter).reduce((s: number, e: any) => s + (e.valor_investimento || 0), 0))}
                  sub="valor total investido" icon={Target} color="blue" />
                <KpiCard label="Retorno Esperado" value={formatShort(raw.empresas.filter((e: any) => !itemFilter || e.id === itemFilter).reduce((s: number, e: any) => s + (e.valor_retorno || 0), 0))}
                  sub="retorno estimado" icon={TrendingUp} color="green" />
                <KpiCard label="ROI Estimado" value={(() => {
                  const emp = raw.empresas.filter((e: any) => !itemFilter || e.id === itemFilter)
                  const inv = emp.reduce((s: number, e: any) => s + (e.valor_investimento || 0), 0)
                  const ret = emp.reduce((s: number, e: any) => s + (e.valor_retorno || 0), 0)
                  return inv > 0 ? `${((ret - inv) / inv * 100).toFixed(1)}%` : '—'
                })()} sub="retorno vs. capital" icon={Percent} color={base.totalEmpR >= base.totalEmpI ? 'green' : 'amber'} />
              </div>
            )}

            {/* ── Item detail card ── */}
            {selectedItem && (
              <Panel className="border-l-4 border-l-blue-500">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{selectedItem.nome}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {moduleFilter === 'projetos' && `Projeto · ${selectedItem.status || '—'}`}
                      {moduleFilter === 'bens' && (selectedItem.categorias?.nome || BENS_TIPO[selectedItem.tipo] || 'Ativo')}
                      {moduleFilter === 'negocios' && `${selectedItem.setor || 'Negócio'} · ${selectedItem.status}`}
                    </p>
                  </div>
                  {selectedItem.status && <StatusBadge status={selectedItem.status} />}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {moduleFilter === 'projetos' && (() => {
                    const ap  = raw.aportes.filter((a: any) => a.projeto_id === selectedItem.id).reduce((s: number, a: any) => s + (a.valor || 0), 0)
                    const dep = raw.despesas.filter((d: any) => d.projeto_id === selectedItem.id).reduce((s: number, d: any) => s + d.valor, 0)
                    const vt  = selectedItem.valor_total || 0
                    const roi = ap > 0 && vt > 0 ? ((vt - ap) / ap * 100) : 0
                    return (
                      <>
                        <div><p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Aportes</p><p className="text-sm font-bold text-purple-700">{formatBRL(ap)}</p></div>
                        <div><p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Desp. Op.</p><p className="text-sm font-bold text-red-500">{dep > 0 ? formatBRL(dep) : '—'}</p></div>
                        <div><p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Valor Total</p><p className="text-sm font-bold text-blue-700">{vt > 0 ? formatBRL(vt) : '—'}</p></div>
                        <div><p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">ROI</p><p className={`text-sm font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-500'}`}>{roi !== 0 ? `${roi.toFixed(1)}%` : '—'}</p></div>
                      </>
                    )
                  })()}
                  {moduleFilter === 'bens' && (() => {
                    const valorAtual = selectedItem.valor_atual || selectedItem.valor_aquisicao || 0
                    const valorAq    = selectedItem.valor_aquisicao || 0
                    const valoriz    = valorAtual - valorAq
                    const roi        = valorAq > 0 ? (valoriz / valorAq * 100) : 0
                    const alug       = raw.alugueis.find((a: any) => a.patrimonio_id === selectedItem.id)
                    return (
                      <>
                        <div><p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Valor Atual</p><p className="text-sm font-bold text-blue-700">{formatBRL(valorAtual)}</p></div>
                        <div><p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Valorização</p><p className={`text-sm font-bold ${valoriz >= 0 ? 'text-green-600' : 'text-red-500'}`}>{valoriz >= 0 ? '+' : ''}{formatBRL(valoriz)}</p></div>
                        <div><p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">ROI</p><p className={`text-sm font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-500'}`}>{valorAq > 0 ? `${roi.toFixed(1)}%` : '—'}</p></div>
                        <div><p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Aluguel/Mês</p><p className="text-sm font-bold text-cyan-600">{alug ? formatBRL(alug.valor_aluguel) : '—'}</p></div>
                      </>
                    )
                  })()}
                  {moduleFilter === 'negocios' && (() => {
                    const inv = selectedItem.valor_investimento || 0
                    const ret = selectedItem.valor_retorno || 0
                    const roi = inv > 0 ? ((ret - inv) / inv * 100) : 0
                    return (
                      <>
                        <div><p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Investimento</p><p className="text-sm font-bold text-blue-700">{formatBRL(inv)}</p></div>
                        <div><p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Retorno</p><p className="text-sm font-bold text-green-600">{ret > 0 ? formatBRL(ret) : '—'}</p></div>
                        <div><p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">ROI Est.</p><p className={`text-sm font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-500'}`}>{inv > 0 ? `${roi.toFixed(1)}%` : '—'}</p></div>
                        <div><p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Fase</p><p className="text-sm font-bold text-slate-700 capitalize">{(selectedItem.fase || '—').replace(/_/g, ' ')}</p></div>
                      </>
                    )
                  })()}
                </div>
                {selectedItem.descricao && <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">{selectedItem.descricao}</p>}
              </Panel>
            )}

            {/* ── Charts ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Portfolio donut */}
              <Panel className="lg:col-span-2">
                <PanelTitle
                  title={moduleFilter === 'todos' ? 'Portfólio por Categoria' : moduleFilter === 'projetos' ? 'Distribuição por Projeto' : moduleFilter === 'bens' ? 'Patrimônio por Tipo' : 'Capital por Empresa'}
                  sub="composição do portfólio"
                />
                {portfolioData.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Sem dados</div>
                ) : (
                  <div className="flex items-center gap-3">
                    <ResponsiveContainer width="45%" height={190}>
                      <PieChart>
                        <Pie data={portfolioData} cx="50%" cy="50%" outerRadius={85} innerRadius={52} dataKey="value" paddingAngle={2}>
                          {portfolioData.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="none" />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [formatBRL(v), 'Valor']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <DonutLegend data={portfolioData} palette={PALETTE} />
                  </div>
                )}
              </Panel>

              {/* Fluxo 12 meses */}
              <Panel className="lg:col-span-3">
                <PanelTitle title="Fluxo Financeiro — 12 meses" sub="receita, despesas e lucro acumulado" />
                <ResponsiveContainer width="100%" height={192}>
                  <ComposedChart data={fluxoMensal} margin={{ top: 4, right: 5, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} width={44} />
                    <Tooltip content={<Tip />} />
                    <Legend formatter={(v) => ({ receita: 'Receita', saidas: 'Saídas', despesas: 'Desp. Op.', aportes: 'Aportes', lucro: 'Lucro' }[v] || v)} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="aportes"  name="aportes"  fill={C.purple} fillOpacity={0.7}  radius={[3,3,0,0]} barSize={8} />
                    <Bar dataKey="receita"  name="receita"  fill={C.green}  fillOpacity={0.8}  radius={[3,3,0,0]} barSize={8} />
                    <Bar dataKey="saidas"   name="saidas"   fill={C.red}    fillOpacity={0.65} radius={[3,3,0,0]} barSize={8} />
                    <Bar dataKey="despesas" name="despesas" fill={C.amber}  fillOpacity={0.65} radius={[3,3,0,0]} barSize={8} />
                    <Line type="monotone" dataKey="lucro" name="lucro" stroke={C.blue} strokeWidth={2} dot={{ fill: C.blue, r: 2.5 }} />
                    <ReferenceLine y={0} stroke="#e2e8f0" strokeDasharray="4 2" />
                  </ComposedChart>
                </ResponsiveContainer>
              </Panel>
            </div>

            {/* ── Bottom row (visible when todos or bens/projetos sem item) ── */}
            {(!itemFilter || moduleFilter === 'todos') && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Projetos ativos */}
                <Panel>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2"><FolderOpen className="h-4 w-4 text-purple-500" /><h3 className="text-sm font-semibold text-slate-800">Projetos Ativos</h3></div>
                    <span className="text-xs font-semibold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{raw.projetos.filter((p: any) => p.status === 'ativo').length}</span>
                  </div>
                  <div className="space-y-3">
                    {raw.projetos.filter((p: any) => p.status === 'ativo').slice(0, 5).map((p: any) => {
                      const ap = raw.aportes.filter((a: any) => a.projeto_id === p.id).reduce((s: number, a: any) => s + (a.valor || 0), 0)
                      const dep = raw.despesas.filter((d: any) => d.projeto_id === p.id).reduce((s: number, d: any) => s + d.valor, 0)
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 last:border-0 last:pb-0 cursor-pointer hover:bg-slate-50/60 -mx-1 px-1 rounded-lg transition-colors"
                          onClick={() => { handleModule('projetos'); setItem(p.id) }}>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-800 truncate">{p.nome}</p>
                            <p className="text-[10px] text-slate-400">Ap: {formatShort(ap)} · Desp: {formatShort(dep)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">{p.valor_total ? formatShort(p.valor_total) : '—'}</span>
                            <ChevronRight className="h-3 w-3 text-slate-300" />
                          </div>
                        </div>
                      )
                    })}
                    {raw.projetos.filter((p: any) => p.status === 'ativo').length === 0 && <p className="text-xs text-slate-300 text-center py-4">Nenhum projeto ativo</p>}
                  </div>
                </Panel>

                {/* Manutenções */}
                <Panel>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-orange-500" /><h3 className="text-sm font-semibold text-slate-800">Manutenções Pendentes</h3></div>
                    {raw.manutencoes.filter((m: any) => m.proxima_manutencao && new Date(m.proxima_manutencao) < new Date()).length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        <AlertCircle className="h-3 w-3" />
                        {raw.manutencoes.filter((m: any) => m.proxima_manutencao && new Date(m.proxima_manutencao) < new Date()).length} vencida(s)
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {raw.manutencoes.slice(0, 5).map((m: any) => {
                      const venc = m.proxima_manutencao && new Date(m.proxima_manutencao) < new Date()
                      return (
                        <div key={m.id} className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                          <div className="min-w-0"><p className="text-xs font-medium text-slate-700 truncate">{m.descricao}</p><p className="text-[10px] text-slate-400 truncate">{m.patrimonios?.nome}</p></div>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ${venc ? 'bg-red-50 text-red-600' : m.status === 'em_andamento' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                            {venc ? 'Vencida' : m.status === 'em_andamento' ? 'Em andamento' : 'Pendente'}
                          </span>
                        </div>
                      )
                    })}
                    {raw.manutencoes.length === 0 && <p className="text-xs text-slate-300 text-center py-4">Sem pendências</p>}
                  </div>
                </Panel>

                {/* P&L resumo */}
                <Panel>
                  <div className="flex items-center gap-2 mb-4"><Activity className="h-4 w-4 text-green-500" /><h3 className="text-sm font-semibold text-slate-800">P&L Consolidado</h3></div>
                  <div className="space-y-2.5">
                    {[
                      { label: 'Receitas (período)',   value: metrics.receita,   pos: true  },
                      { label: 'Saídas (período)',     value: metrics.saidas,    pos: false },
                      { label: 'Desp. Operacionais',  value: metrics.despesaP,  pos: false },
                      { label: 'Aluguel/Mês',         value: base.aluguelMes,   pos: true  },
                    ].map(r => (
                      <div key={r.label} className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">{r.label}</span>
                        <span className={`text-xs font-semibold ${r.pos ? 'text-green-600' : 'text-red-500'}`}>{r.pos ? '' : '−'}{formatBRL(r.value)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-slate-100 pt-2 mt-1">
                      <span className="text-xs font-bold text-slate-700">Resultado Líquido</span>
                      <span className={`text-sm font-bold ${metrics.lucro >= 0 ? 'text-green-600' : 'text-red-500'}`}>{metrics.lucro >= 0 ? '+' : ''}{formatBRL(metrics.lucro)}</span>
                    </div>
                    <div className="flex justify-between"><span className="text-xs text-slate-400">Total Aportes</span><span className="text-xs font-semibold text-purple-600">{formatBRL(base.totalAportes)}</span></div>
                    <div className="flex justify-between"><span className="text-xs text-slate-400">Carteira Bens</span><span className="text-xs font-semibold text-blue-600">{formatBRL(base.totalImoveis + base.totalBens)}</span></div>
                  </div>
                </Panel>
              </div>
            )}
          </div>
        )}

        {/* ════════ PROJETOS ════════ */}
        {activeTab === 'Projetos' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Total Aportes" value={formatShort(base.totalAportes)} sub="custo de implantação" icon={Target} color="purple" />
              <KpiCard label="Desp. Operacionais" value={formatShort(raw.despesas.reduce((s: number, d: any) => s + d.valor, 0))} sub="operação total" icon={TrendingDown} color="red" />
              <KpiCard label="Receitas Geradas" value={formatShort(raw.movimentacoes.filter((m: any) => m.tipo === 'entrada').reduce((s: number, m: any) => s + m.valor, 0))} sub="retornos acumulados" icon={TrendingUp} color="green" />
              <KpiCard label="Projetos Ativos" value={String(raw.projetos.filter((p: any) => p.status === 'ativo').length)} sub={`de ${raw.projetos.length} total`} icon={FolderOpen} color="blue" />
            </div>

            <Panel>
              <PanelTitle title="Evolução Financeira dos Projetos" sub="aportes, receitas, despesas e lucro — 12 meses" />
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={fluxoMensal} margin={{ top: 4, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<Tip />} />
                  <Legend formatter={(v) => ({ aportes: 'Aportes', receita: 'Receita', despesas: 'Desp. Op.', lucro: 'Lucro' }[v] || v)} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="aportes"  name="aportes"  fill={C.purple} fillOpacity={0.75} radius={[3,3,0,0]} barSize={10} />
                  <Bar dataKey="receita"  name="receita"  fill={C.green}  fillOpacity={0.8}  radius={[3,3,0,0]} barSize={10} />
                  <Bar dataKey="despesas" name="despesas" fill={C.red}    fillOpacity={0.7}  radius={[3,3,0,0]} barSize={10} />
                  <Line type="monotone" dataKey="lucro" name="lucro" stroke={C.blue} strokeWidth={2} dot={{ fill: C.blue, r: 2.5 }} />
                  <ReferenceLine y={0} stroke="#e2e8f0" strokeDasharray="4 2" />
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>

            {projetosPL.length > 0 && (
              <Panel>
                <PanelTitle title="Aportes × Despesas por Projeto" sub="investimento de implantação vs. despesas operacionais" />
                <ResponsiveContainer width="100%" height={Math.max(200, projetosPL.length * 52)}>
                  <BarChart data={projetosPL} layout="vertical" barSize={13} margin={{ top: 0, right: 90, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="nomeShort" tick={{ fontSize: 10, fill: '#64748b' }} width={135} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="aportes"  name="Aportes"    fill={C.purple} fillOpacity={0.85} radius={[0,3,3,0]} label={{ position: 'right', fontSize: 9, fill: C.purple, formatter: (v: number) => v > 0 ? formatShort(v) : '' }} />
                    <Bar dataKey="despesas" name="Desp. Op."  fill={C.red}    fillOpacity={0.75} radius={[0,3,3,0]} label={{ position: 'right', fontSize: 9, fill: C.red,    formatter: (v: number) => v > 0 ? formatShort(v) : '' }} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            )}

            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800">P&L por Projeto</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Aportes = implantação · Desp. Op. = operação · Lucro = Valor Total − Aportes</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 bg-slate-50">
                    {['Projeto', 'Status', 'Aportes', 'Desp. Op.', 'Valor Total', 'Lucro', 'ROI'].map(h => (
                      <th key={h} className={`py-3 px-4 text-xs font-medium text-slate-500 ${h === 'Projeto' ? 'text-left pl-5' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {projetosPL.length === 0 ? (
                      <tr><td colSpan={7} className="px-5 py-8 text-center text-xs text-slate-300">Nenhum projeto</td></tr>
                    ) : projetosPL.map((p: any, i: number) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-5 py-3 text-xs font-medium text-slate-900">{p.nome}</td>
                        <td className="px-4 py-3"><StatusBadge status={p.status || 'inativo'} /></td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-purple-700">{formatBRL(p.aportes)}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-red-500">{p.despesas > 0 ? formatBRL(p.despesas) : '—'}</td>
                        <td className="px-4 py-3 text-right text-xs text-slate-600">{p.valorTotal > 0 ? formatBRL(p.valorTotal) : '—'}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold">{p.lucro !== 0 ? <span className={p.lucro >= 0 ? 'text-green-600' : 'text-red-500'}>{p.lucro >= 0 ? '+' : ''}{formatBRL(p.lucro)}</span> : '—'}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold">{p.roi !== 0 ? <span className={p.roi >= 0 ? 'text-green-600' : 'text-red-500'}>{p.roi >= 0 ? '+' : ''}{p.roi.toFixed(1)}%</span> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  {projetosPL.length > 0 && (
                    <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td className="px-5 py-3 text-xs font-bold text-slate-700">Total</td><td />
                      <td className="px-4 py-3 text-right text-xs font-bold text-purple-700">{formatBRL(projetosPL.reduce((s: number, p: any) => s + p.aportes, 0))}</td>
                      <td className="px-4 py-3 text-right text-xs font-bold text-red-500">{formatBRL(projetosPL.reduce((s: number, p: any) => s + p.despesas, 0))}</td>
                      <td className="px-4 py-3 text-right text-xs font-bold text-slate-700">{formatBRL(projetosPL.reduce((s: number, p: any) => s + p.valorTotal, 0))}</td>
                      <td className="px-4 py-3 text-right text-xs font-bold"><span className={projetosPL.reduce((s: number, p: any) => s + p.lucro, 0) >= 0 ? 'text-green-600' : 'text-red-500'}>{formatBRL(projetosPL.reduce((s: number, p: any) => s + p.lucro, 0))}</span></td>
                      <td />
                    </tr></tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════ PATRIMÔNIO ════════ */}
        {activeTab === 'Patrimônio' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Carteira Imóveis" value={formatShort(base.totalImoveis)} sub={`${base.imAtivos.length} ativos`} icon={Building2} color="blue" trend={base.totalImoveis > base.totalImAq ? 'up' : 'down'} delta={formatShort(base.totalImoveis - base.totalImAq)} />
              <KpiCard label="Bens Móveis" value={formatShort(base.totalBens)} sub={`${raw.bensMoveis.length} bens`} icon={PiggyBank} color="cyan" />
              <KpiCard label="Renda Aluguel/Mês" value={formatShort(base.aluguelMes)} sub={`${raw.alugueis.length} contratos`} icon={DollarSign} color="green" />
              <KpiCard label="ROI Médio" value={(() => {
                const c = base.imAtivos.filter((p: any) => p.valor_aquisicao && p.valor_atual)
                if (!c.length) return '—'
                return `${(c.reduce((s: number, p: any) => s + ((p.valor_atual - p.valor_aquisicao) / p.valor_aquisicao * 100), 0) / c.length).toFixed(1)}%`
              })()} sub="valorização imóveis" icon={Percent} color="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Panel>
                <PanelTitle title="Portfólio por Categoria" sub="distribuição dos ativos" />
                {portfolioData.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Sem dados</div>
                ) : (
                  <div className="flex items-center gap-3">
                    <ResponsiveContainer width="45%" height={190}>
                      <PieChart>
                        <Pie data={portfolioData} cx="50%" cy="50%" outerRadius={85} innerRadius={52} dataKey="value" paddingAngle={2}>
                          {portfolioData.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="none" />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [formatBRL(v), 'Valor']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <DonutLegend data={portfolioData} palette={PALETTE} />
                  </div>
                )}
              </Panel>

              <Panel>
                <PanelTitle title="Forma de Aquisição" sub="composição do capital nos imóveis" />
                {(() => {
                  const aq = [
                    { name: 'À Vista',     value: base.imAtivos.reduce((s: number, p: any) => s + (p.avista_valor || 0), 0) },
                    { name: 'Financiamento', value: base.imAtivos.reduce((s: number, p: any) => s + (p.financiamento_valor || 0), 0) },
                    { name: 'Consórcio',   value: base.imAtivos.reduce((s: number, p: any) => s + (p.consorcio_valor || 0), 0) },
                    { name: 'Sócio',       value: base.imAtivos.reduce((s: number, p: any) => s + (p.socio_aquisicao_valor || 0), 0) },
                  ].filter(x => x.value > 0)
                  const aqColors = [C.green, C.blue, C.amber, C.purple]
                  if (!aq.length) return <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Sem dados de aquisição</div>
                  return (
                    <div className="flex items-center gap-3">
                      <ResponsiveContainer width="45%" height={190}>
                        <PieChart>
                          <Pie data={aq} cx="50%" cy="50%" outerRadius={85} innerRadius={52} dataKey="value" paddingAngle={2}>
                            {aq.map((_: any, i: number) => <Cell key={i} fill={aqColors[i]} stroke="none" />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => [formatBRL(v), 'Valor']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <DonutLegend data={aq} palette={aqColors} />
                    </div>
                  )
                })()}
              </Panel>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-800">Ativos Imóveis</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 bg-slate-50">
                    {['Imóvel', 'Categoria', 'Aquisição', 'Valor Atual', 'Valorização', 'ROI', 'Status'].map(h => (
                      <th key={h} className={`py-3 px-4 text-xs font-medium text-slate-500 ${h === 'Imóvel' ? 'text-left pl-5' : 'text-right last:text-left'}`}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {base.imAtivos.length === 0 ? <tr><td colSpan={7} className="px-5 py-8 text-center text-xs text-slate-300">Nenhum imóvel</td></tr>
                    : base.imAtivos.map((p: any, i: number) => {
                      const val = (p.valor_atual || 0) - (p.valor_aquisicao || 0)
                      const roi = p.valor_aquisicao ? (val / p.valor_aquisicao * 100) : 0
                      return (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-5 py-3 text-xs font-medium text-slate-900">{p.nome}</td>
                          <td className="px-4 py-3 text-right text-xs text-slate-500">{p.categorias?.nome || '—'}</td>
                          <td className="px-4 py-3 text-right text-xs text-slate-600">{p.valor_aquisicao ? formatBRL(p.valor_aquisicao) : '—'}</td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-blue-700">{p.valor_atual ? formatBRL(p.valor_atual) : '—'}</td>
                          <td className="px-4 py-3 text-right text-xs font-semibold"><span className={val >= 0 ? 'text-green-600' : 'text-red-500'}>{val >= 0 ? '+' : ''}{formatBRL(val)}</span></td>
                          <td className="px-4 py-3 text-right text-xs font-semibold">{p.valor_aquisicao ? <span className={roi >= 0 ? 'text-green-600' : 'text-red-500'}>{roi >= 0 ? '+' : ''}{roi.toFixed(1)}%</span> : '—'}</td>
                          <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════ NEGÓCIOS ════════ */}
        {activeTab === 'Negócios' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Empresas" value={String(raw.empresas.length)} sub={`${raw.empresas.filter((e: any) => e.status === 'ativa').length} ativas`} icon={Briefcase} color="purple" />
              <KpiCard label="Capital Investido" value={formatShort(base.totalEmpI)} sub="total investido" icon={Target} color="blue" />
              <KpiCard label="Retorno Esperado" value={formatShort(base.totalEmpR)} sub="total estimado" icon={TrendingUp} color="green" />
              <KpiCard label="ROI Estimado" value={base.totalEmpI > 0 ? `${((base.totalEmpR - base.totalEmpI) / base.totalEmpI * 100).toFixed(1)}%` : '—'} sub="retorno vs. capital" icon={Percent} color={base.totalEmpR >= base.totalEmpI ? 'green' : 'amber'} trend={base.totalEmpR >= base.totalEmpI ? 'up' : 'down'} delta={base.totalEmpR >= base.totalEmpI ? 'Positivo' : 'Negativo'} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <Panel className="lg:col-span-2">
                <PanelTitle title="Distribuição por Fase" />
                {(() => {
                  const faseMap: Record<string, number> = {}
                  raw.empresas.forEach((e: any) => { const f = e.fase || 'outros'; faseMap[f] = (faseMap[f] || 0) + 1 })
                  const data = Object.entries(faseMap).map(([name, value]) => ({ name, value }))
                  if (!data.length) return <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Sem dados</div>
                  return (
                    <div className="flex items-center gap-3">
                      <ResponsiveContainer width="50%" height={180}>
                        <PieChart><Pie data={data} cx="50%" cy="50%" outerRadius={82} innerRadius={50} dataKey="value" paddingAngle={2}>
                          {data.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="none" />)}
                        </Pie><Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} /></PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2">
                        {data.map((d, i) => (
                          <div key={d.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="text-[11px] text-slate-600 capitalize">{d.name.replace(/_/g, ' ')}</span></div>
                            <span className="text-[11px] font-semibold text-slate-800">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </Panel>

              <Panel className="lg:col-span-3">
                <PanelTitle title="Investimento × Retorno por Empresa" />
                {raw.empresas.length === 0 ? <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Nenhuma empresa</div> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={raw.empresas.slice(0, 8).map((e: any) => ({ nome: e.nome.length > 15 ? e.nome.slice(0, 15) + '…' : e.nome, investimento: e.valor_investimento || 0, retorno: e.valor_retorno || 0 }))} layout="vertical" barSize={12} margin={{ top: 0, right: 80, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: '#64748b' }} width={110} axisLine={false} tickLine={false} />
                      <Tooltip content={<Tip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="investimento" name="Investimento" fill={C.blue}  fillOpacity={0.85} radius={[0,3,3,0]} label={{ position: 'right', fontSize: 9, fill: C.blue, formatter: (v: number) => v > 0 ? formatShort(v) : '' }} />
                      <Bar dataKey="retorno"      name="Retorno"      fill={C.green} fillOpacity={0.8}  radius={[0,3,3,0]} label={{ position: 'right', fontSize: 9, fill: C.green, formatter: (v: number) => v > 0 ? formatShort(v) : '' }} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Panel>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-800">Portfólio de Negócios</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 bg-slate-50">
                    {['Empresa', 'Setor', 'Fase', 'Status', 'Investimento', 'Retorno', 'ROI'].map(h => (
                      <th key={h} className={`py-3 px-4 text-xs font-medium text-slate-500 ${h === 'Empresa' ? 'text-left pl-5' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {raw.empresas.length === 0 ? <tr><td colSpan={7} className="px-5 py-8 text-center text-xs text-slate-300">Nenhuma empresa</td></tr>
                    : raw.empresas.map((e: any, i: number) => {
                      const roi = e.valor_investimento && e.valor_retorno ? ((e.valor_retorno - e.valor_investimento) / e.valor_investimento * 100) : null
                      return (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-5 py-3 text-xs font-medium text-slate-900">{e.nome}</td>
                          <td className="px-4 py-3 text-right text-xs text-slate-500">{e.setor || '—'}</td>
                          <td className="px-4 py-3 text-right"><StatusBadge status={e.fase || 'outros'} /></td>
                          <td className="px-4 py-3 text-right"><StatusBadge status={e.status || 'inativa'} /></td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-blue-700">{e.valor_investimento ? formatBRL(e.valor_investimento) : '—'}</td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-green-600">{e.valor_retorno ? formatBRL(e.valor_retorno) : '—'}</td>
                          <td className="px-4 py-3 text-right text-xs font-semibold">{roi !== null ? <span className={roi >= 0 ? 'text-green-600' : 'text-red-500'}>{roi >= 0 ? '+' : ''}{roi.toFixed(1)}%</span> : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
