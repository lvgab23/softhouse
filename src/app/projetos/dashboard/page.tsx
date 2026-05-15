'use client'

import { useEffect, useState, useMemo } from 'react'
import { FolderOpen, DollarSign, User, Users, ChevronDown, Search } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
  PieChart, Pie,
} from 'recharts'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { MetricCard } from '@/components/ui/metric-card'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatBRL, formatShort } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export default function ProjetosDashboardPage() {
  const [projetos, setProjetos] = useState<any[]>([])
  const [aportes, setAportes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState('todos')

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const [p, a] = await Promise.all([
        supabase.from('projetos').select('*').order('nome'),
        supabase.from('aportes').select('*'),
      ])
      setProjetos(p.data || [])
      setAportes(a.data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  // Per-project breakdown
  const projetoBreakdown = useMemo(() => projetos.map((proj: any) => {
    const projAportes = aportes.filter((a: any) => a.projeto_id === proj.id)
    const meuAporte = projAportes
      .filter((a: any) => a.tipo !== 'aporte_socio')
      .reduce((s: number, a: any) => s + (a.valor || 0), 0)
    const socioAporte = projAportes
      .filter((a: any) => a.tipo === 'aporte_socio')
      .reduce((s: number, a: any) => s + (a.valor || 0), 0)
    const total = meuAporte + socioAporte
    return {
      id: proj.id,
      nome: proj.nome,
      status: proj.status,
      previsto: proj.valor_total || 0,
      meuAporte,
      socioAporte,
      total,
      meuPct: total > 0 ? (meuAporte / total) * 100 : 100,
      socioPct: total > 0 ? (socioAporte / total) * 100 : 0,
      nomeShort: proj.nome.length > 18 ? proj.nome.slice(0, 18) + '…' : proj.nome,
    }
  }), [projetos, aportes])

  // Apply project filter
  const breakdown = useMemo(() =>
    selectedProject === 'todos'
      ? projetoBreakdown.filter(p => p.total > 0)
      : projetoBreakdown.filter(p => p.id === selectedProject),
    [projetoBreakdown, selectedProject]
  )

  const projetoSelecionado = selectedProject !== 'todos'
    ? projetos.find(p => p.id === selectedProject)
    : null

  const totalMeu = breakdown.reduce((s, p) => s + p.meuAporte, 0)
  const totalSocio = breakdown.reduce((s, p) => s + p.socioAporte, 0)
  const totalGeral = totalMeu + totalSocio
  const totalProjetos = projetos.length
  const ativos = projetos.filter((p: any) => p.status === 'ativo').length

  const pieData = [
    { name: 'Meu Aporte', value: totalMeu, color: '#3b82f6' },
    { name: 'Aporte de Sócios', value: totalSocio, color: '#8b5cf6' },
  ].filter(d => d.value > 0)

  if (loading) {
    return (
      <AppLayout>
        <Topbar title="Dashboard de Projetos" subtitle="Aportes e participação societária" />
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white rounded-xl border border-black/[0.08] animate-pulse" />)}
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <Topbar title="Dashboard de Projetos" subtitle="Aportes e participação societária" />

      <div className="p-6 space-y-5">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-black/[0.08] px-4 py-3">
          <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <span className="text-xs font-medium text-gray-500">Visualizando:</span>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedProject('todos')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedProject === 'todos'
                    ? 'bg-[#0f172a] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Todos os projetos
              </button>
              {projetos.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProject(p.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedProject === p.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p.nome}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label={projetoSelecionado ? 'Projeto' : 'Total de Projetos'}
            value={projetoSelecionado ? '1' : String(totalProjetos)}
            subtitle={projetoSelecionado ? projetoSelecionado.nome : `${ativos} ativos`}
            icon={FolderOpen}
          />
          <MetricCard label="Total Aportado" value={formatShort(totalGeral)} subtitle={projetoSelecionado ? 'neste projeto' : 'todos os projetos'} icon={DollarSign} />
          <MetricCard
            label="Meu Aporte"
            value={formatShort(totalMeu)}
            subtitle={totalGeral > 0 ? `${((totalMeu / totalGeral) * 100).toFixed(0)}% do total` : '—'}
            icon={User}
          />
          <MetricCard
            label="Aporte de Sócios"
            value={formatShort(totalSocio)}
            subtitle={totalGeral > 0 ? `${((totalSocio / totalGeral) * 100).toFixed(0)}% do total` : '—'}
            icon={Users}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Ownership pie */}
          <Card>
            <CardHeader>
              <p className="text-sm font-semibold text-gray-700">Composição dos Aportes</p>
            </CardHeader>
            <CardBody>
              {pieData.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">Nenhum aporte registrado</p>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={78} innerRadius={44} dataKey="value" paddingAngle={3}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBRL(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full space-y-2.5">
                    {pieData.map(entry => (
                      <div key={entry.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                          <span className="text-gray-600">{entry.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-gray-900">{formatShort(entry.value)}</span>
                          <span className="text-gray-400 ml-1">({totalGeral > 0 ? ((entry.value / totalGeral) * 100).toFixed(0) : 0}%)</span>
                        </div>
                      </div>
                    ))}
                    {totalGeral > 0 && (
                      <div className="pt-2 border-t border-gray-100 flex justify-between text-xs">
                        <span className="text-gray-500 font-medium">Total</span>
                        <span className="font-bold text-gray-900">{formatShort(totalGeral)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Stacked bar */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <p className="text-sm font-semibold text-gray-700">
                {projetoSelecionado ? `Aportes — ${projetoSelecionado.nome}` : 'Aportes por Projeto — Próprio vs. Sócios'}
              </p>
            </CardHeader>
            <CardBody>
              {breakdown.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">Nenhum aporte para exibir</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={breakdown} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="nomeShort" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => formatShort(v)} />
                    <Tooltip formatter={(v: number, name: string) => [formatBRL(v), name]} />
                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="meuAporte" name="Meu Aporte" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="socioAporte" name="Sócios" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Participation table */}
        {breakdown.length > 0 && (
          <Card>
            <CardHeader>
              <p className="text-sm font-semibold text-gray-700">Participação por Projeto</p>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Projeto</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Meu Aporte</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Sócios</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Total</th>
                      <th className="px-5 py-3 text-xs font-medium text-gray-500 min-w-[160px]">Minha Participação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((p, i) => (
                      <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === breakdown.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-5 py-3 font-medium text-gray-900">{p.nome}</td>
                        <td className="px-5 py-3"><Badge variant={p.status === 'ativo' ? 'success' : 'gray'}>{p.status}</Badge></td>
                        <td className="px-5 py-3 text-right text-blue-600 font-semibold text-xs">{formatBRL(p.meuAporte)}</td>
                        <td className="px-5 py-3 text-right text-purple-600 font-semibold text-xs">{formatBRL(p.socioAporte)}</td>
                        <td className="px-5 py-3 text-right font-bold text-gray-900 text-xs">{formatBRL(p.total)}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-purple-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.meuPct}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-gray-700 w-8 text-right">{p.meuPct.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50/50">
                      <td colSpan={2} className="px-5 py-2.5 text-xs font-semibold text-gray-600">Total</td>
                      <td className="px-5 py-2.5 text-right text-blue-700 font-bold text-xs">{formatBRL(totalMeu)}</td>
                      <td className="px-5 py-2.5 text-right text-purple-700 font-bold text-xs">{formatBRL(totalSocio)}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-gray-900 text-xs">{formatBRL(totalGeral)}</td>
                      <td className="px-5 py-2.5 text-xs font-semibold text-gray-600">
                        {totalGeral > 0 ? ((totalMeu / totalGeral) * 100).toFixed(0) : 0}% próprio
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Project cards grid — only in "todos" view */}
        {selectedProject === 'todos' && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-3">Todos os Projetos</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projetos.map((p: any) => {
                const b = projetoBreakdown.find(bd => bd.id === p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProject(p.id)}
                    className="bg-white rounded-xl border border-black/[0.08] p-4 text-left hover:border-blue-200 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-gray-900 text-sm truncate pr-2">{p.nome}</p>
                      <Badge variant={p.status === 'ativo' ? 'success' : 'gray'}>{p.status}</Badge>
                    </div>
                    {p.valor_total ? (
                      <p className="text-xs text-gray-500 mb-3">Previsto: <span className="font-semibold text-gray-700">{formatBRL(p.valor_total)}</span></p>
                    ) : null}
                    {b && b.total > 0 ? (
                      <div className="pt-3 border-t border-gray-100">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-blue-600 font-medium">Meu: {formatShort(b.meuAporte)}</span>
                          {b.socioAporte > 0 && <span className="text-purple-600 font-medium">Sócio: {formatShort(b.socioAporte)}</span>}
                          <span className="font-bold text-gray-700">{b.meuPct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-purple-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${b.meuPct}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Total: {formatBRL(b.total)}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Sem aportes</p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
