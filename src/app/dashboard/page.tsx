'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Wallet, TrendingUp, TrendingDown, Percent, AlertTriangle,
  Wrench, FolderOpen, ChevronDown, Building2, BarChart2,
  DollarSign, Activity, Target, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area, ComposedChart,
  Line,
} from 'recharts'
import { Topbar } from '@/components/layout/topbar'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatBRL, formatShort, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']
const TABS = ['Visão Geral', 'Projetos P&L', 'Patrimônio', 'ROI']

function KpiCard({
  label, value, subtitle, icon: Icon, color = 'blue', trend, delta,
}: {
  label: string; value: string; subtitle?: string; icon: any
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'gray'
  trend?: 'up' | 'down' | 'neutral'; delta?: string
}) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   ring: 'ring-blue-100' },
    green:  { bg: 'bg-green-50',  icon: 'text-green-600',  ring: 'ring-green-100' },
    red:    { bg: 'bg-red-50',    icon: 'text-red-600',    ring: 'ring-red-100' },
    amber:  { bg: 'bg-amber-50',  icon: 'text-amber-600',  ring: 'ring-amber-100' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', ring: 'ring-purple-100' },
    gray:   { bg: 'bg-gray-50',   icon: 'text-gray-600',   ring: 'ring-gray-100' },
  }[color]

  return (
    <div className="bg-white rounded-2xl border border-black/[0.07] p-5 flex flex-col gap-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl ${colors.bg} ring-1 ${colors.ring} flex items-center justify-center`}>
          <Icon className={`h-4.5 w-4.5 ${colors.icon}`} size={18} />
        </div>
        {trend && delta && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400'}`}>
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-gray-700">{children}</h3>
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-800">{formatBRL(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Visão Geral')
  const [rawData, setRawData] = useState<any>({
    patrimonios: [], movimentacoes: [], manutencoes: [],
    projetos: [], categorias: [], aportes: [], despesas: [], fluxoMensal: [],
  })

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const [patriRes, movRes, manRes, projRes, catRes, aportRes] = await Promise.all([
        supabase.from('patrimonios').select('*, categorias(nome)'),
        supabase.from('movimentacoes').select('*').order('data', { ascending: false }),
        supabase.from('manutencoes').select('*, patrimonios(nome)').neq('status', 'concluida').order('created_at', { ascending: false }).limit(6),
        supabase.from('projetos').select('*').order('nome'),
        supabase.from('categorias').select('*').order('nome'),
        supabase.from('aportes').select('*, projetos(nome)').order('data', { ascending: false }),
      ])

      // Tenta buscar despesas_operacionais (pode não existir ainda)
      const despRes = await (supabase as any).from('despesas_operacionais').select('*, projetos(nome)').order('data', { ascending: false })
      const despesas = despRes.error ? [] : (despRes.data || [])

      // Fluxo dos últimos 6 meses
      const hoje = new Date()
      const meses = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1)
        return {
          mes: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          inicio: d.toISOString().split('T')[0],
          fim: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0],
        }
      })

      const allMov = movRes.data || []
      const fluxoMensal = meses.map(m => {
        const mes_mov = allMov.filter((x: any) => x.data >= m.inicio && x.data <= m.fim)
        const mes_desp = despesas.filter((x: any) => x.data >= m.inicio && x.data <= m.fim)
        return {
          mes: m.mes,
          receita: mes_mov.filter((x: any) => x.tipo === 'entrada').reduce((s: number, x: any) => s + x.valor, 0),
          saidas: mes_mov.filter((x: any) => x.tipo === 'saida').reduce((s: number, x: any) => s + x.valor, 0),
          despesas_op: mes_desp.reduce((s: number, x: any) => s + x.valor, 0),
        }
      })

      setRawData({
        patrimonios: patriRes.data || [],
        movimentacoes: allMov,
        manutencoes: manRes.data || [],
        projetos: projRes.data || [],
        categorias: catRes.data || [],
        aportes: aportRes.data || [],
        despesas,
        fluxoMensal,
      })
      setLoading(false)
    }
    fetchData()
  }, [])

  // ── Derived metrics ────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const ativos = rawData.patrimonios.filter((p: any) => p.status !== 'vendido' && p.status !== 'inativo')
    const totalCarteira = ativos.reduce((s: number, p: any) => s + (p.valor_atual || p.valor_aquisicao || 0), 0)
    const totalAquisicao = ativos.reduce((s: number, p: any) => s + (p.valor_aquisicao || 0), 0)
    const valorizacao = totalCarteira - totalAquisicao

    const totalAportes = rawData.aportes.reduce((s: number, a: any) => s + (a.valor || 0), 0)

    const now = new Date()
    const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const movMes = rawData.movimentacoes.filter((m: any) => m.data >= mesInicio)
    const receitaMes = movMes.filter((m: any) => m.tipo === 'entrada').reduce((s: number, m: any) => s + m.valor, 0)
    const saidasMes  = movMes.filter((m: any) => m.tipo === 'saida').reduce((s: number, m: any) => s + m.valor, 0)
    const despesasMes = rawData.despesas.filter((d: any) => d.data >= mesInicio).reduce((s: number, d: any) => s + d.valor, 0)
    const lucroMes = receitaMes - saidasMes - despesasMes

    const totalDespesas = rawData.despesas.reduce((s: number, d: any) => s + d.valor, 0)
    const totalReceitas = rawData.movimentacoes.filter((m: any) => m.tipo === 'entrada').reduce((s: number, m: any) => s + m.valor, 0)
    const lucroTotal = totalReceitas - totalDespesas

    const roiMedio = (() => {
      const c = ativos.filter((p: any) => p.valor_aquisicao && p.valor_atual)
      if (!c.length) return 0
      return c.reduce((s: number, p: any) => s + ((p.valor_atual - p.valor_aquisicao) / p.valor_aquisicao * 100), 0) / c.length
    })()

    const ativosRisco = rawData.manutencoes.filter((m: any) => m.proxima_manutencao && new Date(m.proxima_manutencao) < new Date()).length

    return { totalCarteira, totalAquisicao, valorizacao, totalAportes, receitaMes, saidasMes, despesasMes, lucroMes, totalDespesas, totalReceitas, lucroTotal, roiMedio, ativosRisco, ativos }
  }, [rawData])

  const categoriaData = useMemo(() => {
    const map: Record<string, number> = {}
    metrics.ativos.forEach((p: any) => {
      const cat = p.categorias?.nome || 'Sem categoria'
      map[cat] = (map[cat] || 0) + (p.valor_atual || p.valor_aquisicao || 0)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [metrics.ativos])

  const projetosPL = useMemo(() => {
    return rawData.projetos.map((p: any) => {
      const aportes = rawData.aportes.filter((a: any) => a.projeto_id === p.id).reduce((s: number, a: any) => s + (a.valor || 0), 0)
      const despesas = rawData.despesas.filter((d: any) => d.projeto_id === p.id).reduce((s: number, d: any) => s + d.valor, 0)
      const valorTotal = p.valor_total || 0
      const lucroTeorico = valorTotal > 0 ? valorTotal - aportes : 0
      return {
        nome: p.nome.length > 18 ? p.nome.slice(0, 18) + '…' : p.nome,
        nomeCompleto: p.nome,
        aportes,
        despesas_op: despesas,
        valor_total: valorTotal,
        lucro: lucroTeorico,
        status: p.status,
        roi: aportes > 0 && valorTotal > 0 ? ((valorTotal - aportes) / aportes * 100) : 0,
      }
    }).sort((a: any, b: any) => b.aportes - a.aportes)
  }, [rawData.projetos, rawData.aportes, rawData.despesas])

  const roiData = useMemo(() => {
    return metrics.ativos
      .filter((p: any) => p.valor_aquisicao && p.valor_atual)
      .map((p: any) => ({
        nome: p.nome.length > 18 ? p.nome.slice(0, 18) + '…' : p.nome,
        roi: ((p.valor_atual - p.valor_aquisicao) / p.valor_aquisicao * 100),
        valorAtual: p.valor_atual,
        valorAquisicao: p.valor_aquisicao,
        valorizacao: p.valor_atual - p.valor_aquisicao,
      }))
      .sort((a: any, b: any) => b.roi - a.roi)
      .slice(0, 10)
  }, [metrics.ativos])

  if (loading) {
    return (
      <>
        <Topbar title="Dashboard" subtitle="Visão geral do seu patrimônio" />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-28 bg-white rounded-2xl border border-black/[0.07] animate-pulse" />)}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar title="Dashboard" subtitle="Visão geral do seu patrimônio" />

      <div className="p-6 space-y-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white border border-black/[0.08] p-1 rounded-xl w-fit">
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

        {/* ══════════════ TAB: VISÃO GERAL ══════════════ */}
        {activeTab === 'Visão Geral' && (
          <div className="space-y-6">
            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <KpiCard
                label="Valor da Carteira"
                value={formatShort(metrics.totalCarteira)}
                subtitle={`${metrics.ativos.length} ativos`}
                icon={Wallet}
                color="blue"
                trend={metrics.valorizacao >= 0 ? 'up' : 'down'}
                delta={metrics.valorizacao >= 0 ? `+${formatShort(metrics.valorizacao)}` : formatShort(metrics.valorizacao)}
              />
              <KpiCard
                label="Total Investido"
                value={formatShort(metrics.totalAportes)}
                subtitle="em todos os projetos"
                icon={Target}
                color="purple"
              />
              <KpiCard
                label="Receita do Mês"
                value={formatShort(metrics.receitaMes)}
                subtitle="entradas este mês"
                icon={TrendingUp}
                color="green"
              />
              <KpiCard
                label="Despesas do Mês"
                value={formatShort(metrics.saidasMes + metrics.despesasMes)}
                subtitle="saídas + op. este mês"
                icon={TrendingDown}
                color="red"
              />
              <KpiCard
                label="Lucro do Mês"
                value={formatShort(Math.abs(metrics.lucroMes))}
                subtitle={metrics.lucroMes >= 0 ? 'resultado positivo' : 'resultado negativo'}
                icon={DollarSign}
                color={metrics.lucroMes >= 0 ? 'green' : 'red'}
                trend={metrics.lucroMes >= 0 ? 'up' : 'down'}
                delta={metrics.lucroMes >= 0 ? 'Lucro' : 'Prejuízo'}
              />
              <KpiCard
                label="ROI Médio"
                value={`${metrics.roiMedio.toFixed(1)}%`}
                subtitle="valorização vs. compra"
                icon={Percent}
                color={metrics.roiMedio >= 0 ? 'green' : 'red'}
                trend={metrics.roiMedio >= 0 ? 'up' : 'down'}
                delta={metrics.roiMedio >= 0 ? 'Valorizado' : 'Desvalorizado'}
              />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Donut portfolio */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-black/[0.07] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                <SectionTitle>Portfólio por Categoria</SectionTitle>
                {categoriaData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Sem dados</div>
                ) : (
                  <div className="mt-4 flex items-center gap-4">
                    <ResponsiveContainer width="45%" height={180}>
                      <PieChart>
                        <Pie data={categoriaData} cx="50%" cy="50%" outerRadius={80} innerRadius={48} dataKey="value" paddingAngle={2}>
                          {categoriaData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}
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
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                                <span className="text-[11px] text-gray-600 truncate max-w-[80px]">{cat.name}</span>
                              </div>
                              <span className="text-[11px] font-semibold text-gray-800">{pct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Fluxo mensal */}
              <div className="lg:col-span-3 bg-white rounded-2xl border border-black/[0.07] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                <SectionTitle>Fluxo Financeiro — Últimos 6 meses</SectionTitle>
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <ComposedChart data={rawData.fluxoMensal} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} width={44} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend formatter={(v) => ({ receita: 'Receita', saidas: 'Saídas', despesas_op: 'Desp. Op.' }[v] || v)} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="receita" name="receita" fill="#22c55e" fillOpacity={0.85} radius={[3,3,0,0]} barSize={10} />
                      <Bar dataKey="saidas" name="saidas" fill="#ef4444" fillOpacity={0.75} radius={[3,3,0,0]} barSize={10} />
                      <Bar dataKey="despesas_op" name="despesas_op" fill="#f59e0b" fillOpacity={0.75} radius={[3,3,0,0]} barSize={10} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Bottom row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-black/[0.07] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-2 mb-4">
                  <FolderOpen className="h-4 w-4 text-purple-500" />
                  <SectionTitle>Projetos Ativos</SectionTitle>
                </div>
                <div className="space-y-3">
                  {rawData.projetos.filter((p: any) => p.status === 'ativo').length === 0 ? (
                    <p className="text-xs text-gray-300 text-center py-4">Nenhum projeto ativo</p>
                  ) : rawData.projetos.filter((p: any) => p.status === 'ativo').slice(0, 4).map((p: any) => {
                    const aportes = rawData.aportes.filter((a: any) => a.projeto_id === p.id).reduce((s: number, a: any) => s + (a.valor || 0), 0)
                    const desp = rawData.despesas.filter((d: any) => d.projeto_id === p.id).reduce((s: number, d: any) => s + d.valor, 0)
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{p.nome}</p>
                          <p className="text-[10px] text-gray-400">Aporte: {formatShort(aportes)} · Desp: {formatShort(desp)}</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 ${p.valor_total ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-400'}`}>
                          {p.valor_total ? formatShort(p.valor_total) : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-black/[0.07] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-2 mb-4">
                  <Wrench className="h-4 w-4 text-orange-500" />
                  <SectionTitle>Manutenções Pendentes</SectionTitle>
                </div>
                <div className="space-y-3">
                  {rawData.manutencoes.length === 0 ? (
                    <p className="text-xs text-gray-300 text-center py-4">Nenhuma pendência</p>
                  ) : rawData.manutencoes.slice(0, 4).map((m: any) => (
                    <div key={m.id} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{m.descricao}</p>
                        <p className="text-[10px] text-gray-400 truncate">{m.patrimonios?.nome}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ${m.status === 'em_andamento' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                        {m.status === 'em_andamento' ? 'Andamento' : 'Pendente'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-black/[0.07] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-4 w-4 text-green-500" />
                  <SectionTitle>Resultado Operacional</SectionTitle>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Total Receitas', value: metrics.totalReceitas, positive: true },
                    { label: 'Total Desp. Operacionais', value: metrics.totalDespesas, positive: false },
                    { label: 'Lucro Operacional', value: metrics.lucroTotal, positive: metrics.lucroTotal >= 0, bold: true },
                  ].map(row => (
                    <div key={row.label} className={`flex items-center justify-between ${row.bold ? 'border-t border-gray-100 pt-2 mt-1' : ''}`}>
                      <span className={`text-xs ${row.bold ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>{row.label}</span>
                      <span className={`text-xs font-semibold ${row.bold ? (row.positive ? 'text-green-600' : 'text-red-500') : row.positive ? 'text-gray-700' : 'text-red-500'}`}>
                        {row.positive && row.value > 0 ? '' : row.value < 0 ? '-' : ''}{formatBRL(Math.abs(row.value))}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">Total Aportes (investimentos)</span>
                    <span className="text-xs font-semibold text-purple-600">{formatBRL(metrics.totalAportes)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ TAB: PROJETOS P&L ══════════════ */}
        {activeTab === 'Projetos P&L' && (
          <div className="space-y-6">
            {/* P&L metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Total Investido (Aportes)" value={formatShort(metrics.totalAportes)} subtitle="custo de implantação" icon={Target} color="purple" />
              <KpiCard label="Desp. Operacionais" value={formatShort(metrics.totalDespesas)} subtitle="custos de operação" icon={TrendingDown} color="red" />
              <KpiCard label="Receitas Geradas" value={formatShort(metrics.totalReceitas)} subtitle="retorno acumulado" icon={TrendingUp} color="green" />
              <KpiCard
                label="Lucro Operacional"
                value={formatShort(Math.abs(metrics.lucroTotal))}
                subtitle={metrics.lucroTotal >= 0 ? 'receita > despesas' : 'despesas > receita'}
                icon={DollarSign}
                color={metrics.lucroTotal >= 0 ? 'green' : 'red'}
                trend={metrics.lucroTotal >= 0 ? 'up' : 'down'}
                delta={metrics.lucroTotal >= 0 ? 'Lucro' : 'Prejuízo'}
              />
            </div>

            {/* Chart: aportes vs despesas vs valor total por projeto */}
            {projetosPL.length > 0 && (
              <div className="bg-white rounded-2xl border border-black/[0.07] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                <SectionTitle>Investimento vs. Despesas Operacionais por Projeto</SectionTitle>
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={Math.max(240, projetosPL.length * 52)}>
                    <BarChart data={projetosPL} layout="vertical" barSize={14} margin={{ top: 0, right: 80, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: '#64748b' }} width={120} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="aportes" name="Aportes (Investimento)" fill="#8b5cf6" fillOpacity={0.85} radius={[0,3,3,0]}
                        label={{ position: 'right', fontSize: 9, fill: '#8b5cf6', formatter: (v: number) => v > 0 ? formatShort(v) : '' }} />
                      <Bar dataKey="despesas_op" name="Desp. Operacionais" fill="#ef4444" fillOpacity={0.75} radius={[0,3,3,0]}
                        label={{ position: 'right', fontSize: 9, fill: '#ef4444', formatter: (v: number) => v > 0 ? formatShort(v) : '' }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Table P&L */}
            <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <div className="px-5 py-4 border-b border-gray-100">
                <SectionTitle>P&L por Projeto</SectionTitle>
                <p className="text-[11px] text-gray-400 mt-0.5">Aportes = custo de implantação · Desp. Op. = custo de operação · Lucro = Valor Total − Aportes</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Projeto</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Aportes</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Desp. Op.</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor Total</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Lucro Teórico</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projetosPL.length === 0 ? (
                      <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-300">Nenhum projeto cadastrado</td></tr>
                    ) : projetosPL.map((p: any, i: number) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-5 py-3 font-medium text-gray-900 text-xs">{p.nomeCompleto}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                            p.status === 'ativo' ? 'bg-green-50 text-green-700 border-green-200' :
                            p.status === 'pausado' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-gray-50 text-gray-500 border-gray-200'
                          }`}>{p.status || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-purple-700">{formatBRL(p.aportes)}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-red-500">{p.despesas_op > 0 ? formatBRL(p.despesas_op) : '—'}</td>
                        <td className="px-4 py-3 text-right text-xs text-gray-600">{p.valor_total > 0 ? formatBRL(p.valor_total) : '—'}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold">
                          {p.lucro !== 0 ? (
                            <span className={p.lucro >= 0 ? 'text-green-600' : 'text-red-500'}>{p.lucro >= 0 ? '+' : ''}{formatBRL(p.lucro)}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold">
                          {p.roi !== 0 ? (
                            <span className={p.roi >= 0 ? 'text-green-600' : 'text-red-500'}>{p.roi >= 0 ? '+' : ''}{p.roi.toFixed(1)}%</span>
                          ) : '—'}
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
                        <td className="px-4 py-3 text-right text-xs font-bold text-red-500">{formatBRL(projetosPL.reduce((s: number, p: any) => s + p.despesas_op, 0))}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-gray-700">{formatBRL(projetosPL.reduce((s: number, p: any) => s + p.valor_total, 0))}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold">
                          <span className={projetosPL.reduce((s: number, p: any) => s + p.lucro, 0) >= 0 ? 'text-green-600' : 'text-red-500'}>
                            {formatBRL(projetosPL.reduce((s: number, p: any) => s + p.lucro, 0))}
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

        {/* ══════════════ TAB: PATRIMÔNIO ══════════════ */}
        {activeTab === 'Patrimônio' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Valor da Carteira" value={formatShort(metrics.totalCarteira)} subtitle={`${metrics.ativos.length} ativos`} icon={Wallet} color="blue" />
              <KpiCard label="Custo de Aquisição" value={formatShort(metrics.totalAquisicao)} subtitle="valor pago histórico" icon={Building2} color="gray" />
              <KpiCard
                label="Valorização"
                value={formatShort(Math.abs(metrics.valorizacao))}
                subtitle={metrics.valorizacao >= 0 ? 'acima do custo' : 'abaixo do custo'}
                icon={TrendingUp}
                color={metrics.valorizacao >= 0 ? 'green' : 'red'}
                trend={metrics.valorizacao >= 0 ? 'up' : 'down'}
              />
              <KpiCard label="ROI Médio" value={`${metrics.roiMedio.toFixed(1)}%`} subtitle="valorização média" icon={Percent} color={metrics.roiMedio >= 0 ? 'green' : 'red'} />
            </div>

            {/* Patrimônio por categoria detalhado */}
            <div className="bg-white rounded-2xl border border-black/[0.07] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <SectionTitle>Distribuição por Categoria</SectionTitle>
              <div className="mt-4 space-y-3">
                {categoriaData.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-6">Nenhum ativo cadastrado</p>
                ) : categoriaData.map((cat, i) => {
                  const total = categoriaData.reduce((s, c) => s + c.value, 0)
                  const pct = total > 0 ? (cat.value / total * 100) : 0
                  const count = metrics.ativos.filter((p: any) => (p.categorias?.nome || 'Sem categoria') === cat.name).length
                  return (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-xs font-medium text-gray-700">{cat.name}</span>
                          <span className="text-[10px] text-gray-400">({count} ativo{count !== 1 ? 's' : ''})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{pct.toFixed(1)}%</span>
                          <span className="text-xs font-bold text-gray-900">{formatBRL(cat.value)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top ativos */}
            <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <div className="px-5 py-4 border-b border-gray-100">
                <SectionTitle>Top Ativos por Valor</SectionTitle>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Nome</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Categoria</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Localização</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Aquisição</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor Atual</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valorização</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.ativos
                      .sort((a: any, b: any) => (b.valor_atual || b.valor_aquisicao || 0) - (a.valor_atual || a.valor_aquisicao || 0))
                      .slice(0, 10)
                      .map((p: any, i: number) => {
                        const valorizacao = p.valor_aquisicao && p.valor_atual ? p.valor_atual - p.valor_aquisicao : null
                        const valorPct = p.valor_aquisicao && valorizacao !== null ? (valorizacao / p.valor_aquisicao * 100) : null
                        return (
                          <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="px-5 py-3 text-xs font-medium text-gray-800">{p.nome}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{p.categorias?.nome || '—'}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{[p.cidade, p.estado].filter(Boolean).join(', ') || '—'}</td>
                            <td className="px-4 py-3 text-xs text-right text-gray-500">{p.valor_aquisicao ? formatBRL(p.valor_aquisicao) : '—'}</td>
                            <td className="px-4 py-3 text-xs text-right font-semibold text-gray-900">{p.valor_atual ? formatBRL(p.valor_atual) : p.valor_aquisicao ? formatBRL(p.valor_aquisicao) : '—'}</td>
                            <td className="px-4 py-3 text-xs text-right font-semibold">
                              {valorizacao !== null ? (
                                <span className={valorizacao >= 0 ? 'text-green-600' : 'text-red-500'}>
                                  {valorizacao >= 0 ? '+' : ''}{formatBRL(valorizacao)}
                                  {valorPct !== null && <span className="text-[10px] ml-1 opacity-70">({valorPct >= 0 ? '+' : ''}{valorPct.toFixed(1)}%)</span>}
                                </span>
                              ) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    {metrics.ativos.length === 0 && (
                      <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-300">Nenhum ativo cadastrado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ TAB: ROI ══════════════ */}
        {activeTab === 'ROI' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="ROI Médio da Carteira"
                value={`${metrics.roiMedio.toFixed(1)}%`}
                subtitle="vs. valor de aquisição"
                icon={Percent}
                color={metrics.roiMedio >= 0 ? 'green' : 'red'}
                trend={metrics.roiMedio >= 0 ? 'up' : 'down'}
                delta={metrics.roiMedio >= 0 ? 'Valorizado' : 'Desvalorizado'}
              />
              <KpiCard
                label="Valorização Total"
                value={formatShort(Math.abs(metrics.valorizacao))}
                subtitle={metrics.valorizacao >= 0 ? 'ganho acumulado' : 'perda acumulada'}
                icon={TrendingUp}
                color={metrics.valorizacao >= 0 ? 'green' : 'red'}
              />
              <KpiCard
                label="Ativos com ROI+"
                value={String(metrics.ativos.filter((p: any) => p.valor_atual && p.valor_aquisicao && p.valor_atual > p.valor_aquisicao).length)}
                subtitle="acima do valor de compra"
                icon={ArrowUpRight}
                color="green"
              />
              <KpiCard
                label="Ativos com ROI-"
                value={String(metrics.ativos.filter((p: any) => p.valor_atual && p.valor_aquisicao && p.valor_atual < p.valor_aquisicao).length)}
                subtitle="abaixo do valor de compra"
                icon={ArrowDownRight}
                color="red"
              />
            </div>

            <div className="bg-white rounded-2xl border border-black/[0.07] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <SectionTitle>ROI por Ativo (%)</SectionTitle>
              {roiData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-gray-300 text-sm">Cadastre patrimônios com valor atual para ver o ROI</div>
              ) : (
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={Math.max(240, roiData.length * 42)}>
                    <BarChart data={roiData} layout="vertical" barSize={16} margin={{ top: 0, right: 80, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${v.toFixed(0)}%`} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: '#64748b' }} width={120} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(v: number, name: string) => [
                          name === 'roi' ? `${v.toFixed(2)}%` : formatBRL(v),
                          name === 'roi' ? 'ROI' : name === 'valorAtual' ? 'Valor Atual' : 'Aquisição'
                        ]}
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      />
                      <Bar dataKey="roi" name="ROI %" radius={[0,4,4,0]}
                        label={{ position: 'right', fontSize: 10, fill: '#64748b', formatter: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` }}
                      >
                        {roiData.map((entry, i) => (
                          <Cell key={i} fill={entry.roi >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {roiData.length > 0 && (
              <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                <div className="px-5 py-4 border-b border-gray-100">
                  <SectionTitle>Detalhamento de Valorização</SectionTitle>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Ativo</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Aquisição</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor Atual</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valorização (R$)</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">ROI (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roiData.map((p: any, i: number) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-5 py-3 text-xs font-medium text-gray-800">{p.nome}</td>
                          <td className="px-4 py-3 text-xs text-right text-gray-500">{formatBRL(p.valorAquisicao)}</td>
                          <td className="px-4 py-3 text-xs text-right font-semibold text-gray-900">{formatBRL(p.valorAtual)}</td>
                          <td className="px-4 py-3 text-xs text-right font-semibold">
                            <span className={p.valorizacao >= 0 ? 'text-green-600' : 'text-red-500'}>
                              {p.valorizacao >= 0 ? '+' : ''}{formatBRL(p.valorizacao)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-right font-bold">
                            <span className={p.roi >= 0 ? 'text-green-600' : 'text-red-500'}>
                              {p.roi >= 0 ? '+' : ''}{p.roi.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
