'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Wallet, TrendingUp, TrendingDown, Percent, Wrench, FolderOpen,
  Building2, DollarSign, Activity, Target, ArrowUpRight, ArrowDownRight,
  Briefcase, PiggyBank, BarChart2, ChevronRight, AlertCircle,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area, ComposedChart,
  Line, ReferenceLine,
} from 'recharts'
import { Topbar } from '@/components/layout/topbar'
import { formatBRL, formatShort, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const C = {
  blue:   '#3b82f6',
  green:  '#22c55e',
  red:    '#ef4444',
  amber:  '#f59e0b',
  purple: '#8b5cf6',
  cyan:   '#06b6d4',
  pink:   '#ec4899',
  lime:   '#84cc16',
  slate:  '#64748b',
  teal:   '#14b8a6',
}

const PALETTE = [C.blue, C.green, C.amber, C.purple, C.cyan, C.pink, C.lime, C.teal]

const PERIODS = [
  { label: 'Mês', days: 30 },
  { label: 'Trimestre', days: 90 },
  { label: 'Ano', days: 365 },
  { label: 'Tudo', days: 0 },
]

const TABS = ['Consolidado', 'Projetos', 'Patrimônio', 'Negócios']

// ── Shared components ──────────────────────────────────────────────────────────

function KpiCard({
  label, value, subtitle, icon: Icon, color = 'blue', trend, delta, onClick,
}: {
  label: string; value: string; subtitle?: string; icon: any
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'cyan' | 'slate'
  trend?: 'up' | 'down' | 'neutral'; delta?: string; onClick?: () => void
}) {
  const cfg = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   ring: 'ring-blue-100' },
    green:  { bg: 'bg-green-50',  icon: 'text-green-600',  ring: 'ring-green-100' },
    red:    { bg: 'bg-red-50',    icon: 'text-red-600',    ring: 'ring-red-100' },
    amber:  { bg: 'bg-amber-50',  icon: 'text-amber-600',  ring: 'ring-amber-100' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', ring: 'ring-purple-100' },
    cyan:   { bg: 'bg-cyan-50',   icon: 'text-cyan-600',   ring: 'ring-cyan-100' },
    slate:  { bg: 'bg-slate-50',  icon: 'text-slate-600',  ring: 'ring-slate-100' },
  }[color]

  return (
    <div
      className={`bg-white rounded-2xl border border-black/[0.07] p-5 flex flex-col gap-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)] ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl ${cfg.bg} ring-1 ${cfg.ring} flex items-center justify-center`}>
          <Icon className={`h-[18px] w-[18px] ${cfg.icon}`} />
        </div>
        {trend && delta && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400'
          }`}>
            {trend === 'up' ? <ArrowUpRight className="h-3.5 w-3.5" /> : trend === 'down' ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
            {delta}
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 tracking-tight leading-none mb-1">{value}</p>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        {subtitle && <p className="text-[11px] text-gray-300 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-black/[0.07] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] ${className}`}>
      {children}
    </div>
  )
}

function CardTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-800">{children}</h3>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-500 truncate flex-1">{p.name}:</span>
          <span className="font-semibold text-gray-800">{typeof p.value === 'number' ? formatBRL(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ativo: 'bg-green-50 text-green-700 border-green-200',
    ativa: 'bg-green-50 text-green-700 border-green-200',
    em_execucao: 'bg-blue-50 text-blue-700 border-blue-200',
    concluido: 'bg-teal-50 text-teal-700 border-teal-200',
    pausado: 'bg-amber-50 text-amber-700 border-amber-200',
    cancelado: 'bg-red-50 text-red-700 border-red-200',
    inativo: 'bg-gray-50 text-gray-500 border-gray-200',
    captacao: 'bg-purple-50 text-purple-700 border-purple-200',
    analise: 'bg-amber-50 text-amber-700 border-amber-200',
    vendido: 'bg-slate-50 text-slate-500 border-slate-200',
  }
  const cls = map[status] || 'bg-gray-50 text-gray-500 border-gray-200'
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Consolidado')
  const [period, setPeriod] = useState<typeof PERIODS[number]>(PERIODS[2])
  const [raw, setRaw] = useState<any>({
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
    const d = new Date()
    d.setDate(d.getDate() - period.days)
    return d.toISOString().split('T')[0]
  }, [period])

  // ── Core calculations ─────────────────────────────────────────────────────

  const calc = useMemo(() => {
    const { patrimonios, bensMoveis, movimentacoes, projetos, aportes, despesas, empresas, alugueis, manutencoes } = raw

    // Patrimônio imóveis
    const imoveisAtivos = patrimonios.filter((p: any) => p.status !== 'vendido' && p.status !== 'inativo')
    const totalImoveis   = imoveisAtivos.reduce((s: number, p: any) => s + (p.valor_atual || p.valor_aquisicao || 0), 0)
    const totalImoveisAq = imoveisAtivos.reduce((s: number, p: any) => s + (p.valor_aquisicao || 0), 0)
    const valorizacaoImoveis = totalImoveis - totalImoveisAq

    // Bens móveis
    const totalBensMoveis   = bensMoveis.reduce((s: number, b: any) => s + (b.valor_atual || b.valor_aquisicao || 0), 0)
    const totalBensMovAq    = bensMoveis.reduce((s: number, b: any) => s + (b.valor_aquisicao || 0), 0)

    // Projetos
    const projetosAtivos = projetos.filter((p: any) => p.status === 'ativo')
    const totalAportes   = aportes.reduce((s: number, a: any) => s + (a.valor || 0), 0)
    const totalProjetos  = projetos.reduce((s: number, p: any) => s + (p.valor_total || 0), 0)

    // Negócios
    const empAtivas = empresas.filter((e: any) => e.status === 'ativa' || e.status === 'em_execucao')
    const totalEmpInvest = empresas.reduce((s: number, e: any) => s + (e.valor_investimento || 0), 0)
    const totalEmpRetorno = empresas.reduce((s: number, e: any) => s + (e.valor_retorno || 0), 0)

    // Filtro por período
    const movFiltrado  = movimentacoes.filter((m: any) => m.data >= dateFrom)
    const despFiltrado = despesas.filter((d: any) => d.data >= dateFrom)
    const aportFiltrado = aportes.filter((a: any) => (a.data || '') >= dateFrom)

    const receitaP = movFiltrado.filter((m: any) => m.tipo === 'entrada').reduce((s: number, m: any) => s + m.valor, 0)
    const saidasP  = movFiltrado.filter((m: any) => m.tipo === 'saida').reduce((s: number, m: any) => s + m.valor, 0)
    const despesasP = despFiltrado.reduce((s: number, d: any) => s + d.valor, 0)
    const lucroP    = receitaP - saidasP - despesasP

    // Aluguel mensal total
    const aluguelMes = alugueis.reduce((s: number, a: any) => s + (a.valor_aluguel || 0), 0)

    // Carteira total consolidada
    const totalCarteira = totalImoveis + totalBensMoveis + totalEmpInvest

    // Forma aquisição imóveis
    const totalAvista = imoveisAtivos.reduce((s: number, p: any) => s + (p.avista_valor || 0), 0)
    const totalFinanc = imoveisAtivos.reduce((s: number, p: any) => s + (p.financiamento_valor || 0), 0)
    const totalConsor = imoveisAtivos.reduce((s: number, p: any) => s + (p.consorcio_valor || 0), 0)
    const totalSocioA = imoveisAtivos.reduce((s: number, p: any) => s + (p.socio_aquisicao_valor || 0), 0)

    // Manutenções vencidas
    const mantVencidas = manutencoes.filter((m: any) => m.proxima_manutencao && new Date(m.proxima_manutencao) < new Date()).length

    // ROI projetos
    const roiProjetos = totalAportes > 0 && totalProjetos > 0
      ? ((totalProjetos - totalAportes) / totalAportes * 100) : 0

    return {
      totalCarteira, totalImoveis, totalBensMoveis, totalEmpInvest, totalEmpRetorno,
      totalAportes, totalProjetos, imoveisAtivos, bensMoveis,
      valorizacaoImoveis, totalImoveisAq, totalBensMovAq, empAtivas,
      receitaP, saidasP, despesasP, lucroP, aluguelMes,
      totalAvista, totalFinanc, totalConsor, totalSocioA,
      mantVencidas, projetosAtivos, roiProjetos,
      movFiltrado, despFiltrado, aportFiltrado,
    }
  }, [raw, dateFrom])

  // ── Chart data ────────────────────────────────────────────────────────────

  const composicaoCarteira = useMemo(() => {
    const items = [
      { name: 'Imóveis', value: calc.totalImoveis },
      { name: 'Bens Móveis', value: calc.totalBensMoveis },
      { name: 'Projetos', value: calc.totalAportes },
      { name: 'Negócios', value: calc.totalEmpInvest },
    ].filter(x => x.value > 0)
    return items
  }, [calc])

  const fluxoMensal = useMemo(() => {
    const hoje = new Date()
    const meses = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - (11 - i), 1)
      return {
        key: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        ini: d.toISOString().split('T')[0],
        fim: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0],
      }
    })
    return meses.map(m => {
      const movM  = raw.movimentacoes.filter((x: any) => x.data >= m.ini && x.data <= m.fim)
      const despM = raw.despesas.filter((x: any) => x.data >= m.ini && x.data <= m.fim)
      const aportM = raw.aportes.filter((x: any) => (x.data || '') >= m.ini && (x.data || '') <= m.fim)
      const receita   = movM.filter((x: any) => x.tipo === 'entrada').reduce((s: number, x: any) => s + x.valor, 0)
      const saidas    = movM.filter((x: any) => x.tipo === 'saida').reduce((s: number, x: any) => s + x.valor, 0)
      const despesas  = despM.reduce((s: number, x: any) => s + x.valor, 0)
      const aportes   = aportM.reduce((s: number, x: any) => s + (x.valor || 0), 0)
      const lucro     = receita - saidas - despesas
      return { mes: m.key, receita, saidas, despesas, aportes, lucro }
    })
  }, [raw])

  const projetosPL = useMemo(() => {
    return raw.projetos.map((p: any) => {
      const aportes  = raw.aportes.filter((a: any) => a.projeto_id === p.id).reduce((s: number, a: any) => s + (a.valor || 0), 0)
      const despesas = raw.despesas.filter((d: any) => d.projeto_id === p.id).reduce((s: number, d: any) => s + d.valor, 0)
      const receitas = raw.movimentacoes.filter((m: any) => m.tipo === 'entrada').reduce((s: number, m: any) => s + m.valor, 0)
      const lucro    = (p.valor_total || 0) > 0 ? (p.valor_total || 0) - aportes : 0
      const roi      = aportes > 0 && (p.valor_total || 0) > 0 ? (((p.valor_total || 0) - aportes) / aportes * 100) : 0
      return { id: p.id, nome: p.nome, nomeShort: p.nome.length > 20 ? p.nome.slice(0, 20) + '…' : p.nome, status: p.status, aportes, despesas, receitas, valorTotal: p.valor_total || 0, lucro, roi }
    }).sort((a: any, b: any) => b.aportes - a.aportes)
  }, [raw])

  const categoriaData = useMemo(() => {
    const map: Record<string, number> = {}
    calc.imoveisAtivos.forEach((p: any) => {
      const cat = p.categorias?.nome || 'Sem categoria'
      map[cat] = (map[cat] || 0) + (p.valor_atual || p.valor_aquisicao || 0)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [calc.imoveisAtivos])

  const roiRanking = useMemo(() => {
    return calc.imoveisAtivos
      .filter((p: any) => p.valor_aquisicao && p.valor_atual)
      .map((p: any) => ({
        nome: p.nome.length > 22 ? p.nome.slice(0, 22) + '…' : p.nome,
        roi: ((p.valor_atual - p.valor_aquisicao) / p.valor_aquisicao * 100),
        valorizacao: p.valor_atual - p.valor_aquisicao,
        valorAtual: p.valor_atual,
      }))
      .sort((a: any, b: any) => b.roi - a.roi)
      .slice(0, 8)
  }, [calc.imoveisAtivos])

  const aquisicaoData = useMemo(() => {
    const items = [
      { name: 'À Vista', value: calc.totalAvista },
      { name: 'Financiamento', value: calc.totalFinanc },
      { name: 'Consórcio', value: calc.totalConsor },
      { name: 'Sócio', value: calc.totalSocioA },
    ].filter(x => x.value > 0)
    return items
  }, [calc])

  const empresasFase = useMemo(() => {
    const map: Record<string, number> = {}
    raw.empresas.forEach((e: any) => {
      const fase = e.fase || 'outros'
      map[fase] = (map[fase] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [raw.empresas])

  if (loading) {
    return (
      <>
        <Topbar title="Dashboard Executivo" subtitle="Visão consolidada do portfólio" />
        <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border border-black/[0.07] animate-pulse" />
          ))}
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar title="Dashboard Executivo" subtitle="Visão consolidada do portfólio" />

      <div className="p-6 space-y-5">

        {/* ── Top bar: tabs + period filter ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-white border border-black/[0.08] p-1 rounded-xl">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab ? 'bg-[#0f172a] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-white border border-black/[0.08] p-1 rounded-xl">
            {PERIODS.map(p => (
              <button
                key={p.label}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  period.label === p.label ? 'bg-[#0f172a] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ════════════════ CONSOLIDADO ════════════════ */}
        {activeTab === 'Consolidado' && (
          <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <KpiCard
                label="Total do Portfólio"
                value={formatShort(calc.totalCarteira)}
                subtitle={`${calc.imoveisAtivos.length + calc.bensMoveis.length} ativos`}
                icon={Wallet} color="blue"
                trend={calc.valorizacaoImoveis >= 0 ? 'up' : 'down'}
                delta={`${calc.valorizacaoImoveis >= 0 ? '+' : ''}${formatShort(calc.valorizacaoImoveis)}`}
              />
              <KpiCard
                label="Receita (Período)"
                value={formatShort(calc.receitaP)}
                subtitle="entradas filtradas"
                icon={TrendingUp} color="green"
                trend="up" delta={period.label}
              />
              <KpiCard
                label="Despesas (Período)"
                value={formatShort(calc.saidasP + calc.despesasP)}
                subtitle="saídas + operacionais"
                icon={TrendingDown} color="red"
              />
              <KpiCard
                label="Lucro (Período)"
                value={formatShort(Math.abs(calc.lucroP))}
                subtitle={calc.lucroP >= 0 ? 'resultado positivo' : 'resultado negativo'}
                icon={DollarSign}
                color={calc.lucroP >= 0 ? 'green' : 'red'}
                trend={calc.lucroP >= 0 ? 'up' : 'down'}
                delta={calc.lucroP >= 0 ? 'Lucro' : 'Prejuízo'}
              />
              <KpiCard
                label="Renda Aluguel/Mês"
                value={formatShort(calc.aluguelMes)}
                subtitle={`${raw.alugueis.length} contratos ativos`}
                icon={Building2} color="cyan"
              />
              <KpiCard
                label="Total Investido"
                value={formatShort(calc.totalAportes + calc.totalImoveisAq)}
                subtitle="aportes + aquisições"
                icon={Target} color="purple"
              />
            </div>

            {/* Charts: composição + fluxo */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Donut composição */}
              <Card className="lg:col-span-2">
                <CardTitle sub="distribuição por módulo">Composição do Portfólio</CardTitle>
                {composicaoCarteira.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Sem dados</div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={180}>
                      <PieChart>
                        <Pie data={composicaoCarteira} cx="50%" cy="50%" outerRadius={82} innerRadius={50} dataKey="value" paddingAngle={2}>
                          {composicaoCarteira.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="none" />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [formatBRL(v), 'Valor']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-3">
                      {composicaoCarteira.map((item, i) => {
                        const total = composicaoCarteira.reduce((s, x) => s + x.value, 0)
                        const pct = total > 0 ? (item.value / total * 100) : 0
                        return (
                          <div key={item.name}>
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                                <span className="text-[11px] text-gray-600">{item.name}</span>
                              </div>
                              <span className="text-[11px] font-semibold text-gray-800">{pct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }} />
                            </div>
                          </div>
                        )
                      })}
                      <p className="text-[10px] text-gray-300 pt-1">Total: {formatBRL(composicaoCarteira.reduce((s, x) => s + x.value, 0))}</p>
                    </div>
                  </div>
                )}
              </Card>

              {/* Area: fluxo 12 meses */}
              <Card className="lg:col-span-3">
                <CardTitle sub="receitas, despesas e lucro — últimos 12 meses">Fluxo Financeiro Consolidado</CardTitle>
                <ResponsiveContainer width="100%" height={188}>
                  <ComposedChart data={fluxoMensal} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} width={42} />
                    <Tooltip content={<Tip />} />
                    <Legend formatter={(v) => ({ receita: 'Receita', saidas: 'Saídas', despesas: 'Desp. Op.', lucro: 'Lucro' }[v] || v)} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="receita" name="receita" fill={C.green} fillOpacity={0.8} radius={[3,3,0,0]} barSize={8} />
                    <Bar dataKey="saidas" name="saidas" fill={C.red} fillOpacity={0.7} radius={[3,3,0,0]} barSize={8} />
                    <Bar dataKey="despesas" name="despesas" fill={C.amber} fillOpacity={0.7} radius={[3,3,0,0]} barSize={8} />
                    <Line type="monotone" dataKey="lucro" name="lucro" stroke={C.blue} strokeWidth={2} dot={{ fill: C.blue, r: 2.5 }} />
                    <ReferenceLine y={0} stroke="#e2e8f0" strokeDasharray="4 2" />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Bottom: projetos ativos + manutenções + P&L resumo */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Projetos ativos */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-purple-500" />
                    <h3 className="text-sm font-semibold text-gray-800">Projetos Ativos</h3>
                  </div>
                  <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{calc.projetosAtivos.length}</span>
                </div>
                <div className="space-y-3">
                  {calc.projetosAtivos.length === 0 ? (
                    <p className="text-xs text-gray-300 text-center py-6">Nenhum projeto ativo</p>
                  ) : calc.projetosAtivos.slice(0, 5).map((p: any) => {
                    const aportes = raw.aportes.filter((a: any) => a.projeto_id === p.id).reduce((s: number, a: any) => s + (a.valor || 0), 0)
                    const desp    = raw.despesas.filter((d: any) => d.projeto_id === p.id).reduce((s: number, d: any) => s + d.valor, 0)
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 pb-2.5 border-b border-gray-50 last:border-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{p.nome}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Aporte: {formatShort(aportes)} · Desp: {formatShort(desp)}</p>
                        </div>
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md flex-shrink-0 whitespace-nowrap">
                          {p.valor_total ? formatShort(p.valor_total) : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Card>

              {/* Manutenções */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-orange-500" />
                    <h3 className="text-sm font-semibold text-gray-800">Manutenções Pendentes</h3>
                  </div>
                  {calc.mantVencidas > 0 && (
                    <div className="flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      <AlertCircle className="h-3 w-3" />
                      {calc.mantVencidas} vencida{calc.mantVencidas > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {raw.manutencoes.length === 0 ? (
                    <p className="text-xs text-gray-300 text-center py-6">Nenhuma pendência</p>
                  ) : raw.manutencoes.slice(0, 5).map((m: any) => {
                    const vencida = m.proxima_manutencao && new Date(m.proxima_manutencao) < new Date()
                    return (
                      <div key={m.id} className="flex items-start justify-between gap-2 pb-2.5 border-b border-gray-50 last:border-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{m.descricao}</p>
                          <p className="text-[10px] text-gray-400 truncate">{m.patrimonios?.nome}</p>
                        </div>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                          vencida ? 'bg-red-50 text-red-600' :
                          m.status === 'em_andamento' ? 'bg-blue-50 text-blue-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {vencida ? 'Vencida' : m.status === 'em_andamento' ? 'Em andamento' : 'Pendente'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Card>

              {/* P&L Resumo */}
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-4 w-4 text-green-500" />
                  <h3 className="text-sm font-semibold text-gray-800">P&L Consolidado</h3>
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: 'Receitas (período)', value: calc.receitaP, positive: true },
                    { label: 'Saídas (período)',   value: calc.saidasP,  positive: false },
                    { label: 'Desp. Operacionais', value: calc.despesasP, positive: false },
                    { label: 'Renda Aluguel/Mês',  value: calc.aluguelMes, positive: true },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{row.label}</span>
                      <span className={`text-xs font-semibold ${row.positive ? 'text-green-600' : 'text-red-500'}`}>
                        {row.positive ? '' : '−'}{formatBRL(row.value)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-1">
                    <span className="text-xs font-bold text-gray-700">Resultado Líquido</span>
                    <span className={`text-sm font-bold ${calc.lucroP >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {calc.lucroP >= 0 ? '+' : ''}{formatBRL(calc.lucroP)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-gray-400">Total Aportes (investimentos)</span>
                    <span className="text-xs font-semibold text-purple-600">{formatBRL(calc.totalAportes)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Carteira Imóveis</span>
                    <span className="text-xs font-semibold text-blue-600">{formatBRL(calc.totalImoveis)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Bens Móveis</span>
                    <span className="text-xs font-semibold text-cyan-600">{formatBRL(calc.totalBensMoveis)}</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ════════════════ PROJETOS ════════════════ */}
        {activeTab === 'Projetos' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Total Investido (Aportes)"
                value={formatShort(calc.totalAportes)}
                subtitle="custo de implantação"
                icon={Target} color="purple"
              />
              <KpiCard
                label="Desp. Operacionais"
                value={formatShort(raw.despesas.reduce((s: number, d: any) => s + d.valor, 0))}
                subtitle="custo de operação total"
                icon={TrendingDown} color="red"
              />
              <KpiCard
                label="Receitas Geradas"
                value={formatShort(raw.movimentacoes.filter((m: any) => m.tipo === 'entrada').reduce((s: number, m: any) => s + m.valor, 0))}
                subtitle="retornos acumulados"
                icon={TrendingUp} color="green"
              />
              <KpiCard
                label="Projetos Ativos"
                value={String(calc.projetosAtivos.length)}
                subtitle={`de ${raw.projetos.length} cadastrados`}
                icon={FolderOpen} color="blue"
                trend={calc.roiProjetos >= 0 ? 'up' : 'down'}
                delta={`ROI ${calc.roiProjetos.toFixed(1)}%`}
              />
            </div>

            {/* Fluxo mensal projetos */}
            <Card>
              <CardTitle sub="receitas, despesas operacionais e aportes mensais">Evolução Financeira dos Projetos</CardTitle>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={fluxoMensal} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<Tip />} />
                  <Legend formatter={(v) => ({ receita: 'Receita', despesas: 'Desp. Op.', aportes: 'Aportes', lucro: 'Lucro' }[v] || v)} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="aportes" name="aportes" fill={C.purple} fillOpacity={0.75} radius={[3,3,0,0]} barSize={10} />
                  <Bar dataKey="receita" name="receita" fill={C.green}  fillOpacity={0.8}  radius={[3,3,0,0]} barSize={10} />
                  <Bar dataKey="despesas" name="despesas" fill={C.red}   fillOpacity={0.7}  radius={[3,3,0,0]} barSize={10} />
                  <Line type="monotone" dataKey="lucro" name="lucro" stroke={C.blue} strokeWidth={2} dot={{ fill: C.blue, r: 2.5 }} />
                  <ReferenceLine y={0} stroke="#e2e8f0" strokeDasharray="4 2" />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>

            {/* Horizontal bar: aportes vs despesas */}
            {projetosPL.length > 0 && (
              <Card>
                <CardTitle sub="investimento de implantação vs. despesas operacionais">Aportes × Despesas por Projeto</CardTitle>
                <ResponsiveContainer width="100%" height={Math.max(200, projetosPL.length * 52)}>
                  <BarChart data={projetosPL} layout="vertical" barSize={13} margin={{ top: 0, right: 90, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="nomeShort" tick={{ fontSize: 10, fill: '#64748b' }} width={130} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="aportes"  name="Aportes"    fill={C.purple} fillOpacity={0.85} radius={[0,3,3,0]} label={{ position: 'right', fontSize: 9, fill: C.purple, formatter: (v: number) => v > 0 ? formatShort(v) : '' }} />
                    <Bar dataKey="despesas" name="Desp. Op."  fill={C.red}    fillOpacity={0.75} radius={[0,3,3,0]} label={{ position: 'right', fontSize: 9, fill: C.red,    formatter: (v: number) => v > 0 ? formatShort(v) : '' }} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Tabela P&L */}
            <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">P&L por Projeto</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Aportes = implantação · Desp. Op. = operação · Lucro = Valor Total − Aportes</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      {['Projeto', 'Status', 'Aportes', 'Desp. Op.', 'Valor Total', 'Lucro Teórico', 'ROI'].map(h => (
                        <th key={h} className={`py-3 px-4 text-xs font-medium text-gray-500 ${h === 'Projeto' ? 'text-left pl-5' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projetosPL.length === 0 ? (
                      <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-300">Nenhum projeto cadastrado</td></tr>
                    ) : projetosPL.map((p: any, i: number) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-5 py-3 font-medium text-gray-900 text-xs">{p.nome}</td>
                        <td className="px-4 py-3"><StatusBadge status={p.status || 'inativo'} /></td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-purple-700">{formatBRL(p.aportes)}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-red-500">{p.despesas > 0 ? formatBRL(p.despesas) : '—'}</td>
                        <td className="px-4 py-3 text-right text-xs text-gray-600">{p.valorTotal > 0 ? formatBRL(p.valorTotal) : '—'}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold">
                          {p.lucro !== 0 ? <span className={p.lucro >= 0 ? 'text-green-600' : 'text-red-500'}>{p.lucro >= 0 ? '+' : ''}{formatBRL(p.lucro)}</span> : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold">
                          {p.roi !== 0 ? <span className={p.roi >= 0 ? 'text-green-600' : 'text-red-500'}>{p.roi >= 0 ? '+' : ''}{p.roi.toFixed(1)}%</span> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {projetosPL.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td className="px-5 py-3 text-xs font-bold text-gray-700">Total</td>
                        <td />
                        <td className="px-4 py-3 text-right text-xs font-bold text-purple-700">{formatBRL(projetosPL.reduce((s: number, p: any) => s + p.aportes, 0))}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-red-500">{formatBRL(projetosPL.reduce((s: number, p: any) => s + p.despesas, 0))}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-gray-700">{formatBRL(projetosPL.reduce((s: number, p: any) => s + p.valorTotal, 0))}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold">
                          <span className={projetosPL.reduce((s: number, p: any) => s + p.lucro, 0) >= 0 ? 'text-green-600' : 'text-red-500'}>
                            {projetosPL.reduce((s: number, p: any) => s + p.lucro, 0) >= 0 ? '+' : ''}{formatBRL(projetosPL.reduce((s: number, p: any) => s + p.lucro, 0))}
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

        {/* ════════════════ PATRIMÔNIO ════════════════ */}
        {activeTab === 'Patrimônio' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Carteira de Imóveis"
                value={formatShort(calc.totalImoveis)}
                subtitle={`${calc.imoveisAtivos.length} ativos`}
                icon={Building2} color="blue"
                trend={calc.valorizacaoImoveis >= 0 ? 'up' : 'down'}
                delta={`${calc.valorizacaoImoveis >= 0 ? '+' : ''}${formatShort(calc.valorizacaoImoveis)}`}
              />
              <KpiCard
                label="Bens Móveis"
                value={formatShort(calc.totalBensMoveis)}
                subtitle={`${calc.bensMoveis.length} bens`}
                icon={PiggyBank} color="cyan"
              />
              <KpiCard
                label="Renda Aluguel/Mês"
                value={formatShort(calc.aluguelMes)}
                subtitle={`${raw.alugueis.length} contratos ativos`}
                icon={DollarSign} color="green"
              />
              <KpiCard
                label="ROI Médio (Imóveis)"
                value={(() => {
                  const c = calc.imoveisAtivos.filter((p: any) => p.valor_aquisicao && p.valor_atual)
                  if (!c.length) return '—%'
                  const roi = c.reduce((s: number, p: any) => s + ((p.valor_atual - p.valor_aquisicao) / p.valor_aquisicao * 100), 0) / c.length
                  return `${roi.toFixed(1)}%`
                })()}
                subtitle="valorização vs. compra"
                icon={Percent} color="amber"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Categorias */}
              <Card>
                <CardTitle sub="distribuição por categoria">Portfólio por Categoria</CardTitle>
                {categoriaData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Sem dados</div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="45%" height={180}>
                      <PieChart>
                        <Pie data={categoriaData} cx="50%" cy="50%" outerRadius={82} innerRadius={50} dataKey="value" paddingAngle={2}>
                          {categoriaData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="none" />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [formatBRL(v), 'Valor']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2.5">
                      {categoriaData.slice(0, 5).map((cat, i) => {
                        const total = categoriaData.reduce((s, c) => s + c.value, 0)
                        const pct = total > 0 ? (cat.value / total * 100) : 0
                        return (
                          <div key={cat.name}>
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                                <span className="text-[11px] text-gray-600 truncate max-w-[90px]">{cat.name}</span>
                              </div>
                              <span className="text-[11px] font-semibold text-gray-800">{pct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </Card>

              {/* Forma de aquisição */}
              <Card>
                <CardTitle sub="como os imóveis foram adquiridos">Forma de Aquisição</CardTitle>
                {aquisicaoData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Sem dados de aquisição</div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="45%" height={180}>
                      <PieChart>
                        <Pie data={aquisicaoData} cx="50%" cy="50%" outerRadius={82} innerRadius={50} dataKey="value" paddingAngle={2}>
                          {aquisicaoData.map((_, i) => <Cell key={i} fill={[C.green, C.blue, C.amber, C.purple][i % 4]} stroke="none" />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [formatBRL(v), 'Valor']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-3">
                      {aquisicaoData.map((item, i) => {
                        const total = aquisicaoData.reduce((s, x) => s + x.value, 0)
                        const pct = total > 0 ? (item.value / total * 100) : 0
                        const clr = [C.green, C.blue, C.amber, C.purple][i % 4]
                        return (
                          <div key={item.name}>
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: clr }} />
                                <span className="text-[11px] text-gray-600">{item.name}</span>
                              </div>
                              <span className="text-[11px] font-semibold text-gray-800">{pct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: clr }} />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">{formatBRL(item.value)}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* ROI Ranking */}
            {roiRanking.length > 0 && (
              <Card>
                <CardTitle sub="imóveis por valorização">Ranking de Valorização</CardTitle>
                <ResponsiveContainer width="100%" height={Math.max(200, roiRanking.length * 44)}>
                  <BarChart data={roiRanking} layout="vertical" barSize={16} margin={{ top: 0, right: 80, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${v.toFixed(0)}%`} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: '#64748b' }} width={140} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number, name: string) => [name === 'roi' ? `${v.toFixed(1)}%` : formatBRL(v), name === 'roi' ? 'ROI' : 'Valorização']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <ReferenceLine x={0} stroke="#e2e8f0" />
                    <Bar dataKey="roi" name="roi" radius={[0,3,3,0]}
                      label={{ position: 'right', fontSize: 9, formatter: (v: number) => `${v.toFixed(1)}%` }}
                    >
                      {roiRanking.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.roi >= 0 ? C.green : C.red} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Tabela imóveis */}
            <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Ativos Imóveis</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      {['Imóvel', 'Categoria', 'Aquisição', 'Valor Atual', 'Valorização', 'ROI', 'Status'].map(h => (
                        <th key={h} className={`py-3 px-4 text-xs font-medium text-gray-500 ${h === 'Imóvel' ? 'text-left pl-5' : 'text-right last:text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calc.imoveisAtivos.length === 0 ? (
                      <tr><td colSpan={7} className="px-5 py-8 text-center text-xs text-gray-300">Nenhum imóvel cadastrado</td></tr>
                    ) : calc.imoveisAtivos.map((p: any, i: number) => {
                      const valoriz = (p.valor_atual || 0) - (p.valor_aquisicao || 0)
                      const roi = p.valor_aquisicao ? (valoriz / p.valor_aquisicao * 100) : 0
                      return (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-5 py-3 text-xs font-medium text-gray-900">{p.nome}</td>
                          <td className="px-4 py-3 text-right text-xs text-gray-500">{p.categorias?.nome || '—'}</td>
                          <td className="px-4 py-3 text-right text-xs text-gray-600">{p.valor_aquisicao ? formatBRL(p.valor_aquisicao) : '—'}</td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-blue-700">{p.valor_atual ? formatBRL(p.valor_atual) : '—'}</td>
                          <td className="px-4 py-3 text-right text-xs font-semibold">
                            <span className={valoriz >= 0 ? 'text-green-600' : 'text-red-500'}>
                              {valoriz >= 0 ? '+' : ''}{formatBRL(valoriz)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-semibold">
                            {p.valor_aquisicao ? (
                              <span className={roi >= 0 ? 'text-green-600' : 'text-red-500'}>{roi >= 0 ? '+' : ''}{roi.toFixed(1)}%</span>
                            ) : '—'}
                          </td>
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

        {/* ════════════════ NEGÓCIOS ════════════════ */}
        {activeTab === 'Negócios' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Empresas no Portfólio"
                value={String(raw.empresas.length)}
                subtitle={`${calc.empAtivas.length} ativas / em execução`}
                icon={Briefcase} color="purple"
              />
              <KpiCard
                label="Capital Investido"
                value={formatShort(calc.totalEmpInvest)}
                subtitle="valor total de investimentos"
                icon={Target} color="blue"
              />
              <KpiCard
                label="Retorno Esperado"
                value={formatShort(calc.totalEmpRetorno)}
                subtitle="valor de retorno estimado"
                icon={TrendingUp} color="green"
              />
              <KpiCard
                label="ROI Estimado"
                value={calc.totalEmpInvest > 0
                  ? `${((calc.totalEmpRetorno - calc.totalEmpInvest) / calc.totalEmpInvest * 100).toFixed(1)}%`
                  : '—'}
                subtitle="retorno vs. investimento"
                icon={Percent}
                color={calc.totalEmpRetorno >= calc.totalEmpInvest ? 'green' : 'amber'}
                trend={calc.totalEmpRetorno >= calc.totalEmpInvest ? 'up' : 'down'}
                delta={calc.totalEmpRetorno >= calc.totalEmpInvest ? 'Positivo' : 'Negativo'}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Donut fases */}
              <Card className="lg:col-span-2">
                <CardTitle sub="por fase / status">Distribuição por Fase</CardTitle>
                {empresasFase.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Nenhuma empresa</div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={180}>
                      <PieChart>
                        <Pie data={empresasFase} cx="50%" cy="50%" outerRadius={82} innerRadius={50} dataKey="value" paddingAngle={2}>
                          {empresasFase.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="none" />)}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2.5">
                      {empresasFase.map((item, i) => (
                        <div key={item.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                            <span className="text-[11px] text-gray-600 capitalize">{item.name.replace(/_/g, ' ')}</span>
                          </div>
                          <span className="text-[11px] font-semibold text-gray-800">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              {/* Bar: investimento vs retorno por empresa */}
              <Card className="lg:col-span-3">
                <CardTitle sub="investimento vs. retorno esperado por empresa">Capital por Empresa</CardTitle>
                {raw.empresas.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Nenhuma empresa</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={raw.empresas.slice(0, 8).map((e: any) => ({
                        nome: e.nome.length > 16 ? e.nome.slice(0, 16) + '…' : e.nome,
                        investimento: e.valor_investimento || 0,
                        retorno: e.valor_retorno || 0,
                      }))}
                      layout="vertical" barSize={12} margin={{ top: 0, right: 80, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: '#64748b' }} width={110} axisLine={false} tickLine={false} />
                      <Tooltip content={<Tip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="investimento" name="Investimento" fill={C.blue}  fillOpacity={0.85} radius={[0,3,3,0]} label={{ position: 'right', fontSize: 9, fill: C.blue,  formatter: (v: number) => v > 0 ? formatShort(v) : '' }} />
                      <Bar dataKey="retorno"      name="Retorno"      fill={C.green} fillOpacity={0.8}  radius={[0,3,3,0]} label={{ position: 'right', fontSize: 9, fill: C.green, formatter: (v: number) => v > 0 ? formatShort(v) : '' }} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>

            {/* Tabela empresas */}
            <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Portfólio de Negócios</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      {['Empresa', 'Setor', 'Fase', 'Status', 'Investimento', 'Retorno Esperado', 'ROI Est.'].map(h => (
                        <th key={h} className={`py-3 px-4 text-xs font-medium text-gray-500 ${h === 'Empresa' ? 'text-left pl-5' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {raw.empresas.length === 0 ? (
                      <tr><td colSpan={7} className="px-5 py-8 text-center text-xs text-gray-300">Nenhuma empresa cadastrada</td></tr>
                    ) : raw.empresas.map((e: any, i: number) => {
                      const roi = e.valor_investimento && e.valor_retorno
                        ? ((e.valor_retorno - e.valor_investimento) / e.valor_investimento * 100) : null
                      return (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-5 py-3 text-xs font-medium text-gray-900">{e.nome}</td>
                          <td className="px-4 py-3 text-right text-xs text-gray-500">{e.setor || '—'}</td>
                          <td className="px-4 py-3 text-right"><StatusBadge status={e.fase || 'outros'} /></td>
                          <td className="px-4 py-3 text-right"><StatusBadge status={e.status || 'inativa'} /></td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-blue-700">{e.valor_investimento ? formatBRL(e.valor_investimento) : '—'}</td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-green-600">{e.valor_retorno ? formatBRL(e.valor_retorno) : '—'}</td>
                          <td className="px-4 py-3 text-right text-xs font-semibold">
                            {roi !== null ? (
                              <span className={roi >= 0 ? 'text-green-600' : 'text-red-500'}>{roi >= 0 ? '+' : ''}{roi.toFixed(1)}%</span>
                            ) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {raw.empresas.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td colSpan={4} className="px-5 py-3 text-xs font-bold text-gray-700">Total</td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-blue-700">{formatBRL(calc.totalEmpInvest)}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-green-600">{formatBRL(calc.totalEmpRetorno)}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold">
                          {calc.totalEmpInvest > 0 ? (
                            <span className={calc.totalEmpRetorno >= calc.totalEmpInvest ? 'text-green-600' : 'text-red-500'}>
                              {((calc.totalEmpRetorno - calc.totalEmpInvest) / calc.totalEmpInvest * 100).toFixed(1)}%
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    </tfoot>
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
