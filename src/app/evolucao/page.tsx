'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, DollarSign, TrendingDown, Building2, Download, ChevronDown } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { MetricCard } from '@/components/ui/metric-card'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatBRL, formatShort } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const TABS = ['Acumulado', 'Mensal', 'Anual']

const PERIODS = [
  { value: 'all', label: 'Desde a aquisição' },
  { value: '12m', label: 'Últimos 12 meses' },
  { value: '6m', label: 'Últimos 6 meses' },
  { value: '3m', label: 'Últimos 3 meses' },
  { value: '1m', label: 'Último mês' },
]

export default function EvolucaoPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Acumulado')
  const [period, setPeriod] = useState('all')
  const [allChartData, setAllChartData] = useState<any[]>([])
  const [metrics, setMetrics] = useState({ total: 0, crescimento: 0, depreciacao: 0, maiorAquisicao: 0, totalAquisicao: 0 })

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const { data: patrimonios } = await supabase
        .from('patrimonios')
        .select('valor_aquisicao, valor_atual, data_aquisicao, categorias(taxa_depreciacao)')
        .eq('status', 'ativo')
        .order('data_aquisicao')

      const items = patrimonios || []
      const total = items.reduce((s: number, p: any) => s + (p.valor_atual || p.valor_aquisicao || 0), 0)
      const totalAquisicao = items.reduce((s: number, p: any) => s + (p.valor_aquisicao || 0), 0)
      const crescimento = totalAquisicao > 0 ? ((total - totalAquisicao) / totalAquisicao) * 100 : 0
      const maiorAquisicao = Math.max(...items.map((p: any) => p.valor_aquisicao || 0), 0)

      const depreciacao = items.reduce((s: number, p: any) => {
        const taxa = p.categorias?.taxa_depreciacao || 0
        const val = p.valor_aquisicao || 0
        return s + (val * taxa / 100)
      }, 0)

      setMetrics({ total, crescimento, depreciacao, maiorAquisicao, totalAquisicao })

      // Build accumulated chart data by month
      const monthMap: Record<string, number> = {}
      let acc = 0
      items
        .filter((p: any) => p.data_aquisicao)
        .sort((a: any, b: any) => a.data_aquisicao.localeCompare(b.data_aquisicao))
        .forEach((p: any) => {
          const mes = p.data_aquisicao.slice(0, 7)
          acc += p.valor_atual || p.valor_aquisicao || 0
          monthMap[mes] = acc
        })

      if (Object.keys(monthMap).length === 0) {
        const now = new Date()
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          monthMap[d.toISOString().slice(0, 7)] = 0
        }
      }

      const chartPoints = Object.entries(monthMap).map(([mes, valor]) => ({
        mes: new Date(mes + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        valor,
        isoMes: mes,
      }))

      setAllChartData(chartPoints)
      setLoading(false)
    }
    fetchData()
  }, [])

  const chartData = (() => {
    if (period === 'all' || allChartData.length === 0) return allChartData
    const now = new Date()
    const months = period === '12m' ? 12 : period === '6m' ? 6 : period === '3m' ? 3 : 1
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1).toISOString().slice(0, 7)
    return allChartData.filter(d => d.isoMes >= cutoff)
  })()

  const periodGrowth = (() => {
    if (chartData.length < 2) return null
    const first = chartData[0].valor
    const last = chartData[chartData.length - 1].valor
    if (!first) return null
    return ((last - first) / first) * 100
  })()

  const handleExportPDF = () => {
    toast.info('Gerando relatório com IA…', { description: 'Esta funcionalidade estará disponível em breve.' })
  }

  return (
    <AppLayout>
      <Topbar title="Evolução Patrimonial" subtitle="Acompanhe o crescimento do seu patrimônio">
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="h-8 appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 cursor-pointer"
            >
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
          </div>
          <Button size="sm" variant="outline" onClick={handleExportPDF}>
            <Download className="h-4 w-4" /> Exportar PDF com IA
          </Button>
        </div>
      </Topbar>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Valor Total Atual"
            value={formatShort(metrics.total)}
            subtitle={`${metrics.totalAquisicao > 0 ? formatBRL(metrics.totalAquisicao) : '—'} investido`}
            icon={DollarSign}
          />
          <MetricCard
            label="Crescimento Total"
            value={`${metrics.crescimento.toFixed(1)}%`}
            subtitle="vs. valor de aquisição"
            icon={TrendingUp}
            trend={metrics.crescimento >= 0 ? 'up' : 'down'}
            trendValue={metrics.crescimento >= 0 ? 'Valorizado' : 'Desvalorizado'}
          />
          <MetricCard
            label="Depreciação Anual"
            value={formatShort(metrics.depreciacao)}
            subtitle="estimativa anual"
            icon={TrendingDown}
          />
          <MetricCard
            label="Maior Aquisição"
            value={formatShort(metrics.maiorAquisicao)}
            subtitle="valor individual"
            icon={Building2}
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-gray-700">Evolução do Patrimônio</p>
                {periodGrowth !== null && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    periodGrowth >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {periodGrowth >= 0 ? '↑' : '↓'} {Math.abs(periodGrowth).toFixed(1)}% no período
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-lg">
                {TABS.map(t => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardBody>
            {loading ? (
              <div className="h-64 bg-gray-50 rounded-lg animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValorEv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => formatShort(v)} />
                  <Tooltip
                    formatter={(v: number) => [formatBRL(v), 'Patrimônio']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="valor" stroke="#3b82f6" strokeWidth={2} fill="url(#colorValorEv)" dot={{ r: 3, fill: '#3b82f6' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>
    </AppLayout>
  )
}
