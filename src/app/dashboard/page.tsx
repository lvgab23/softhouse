'use client'

import { useEffect, useState, useMemo } from 'react'
import { Wallet, TrendingUp, Percent, AlertTriangle, Wrench, FolderOpen, ChevronDown } from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts'
import { Topbar } from '@/components/layout/topbar'
import { MetricCard } from '@/components/ui/metric-card'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatBRL, formatShort, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']
const TABS = ['Geral', 'Gráficos', 'Analítico', 'ROI']

function FilterDropdown({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 focus:border-[#0f172a] cursor-pointer"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
    </div>
  )
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Geral')
  const [filterCategoria, setFilterCategoria] = useState('todas')
  const [filterProjeto, setFilterProjeto] = useState('todos')
  const [rawData, setRawData] = useState<any>({
    patrimonios: [],
    movimentacoes: [],
    manutencoes: [],
    projetos: [],
    categorias: [],
    fluxoMensal: [],
  })

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const [patrimoniosRes, movimentacoesRes, manutencoesRes, projetosRes, categoriasRes] = await Promise.all([
        supabase.from('patrimonios').select('*, categorias(nome)').eq('status', 'ativo'),
        supabase.from('movimentacoes').select('*').gte('data', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
        supabase.from('manutencoes').select('*, patrimonios(nome)').neq('status', 'concluida').order('created_at', { ascending: false }).limit(5),
        supabase.from('projetos').select('*').eq('status', 'ativo').limit(5),
        supabase.from('categorias').select('*').order('nome'),
      ])

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

      const fluxoMensalPromises = meses.map(async (m) => {
        const res = await supabase.from('movimentacoes').select('tipo, valor').gte('data', m.inicio).lte('data', m.fim)
        const mov = res.data || []
        return {
          mes: m.mes,
          entradas: mov.filter((x: any) => x.tipo === 'entrada').reduce((s: number, x: any) => s + x.valor, 0),
          saidas: mov.filter((x: any) => x.tipo === 'saida').reduce((s: number, x: any) => s + x.valor, 0),
        }
      })

      const fluxoMensal = await Promise.all(fluxoMensalPromises)

      setRawData({
        patrimonios: patrimoniosRes.data || [],
        movimentacoes: movimentacoesRes.data || [],
        manutencoes: manutencoesRes.data || [],
        projetos: projetosRes.data || [],
        categorias: categoriasRes.data || [],
        fluxoMensal,
      })
      setLoading(false)
    }
    fetchData()
  }, [])

  const filteredPatrimonios = useMemo(() => {
    let p = rawData.patrimonios
    if (filterCategoria !== 'todas') p = p.filter((x: any) => x.categorias?.nome === filterCategoria || x.categoria_id === filterCategoria)
    return p
  }, [rawData.patrimonios, filterCategoria])

  const filteredProjetos = useMemo(() => {
    if (filterProjeto === 'todos') return rawData.projetos
    return rawData.projetos.filter((p: any) => p.id === filterProjeto)
  }, [rawData.projetos, filterProjeto])

  const metrics = useMemo(() => {
    const totalCarteira = filteredPatrimonios.reduce((s: number, p: any) => s + (p.valor_atual || p.valor_aquisicao || 0), 0)
    const investidoPeriodo = rawData.movimentacoes.filter((m: any) => m.tipo === 'saida').reduce((s: number, m: any) => s + m.valor, 0)
    const roiMedio = filteredPatrimonios.length > 0
      ? filteredPatrimonios.reduce((s: number, p: any) => {
          if (!p.valor_aquisicao || !p.valor_atual) return s
          return s + ((p.valor_atual - p.valor_aquisicao) / p.valor_aquisicao * 100)
        }, 0) / filteredPatrimonios.filter((p: any) => p.valor_aquisicao && p.valor_atual).length || 0
      : 0
    const ativosRisco = rawData.manutencoes.filter((m: any) => m.proxima_manutencao && new Date(m.proxima_manutencao) < new Date()).length
    return { totalCarteira, investidoPeriodo, roiMedio: isNaN(roiMedio) ? 0 : roiMedio, ativosRisco }
  }, [filteredPatrimonios, rawData.movimentacoes, rawData.manutencoes])

  const categoriaData = useMemo(() => {
    const categoriaMap: Record<string, number> = {}
    filteredPatrimonios.forEach((p: any) => {
      const cat = p.categorias?.nome || 'Sem categoria'
      categoriaMap[cat] = (categoriaMap[cat] || 0) + (p.valor_atual || p.valor_aquisicao || 0)
    })
    return Object.entries(categoriaMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filteredPatrimonios])

  const roiData = useMemo(() => {
    return filteredPatrimonios
      .filter((p: any) => p.valor_aquisicao && p.valor_atual)
      .map((p: any) => ({
        nome: p.nome.length > 16 ? p.nome.slice(0, 16) + '…' : p.nome,
        roi: ((p.valor_atual - p.valor_aquisicao) / p.valor_aquisicao * 100),
        valorAtual: p.valor_atual,
        valorAquisicao: p.valor_aquisicao,
      }))
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 10)
  }, [filteredPatrimonios])

  const categoriaOptions = [
    { value: 'todas', label: 'Todas Categorias' },
    ...rawData.categorias.map((c: any) => ({ value: c.nome, label: c.nome })),
  ]
  const projetoOptions = [
    { value: 'todos', label: 'Todos Projetos' },
    ...rawData.projetos.map((p: any) => ({ value: p.id, label: p.nome })),
  ]

  if (loading) {
    return (
      <>
        <Topbar title="Dashboard" subtitle="Visão geral do seu patrimônio" />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-28 bg-white rounded-xl border border-black/[0.08] animate-pulse" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-72 bg-white rounded-xl border border-black/[0.08] animate-pulse" />
            <div className="h-72 bg-white rounded-xl border border-black/[0.08] animate-pulse" />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar title="Dashboard" subtitle="Visão geral do seu patrimônio">
        <div className="flex items-center gap-2">
          <FilterDropdown label="Categoria" value={filterCategoria} options={categoriaOptions} onChange={setFilterCategoria} />
          <FilterDropdown label="Projeto" value={filterProjeto} options={projetoOptions} onChange={setFilterProjeto} />
        </div>
      </Topbar>

      <div className="p-6 space-y-5">
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

        {/* === TAB: GERAL === */}
        {activeTab === 'Geral' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Valor da Carteira" value={formatShort(metrics.totalCarteira)} subtitle={`${filteredPatrimonios.length} ativos`} icon={Wallet} />
              <MetricCard label="Investido no Mês" value={formatShort(metrics.investidoPeriodo)} subtitle="saídas este mês" icon={TrendingUp} />
              <MetricCard
                label="ROI Médio"
                value={`${metrics.roiMedio.toFixed(1)}%`}
                subtitle="valorização vs. aquisição"
                icon={Percent}
                trend={metrics.roiMedio >= 0 ? 'up' : 'down'}
                trendValue={metrics.roiMedio >= 0 ? 'Positivo' : 'Negativo'}
              />
              <MetricCard label="Ativos em Risco" value={String(metrics.ativosRisco)} subtitle="manutenções vencidas" icon={AlertTriangle} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" /> Ações Necessárias
                  </p>
                </CardHeader>
                <CardBody>
                  {metrics.ativosRisco === 0
                    ? <p className="text-sm text-gray-400 text-center py-4">Nenhuma ação pendente</p>
                    : <p className="text-sm text-gray-600">{metrics.ativosRisco} manutenção(ões) vencida(s)</p>
                  }
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-blue-500" /> Ordens de Serviço
                  </p>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    {rawData.manutencoes.length === 0
                      ? <p className="text-sm text-gray-400 text-center py-2">Nenhuma manutenção</p>
                      : rawData.manutencoes.slice(0, 3).map((m: any) => (
                        <div key={m.id} className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">{m.descricao}</p>
                            <p className="text-xs text-gray-400 truncate">{m.patrimonios?.nome}</p>
                          </div>
                          <Badge variant={m.status === 'em_andamento' ? 'info' : 'gray'} className="flex-shrink-0">
                            {m.status === 'em_andamento' ? 'Em andamento' : 'Pendente'}
                          </Badge>
                        </div>
                      ))
                    }
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-purple-500" /> Projetos Ativos
                  </p>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    {filteredProjetos.length === 0
                      ? <p className="text-sm text-gray-400 text-center py-2">Nenhum projeto ativo</p>
                      : filteredProjetos.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-700 truncate">{p.nome}</p>
                          <span className="text-xs text-gray-400 flex-shrink-0">{formatShort(p.valor_total || 0)}</span>
                        </div>
                      ))
                    }
                  </div>
                </CardBody>
              </Card>
            </div>
          </>
        )}

        {/* === TAB: GRÁFICOS === */}
        {activeTab === 'Gráficos' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <p className="text-sm font-semibold text-gray-700">Patrimônio por Categoria</p>
              </CardHeader>
              <CardBody>
                {categoriaData.length === 0
                  ? <div className="h-52 flex items-center justify-center text-gray-400 text-sm">Nenhum patrimônio cadastrado</div>
                  : (
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="55%" height={220}>
                        <PieChart>
                          <Pie data={categoriaData} cx="50%" cy="50%" outerRadius={90} innerRadius={52} dataKey="value" paddingAngle={2}>
                            {categoriaData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}
                          </Pie>
                          <Tooltip
                            formatter={(v: number) => [formatBRL(v), 'Valor']}
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2">
                        {categoriaData.slice(0, 6).map((cat, i) => {
                          const total = categoriaData.reduce((s, c) => s + c.value, 0)
                          const pct = total > 0 ? (cat.value / total * 100) : 0
                          return (
                            <div key={cat.name}>
                              <div className="flex items-center justify-between mb-0.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                                  <span className="text-[11px] text-gray-600 truncate max-w-[90px]">{cat.name}</span>
                                </div>
                                <span className="text-[11px] font-semibold text-gray-800">{pct.toFixed(0)}%</span>
                              </div>
                              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                }
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <p className="text-sm font-semibold text-gray-700">Fluxo Financeiro — Últimos 6 meses</p>
              </CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={rawData.fluxoMensal} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} width={48} />
                    <Tooltip
                      formatter={(v: number, name: string) => [formatBRL(v), name === 'entradas' ? 'Entradas' : 'Saídas']}
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                    />
                    <Legend formatter={(v) => v === 'entradas' ? 'Entradas' : 'Saídas'} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="entradas" stroke="#22c55e" strokeWidth={2} fill="#22c55e" fillOpacity={0.08} dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }} />
                    <Area type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={2} fill="#ef4444" fillOpacity={0.08} dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </div>
        )}

        {/* === TAB: ANALÍTICO === */}
        {activeTab === 'Analítico' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <p className="text-sm font-semibold text-gray-700">Valor por Categoria</p>
              </CardHeader>
              <CardBody>
                {categoriaData.length === 0
                  ? <p className="text-sm text-gray-400 text-center py-6">Nenhum patrimônio cadastrado</p>
                  : (
                    <div className="space-y-3">
                      {categoriaData.map((cat, i) => {
                        const total = categoriaData.reduce((s, c) => s + c.value, 0)
                        const pct = total > 0 ? (cat.value / total * 100) : 0
                        return (
                          <div key={cat.name}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                                <span className="text-xs font-medium text-gray-700">{cat.name}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-400">{pct.toFixed(1)}%</span>
                                <span className="text-xs font-semibold text-gray-900">{formatBRL(cat.value)}</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                }
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <p className="text-sm font-semibold text-gray-700">Top Patrimônios por Valor</p>
              </CardHeader>
              <CardBody>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">Nome</th>
                        <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">Categoria</th>
                        <th className="text-right py-2 pr-4 text-xs font-medium text-gray-500">Aquisição</th>
                        <th className="text-right py-2 text-xs font-medium text-gray-500">Valor Atual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPatrimonios
                        .sort((a: any, b: any) => (b.valor_atual || b.valor_aquisicao || 0) - (a.valor_atual || a.valor_aquisicao || 0))
                        .slice(0, 8)
                        .map((p: any) => (
                          <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="py-2 pr-4 text-xs font-medium text-gray-800">{p.nome}</td>
                            <td className="py-2 pr-4 text-xs text-gray-500">{p.categorias?.nome || '—'}</td>
                            <td className="py-2 pr-4 text-xs text-right text-gray-500">{p.valor_aquisicao ? formatBRL(p.valor_aquisicao) : '—'}</td>
                            <td className="py-2 text-xs text-right font-medium text-gray-900">{p.valor_atual ? formatBRL(p.valor_atual) : p.valor_aquisicao ? formatBRL(p.valor_aquisicao) : '—'}</td>
                          </tr>
                        ))
                      }
                      {filteredPatrimonios.length === 0 && (
                        <tr><td colSpan={4} className="py-6 text-center text-sm text-gray-400">Nenhum patrimônio encontrado</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {/* === TAB: ROI === */}
        {activeTab === 'ROI' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="ROI Médio da Carteira"
                value={`${metrics.roiMedio.toFixed(1)}%`}
                subtitle="vs. valor de aquisição"
                icon={Percent}
                trend={metrics.roiMedio >= 0 ? 'up' : 'down'}
                trendValue={metrics.roiMedio >= 0 ? 'Valorizado' : 'Desvalorizado'}
              />
              <MetricCard
                label="Valorização Total"
                value={formatShort(metrics.totalCarteira - filteredPatrimonios.reduce((s: number, p: any) => s + (p.valor_aquisicao || 0), 0))}
                subtitle="ganho acumulado"
                icon={TrendingUp}
              />
              <MetricCard
                label="Patrimônios com ROI+"
                value={String(filteredPatrimonios.filter((p: any) => p.valor_atual > p.valor_aquisicao).length)}
                subtitle="acima do valor de compra"
                icon={Wallet}
              />
              <MetricCard
                label="Patrimônios com ROI-"
                value={String(filteredPatrimonios.filter((p: any) => p.valor_atual && p.valor_aquisicao && p.valor_atual < p.valor_aquisicao).length)}
                subtitle="abaixo do valor de compra"
                icon={AlertTriangle}
              />
            </div>

            <Card>
              <CardHeader>
                <p className="text-sm font-semibold text-gray-700">ROI por Patrimônio (%)</p>
              </CardHeader>
              <CardBody>
                {roiData.length === 0
                  ? <div className="h-52 flex items-center justify-center text-gray-400 text-sm">Cadastre patrimônios com valor atual para ver o ROI</div>
                  : (
                    <ResponsiveContainer width="100%" height={Math.max(220, roiData.length * 38)}>
                      <BarChart data={roiData} layout="vertical" barSize={14} margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${v.toFixed(0)}%`} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: '#64748b' }} width={110} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(v: number) => [`${v.toFixed(2)}%`, 'ROI']}
                          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                        />
                        <Bar dataKey="roi" name="ROI %" radius={[0,4,4,0]}
                          label={{ position: 'right', fontSize: 10, fill: '#64748b', formatter: (v: number) => `${v.toFixed(1)}%` }}
                        >
                          {roiData.map((entry, i) => (
                            <Cell key={i} fill={entry.roi >= 0 ? '#3b82f6' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )
                }
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
