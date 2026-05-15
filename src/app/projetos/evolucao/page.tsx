'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, DollarSign, FolderOpen, BarChart2, ChevronDown } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { MetricCard } from '@/components/ui/metric-card'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { formatBRL, formatShort } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const PERIODS = [
  { value: 'all', label: 'Todo o período' },
  { value: '12m', label: 'Últimos 12 meses' },
  { value: '6m', label: 'Últimos 6 meses' },
  { value: '3m', label: 'Últimos 3 meses' },
]

export default function ProjetosEvolucaoPage() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')
  const [projetos, setProjetos] = useState<any[]>([])
  const [aportes, setAportes] = useState<any[]>([])

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const [projetosRes, aportesRes] = await Promise.all([
        supabase.from('projetos').select('*').order('created_at'),
        supabase.from('aportes').select('*, projetos(nome)').order('data'),
      ])
      setProjetos(projetosRes.data || [])
      setAportes(aportesRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const filteredAportes = (() => {
    if (period === 'all') return aportes
    const now = new Date()
    const months = period === '12m' ? 12 : period === '6m' ? 6 : 3
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1).toISOString().slice(0, 10)
    return aportes.filter(a => a.data >= cutoff)
  })()

  const totalInvestido = filteredAportes.reduce((s, a) => s + (a.valor || 0), 0)
  const totalProjetos = projetos.length
  const projetosAtivos = projetos.filter(p => p.status === 'ativo').length
  const totalCarteira = projetos.reduce((s, p) => s + (p.valor_total || 0), 0)

  // Accumulate aportes by month
  const monthMap: Record<string, number> = {}
  let acc = 0
  filteredAportes
    .filter(a => a.data)
    .forEach(a => {
      const mes = a.data.slice(0, 7)
      acc += a.valor || 0
      monthMap[mes] = acc
    })

  const chartData = Object.entries(monthMap).map(([mes, valor]) => ({
    mes: new Date(mes + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
    valor,
  }))

  if (!monthMap[Object.keys(monthMap)[0]] && chartData.length === 0) {
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      chartData.push({ mes: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), valor: 0 })
    }
  }

  // Aportes per project (bar chart)
  const porProjeto = projetos.map(p => ({
    nome: p.nome.length > 14 ? p.nome.slice(0, 14) + '…' : p.nome,
    aportado: filteredAportes.filter(a => a.projeto_id === p.id).reduce((s, a) => s + (a.valor || 0), 0),
    total: p.valor_total || 0,
  })).filter(p => p.total > 0 || p.aportado > 0)

  return (
    <AppLayout>
      <Topbar title="Evolução de Projetos" subtitle="Acompanhe o crescimento dos seus projetos">
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
      </Topbar>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total de Projetos" value={String(totalProjetos)} subtitle={`${projetosAtivos} ativos`} icon={FolderOpen} />
          <MetricCard label="Carteira de Projetos" value={formatShort(totalCarteira)} subtitle="valor total previsto" icon={DollarSign} />
          <MetricCard label="Total Aportado" value={formatShort(totalInvestido)} subtitle="no período selecionado" icon={TrendingUp} />
          <MetricCard label="Aportes" value={String(filteredAportes.length)} subtitle="lançamentos" icon={BarChart2} />
        </div>

        <Card>
          <CardHeader>
            <p className="text-sm font-semibold text-gray-700">Evolução Acumulada de Aportes</p>
          </CardHeader>
          <CardBody>
            {loading ? (
              <div className="h-64 bg-gray-50 rounded-lg animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAporte" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => formatShort(v)} />
                  <Tooltip formatter={(v: number) => [formatBRL(v), 'Aportado']} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Area type="monotone" dataKey="valor" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorAporte)" dot={{ r: 3, fill: '#8b5cf6' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        {porProjeto.length > 0 && (
          <Card>
            <CardHeader>
              <p className="text-sm font-semibold text-gray-700">Aportes vs. Meta por Projeto</p>
            </CardHeader>
            <CardBody>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={porProjeto} barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="nome" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => formatShort(v)} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Bar dataKey="aportado" name="Aportado" fill="#8b5cf6" radius={[4,4,0,0]} />
                  <Bar dataKey="total" name="Meta" fill="#e2e8f0" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
