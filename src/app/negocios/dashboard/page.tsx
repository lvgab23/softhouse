'use client'

import { useEffect, useState, useMemo } from 'react'
import { Building2, DollarSign, TrendingUp, BarChart2, Search } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { MetricCard } from '@/components/ui/metric-card'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatBRL, formatShort } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const FASE_LABELS: Record<string, string> = {
  captacao: 'Captação', analise: 'Análise', aprovacao: 'Aprovação',
  em_execucao: 'Em Execução', concluido: 'Concluído', cancelado: 'Cancelado',
}
const FASE_COLORS: Record<string, string> = {
  captacao: '#3b82f6', analise: '#eab308', aprovacao: '#f97316',
  em_execucao: '#22c55e', concluido: '#10b981', cancelado: '#ef4444',
}
const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f97316']
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'gray' | 'danger' | 'info'> = {
  ativa: 'success', inativa: 'gray', em_negociacao: 'warning',
}

export default function NegociosDashboardPage() {
  const [empresas, setEmpresas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmpresa, setSelectedEmpresa] = useState('todas')

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const { data } = await (supabase as any)
        .from('empresas').select('*').order('nome')
      setEmpresas(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const empresasFiltradas = useMemo(() =>
    selectedEmpresa === 'todas' ? empresas : empresas.filter(e => e.id === selectedEmpresa),
    [empresas, selectedEmpresa]
  )

  const empresaSelecionada = selectedEmpresa !== 'todas'
    ? empresas.find(e => e.id === selectedEmpresa)
    : null

  const totalInvestido = empresasFiltradas.reduce((s, e) => s + (e.valor_investimento || 0), 0)
  const totalRetorno = empresasFiltradas.reduce((s, e) => s + (e.valor_retorno || 0), 0)
  const roiMedio = totalInvestido > 0 ? ((totalRetorno - totalInvestido) / totalInvestido) * 100 : 0

  const faseData = Object.entries(FASE_LABELS).map(([fase, label]) => ({
    fase: label,
    quantidade: empresasFiltradas.filter(e => e.fase === fase).length,
    fill: FASE_COLORS[fase],
  })).filter(d => d.quantidade > 0)

  const setorMap: Record<string, number> = {}
  empresasFiltradas.forEach(e => {
    if (e.setor) setorMap[e.setor] = (setorMap[e.setor] || 0) + 1
  })
  const setorData = Object.entries(setorMap).map(([name, value]) => ({ name, value }))

  return (
    <AppLayout>
      <Topbar title="Dashboard de Negócios" subtitle={empresaSelecionada ? `Empresa: ${empresaSelecionada.nome}` : 'Visão geral das empresas'} />

      <div className="p-6 space-y-5">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-black/[0.08] px-4 py-3">
          <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="text-xs font-medium text-gray-500">Visualizando:</span>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedEmpresa('todas')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedEmpresa === 'todas' ? 'bg-[#0f172a] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todas as empresas
            </button>
            {empresas.map(e => (
              <button
                key={e.id}
                onClick={() => setSelectedEmpresa(e.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedEmpresa === e.id ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {e.nome}
              </button>
            ))}
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label={empresaSelecionada ? 'Empresa' : 'Total de Empresas'}
            value={empresaSelecionada ? '1' : String(empresas.length)}
            icon={Building2}
            subtitle={empresaSelecionada ? empresaSelecionada.setor || '—' : `${empresas.filter(e => e.status === 'ativa').length} ativas`}
          />
          <MetricCard
            label="Total Investido"
            value={loading ? '...' : formatShort(totalInvestido)}
            icon={DollarSign}
          />
          <MetricCard
            label="Total Retorno"
            value={loading ? '...' : formatShort(totalRetorno)}
            icon={TrendingUp}
            trend={totalRetorno >= totalInvestido ? 'up' : 'down'}
            trendValue={totalRetorno >= totalInvestido ? 'Positivo' : 'Negativo'}
          />
          <MetricCard
            label="ROI"
            value={loading ? '...' : `${roiMedio.toFixed(1)}%`}
            icon={BarChart2}
            trend={roiMedio >= 0 ? 'up' : 'down'}
          />
        </div>

        {/* Charts */}
        {!empresaSelecionada && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <p className="text-sm font-semibold text-gray-700">Distribuição por Fase</p>
              </CardHeader>
              <CardBody>
                {loading ? (
                  <div className="h-52 bg-gray-50 animate-pulse rounded-lg" />
                ) : faseData.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Nenhum dado</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={faseData} barSize={24}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="fase" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                      <Tooltip formatter={(v: number) => [v, 'Empresas']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="quantidade" name="Empresas" radius={[4, 4, 0, 0]}>
                        {faseData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <p className="text-sm font-semibold text-gray-700">Distribuição por Setor</p>
              </CardHeader>
              <CardBody>
                {loading ? (
                  <div className="h-52 bg-gray-50 animate-pulse rounded-lg" />
                ) : setorData.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Nenhum dado</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={setorData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                        {setorData.map((_, index) => <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>
          </div>
        )}

        {/* Company detail card when one is selected */}
        {empresaSelecionada && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">{empresaSelecionada.nome}</p>
                <Badge variant={STATUS_VARIANT[empresaSelecionada.status] || 'gray'}>
                  {empresaSelecionada.status?.replace('_', ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: 'CNPJ', value: empresaSelecionada.cnpj || '—' },
                  { label: 'Setor', value: empresaSelecionada.setor || '—' },
                  { label: 'Fase', value: FASE_LABELS[empresaSelecionada.fase] || empresaSelecionada.fase || '—' },
                  { label: 'Cidade', value: empresaSelecionada.cidade ? `${empresaSelecionada.cidade}/${empresaSelecionada.estado || ''}` : '—' },
                  { label: 'Investido', value: formatBRL(empresaSelecionada.valor_investimento || 0) },
                  { label: 'Retorno', value: formatBRL(empresaSelecionada.valor_retorno || 0) },
                  { label: 'ROI', value: empresaSelecionada.valor_investimento ? `${(((empresaSelecionada.valor_retorno || 0) - empresaSelecionada.valor_investimento) / empresaSelecionada.valor_investimento * 100).toFixed(1)}%` : '—' },
                  { label: 'Fundação', value: empresaSelecionada.data_fundacao || '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
              {empresaSelecionada.descricao && (
                <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100">{empresaSelecionada.descricao}</p>
              )}
            </CardBody>
          </Card>
        )}

        {/* Companies list */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-3">
            {empresaSelecionada ? 'Outras Empresas' : 'Top Empresas por Investimento'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(empresaSelecionada ? empresas.filter(e => e.id !== selectedEmpresa) : empresas)
              .sort((a, b) => (b.valor_investimento || 0) - (a.valor_investimento || 0))
              .slice(0, empresaSelecionada ? 6 : 3)
              .map((emp, i) => {
                const roi = emp.valor_investimento && emp.valor_retorno
                  ? (((emp.valor_retorno - emp.valor_investimento) / emp.valor_investimento) * 100).toFixed(1)
                  : null
                return (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedEmpresa(emp.id)}
                    className="bg-white rounded-xl border border-black/[0.08] p-5 flex flex-col gap-3 shadow-sm text-left hover:border-amber-200 hover:shadow transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {!empresaSelecionada && (
                          <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {i + 1}
                          </span>
                        )}
                        <p className="font-semibold text-gray-900 text-sm leading-tight">{emp.nome}</p>
                      </div>
                      <Badge variant={STATUS_VARIANT[emp.status] || 'gray'}>{emp.status?.replace('_', ' ')}</Badge>
                    </div>
                    {emp.setor && <p className="text-xs text-gray-400">{emp.setor}</p>}
                    <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Investimento</p>
                        <p className="text-sm font-bold text-gray-900">{emp.valor_investimento ? formatShort(emp.valor_investimento) : '—'}</p>
                      </div>
                      {roi !== null && (
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">ROI</p>
                          <p className={`text-sm font-bold ${Number(roi) >= 0 ? 'text-green-600' : 'text-red-500'}`}>{roi}%</p>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
