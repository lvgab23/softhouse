'use client'

import { useEffect, useState, useMemo } from 'react'
import { Building2, DollarSign, Car, TrendingUp, TrendingDown, Search } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { MetricCard } from '@/components/ui/metric-card'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatBRL, formatShort } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type BemFilter = 'todos' | 'imovel' | 'bem_movel'

export default function BensDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [patrimonios, setPatrimonios] = useState<any[]>([])
  const [bensMo, setBensMo] = useState<any[]>([])
  const [retornos, setRetornos] = useState<any[]>([])
  const [bmTableExists, setBmTableExists] = useState(true)
  const [tipoFilter, setTipoFilter] = useState<BemFilter>('todos')
  const [searchBem, setSearchBem] = useState('')

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const [pRes, bmRes, rRes] = await Promise.all([
        supabase.from('patrimonios').select('id, nome, valor_aquisicao, valor_atual, status, categorias(nome)'),
        (supabase as any).from('bens_moveis').select('id, nome, tipo, valor_aquisicao, valor_atual, status, marca, modelo'),
        (supabase as any).from('retornos_imobiliarios').select('data, valor').order('data', { ascending: false }),
      ])
      setPatrimonios(pRes.data || [])
      if (bmRes.error?.code === '42P01') {
        setBmTableExists(false)
      } else {
        setBensMo(bmRes.data || [])
      }
      setRetornos(rRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  // Combine all bens
  const todosOsBens = useMemo(() => [
    ...patrimonios.map((p: any) => ({
      id: p.id, nome: p.nome, categoria: 'Imóvel', tipo: 'imovel' as const,
      valor: p.valor_atual || p.valor_aquisicao || 0,
      valorAquisicao: p.valor_aquisicao || 0,
      subtipo: (p.categorias as any)?.nome || '',
    })),
    ...bensMo.map((b: any) => ({
      id: b.id, nome: b.nome, categoria: 'Bem Móvel', tipo: 'bem_movel' as const,
      valor: b.valor_atual || b.valor_aquisicao || 0,
      valorAquisicao: b.valor_aquisicao || 0,
      subtipo: b.marca ? `${b.marca}${b.modelo ? ' ' + b.modelo : ''}` : (b.tipo || ''),
    })),
  ], [patrimonios, bensMo])

  // Apply filters
  const bensFiltrados = useMemo(() => {
    let items = todosOsBens
    if (tipoFilter === 'imovel') items = items.filter(b => b.tipo === 'imovel')
    else if (tipoFilter === 'bem_movel') items = items.filter(b => b.tipo === 'bem_movel')
    if (searchBem.trim()) {
      const q = searchBem.toLowerCase()
      items = items.filter(b =>
        b.nome.toLowerCase().includes(q) || b.subtipo.toLowerCase().includes(q)
      )
    }
    return items
  }, [todosOsBens, tipoFilter, searchBem])

  const totalValor = bensFiltrados.reduce((s, b) => s + b.valor, 0)
  const totalImoveis = bensFiltrados.filter(b => b.tipo === 'imovel').reduce((s, b) => s + b.valor, 0)
  const totalMoveis = bensFiltrados.filter(b => b.tipo === 'bem_movel').reduce((s, b) => s + b.valor, 0)
  const totalAquisicao = bensFiltrados.reduce((s, b) => s + b.valorAquisicao, 0)
  const valorizacao = totalValor - totalAquisicao

  // Donut
  const donutData = [
    { name: 'Imóveis', value: totalImoveis, color: '#3b82f6' },
    { name: 'Bens Móveis', value: totalMoveis, color: '#22c55e' },
  ].filter(d => d.value > 0)

  // Top assets by value
  const top8 = useMemo(() =>
    [...bensFiltrados]
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8)
      .map(b => ({
        ...b,
        nomeShort: b.nome.length > 22 ? b.nome.slice(0, 22) + '…' : b.nome,
        roi: b.valorAquisicao > 0 ? ((b.valor - b.valorAquisicao) / b.valorAquisicao) * 100 : 0,
      })),
    [bensFiltrados]
  )

  // Monthly retornos
  const now = new Date()
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  })
  const monthlyMap: Record<string, number> = {}
  meses.forEach(m => { monthlyMap[m] = 0 })
  retornos.forEach((r: any) => {
    if (!r.data) return
    const key = new Date(r.data + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    if (key in monthlyMap) monthlyMap[key] += (r.valor || 0)
  })
  const areaData = meses.map(mes => ({ mes, valor: monthlyMap[mes] || 0 }))

  if (loading) {
    return (
      <AppLayout>
        <Topbar title="Dashboard de Bens" subtitle="Portfólio completo: imóveis e bens móveis" />
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
      <Topbar title="Dashboard de Bens" subtitle={`Portfólio completo · ${bensFiltrados.length} ativo(s)`} />

      <div className="p-6 space-y-5">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-black/[0.08] px-4 py-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              value={searchBem}
              onChange={e => setSearchBem(e.target.value)}
              placeholder="Buscar bem..."
              className="h-7 w-44 rounded-lg border border-gray-200 bg-gray-50 pl-2 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
            />
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <span className="text-xs font-medium text-gray-500">Filtrar por:</span>
          <div className="flex gap-1.5">
            {([
              { value: 'todos', label: 'Todos os bens' },
              { value: 'imovel', label: 'Imóveis' },
              { value: 'bem_movel', label: 'Bens Móveis' },
            ] as { value: BemFilter; label: string }[]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setTipoFilter(opt.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  tipoFilter === opt.value
                    ? opt.value === 'imovel' ? 'bg-blue-600 text-white'
                    : opt.value === 'bem_movel' ? 'bg-green-600 text-white'
                    : 'bg-[#0f172a] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {(tipoFilter !== 'todos' || searchBem) && (
            <button
              onClick={() => { setTipoFilter('todos'); setSearchBem('') }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Valor Total dos Bens"
            value={formatShort(totalValor)}
            subtitle={`${bensFiltrados.length} ativo(s) filtrado(s)`}
            icon={DollarSign}
            trend={valorizacao >= 0 ? 'up' : 'down'}
            trendValue={`${valorizacao >= 0 ? '+' : ''}${formatShort(valorizacao)} vs. aquisição`}
          />
          <MetricCard
            label="Imóveis"
            value={formatShort(totalImoveis)}
            subtitle={`${bensFiltrados.filter(b => b.tipo === 'imovel').length} imóvel(eis)`}
            icon={Building2}
          />
          <MetricCard
            label="Bens Móveis"
            value={formatShort(totalMoveis)}
            subtitle={`${bensFiltrados.filter(b => b.tipo === 'bem_movel').length} bem(ns)`}
            icon={Car}
          />
          <MetricCard
            label="Valorização"
            value={`${totalAquisicao > 0 ? ((valorizacao / totalAquisicao) * 100).toFixed(1) : '0'}%`}
            subtitle={valorizacao >= 0 ? `+${formatShort(valorizacao)} acumulado` : `${formatShort(valorizacao)} desvalorizado`}
            icon={valorizacao >= 0 ? TrendingUp : TrendingDown}
            trend={valorizacao >= 0 ? 'up' : 'down'}
          />
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Donut */}
          <Card>
            <CardHeader>
              <p className="text-sm font-semibold text-gray-700">Composição do Portfólio</p>
            </CardHeader>
            <CardBody>
              {donutData.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">Nenhum bem</p>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" outerRadius={70} innerRadius={40} dataKey="value" paddingAngle={3}>
                        {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBRL(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full space-y-2">
                    {donutData.map(entry => (
                      <div key={entry.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
                          <span className="text-gray-600">{entry.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-gray-900">{formatShort(entry.value)}</span>
                          <span className="text-gray-400 ml-1">({totalValor > 0 ? ((entry.value / totalValor) * 100).toFixed(0) : 0}%)</span>
                        </div>
                      </div>
                    ))}
                    {totalValor > 0 && (
                      <div className="pt-2 border-t border-gray-100 flex justify-between text-xs">
                        <span className="text-gray-500 font-medium">Total</span>
                        <span className="font-bold text-gray-900">{formatShort(totalValor)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Top assets horizontal bar */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-gray-700">Top Ativos por Valor</p>
                <div className="flex items-center gap-3 text-[10px] text-gray-400 ml-auto">
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-blue-500" /> Imóvel</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-green-500" /> Bem Móvel</span>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              {top8.length === 0 ? (
                <EmptyState title="Nenhum bem encontrado" description="Ajuste os filtros ou cadastre novos bens" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={top8} layout="vertical" barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => formatShort(v)} />
                    <YAxis type="category" dataKey="nomeShort" tick={{ fontSize: 10, fill: '#64748b' }} width={130} />
                    <Tooltip formatter={(v: number) => formatBRL(v)} />
                    <Bar dataKey="valor" name="Valor Atual" radius={[0, 4, 4, 0]}>
                      {top8.map((entry, i) => (
                        <Cell key={i} fill={entry.tipo === 'imovel' ? '#3b82f6' : '#22c55e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Area chart */}
          <Card>
            <CardHeader>
              <p className="text-sm font-semibold text-gray-700">Retornos Imobiliários — Últimos 6 Meses</p>
            </CardHeader>
            <CardBody>
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={areaData}>
                  <defs>
                    <linearGradient id="gradRetorno" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => formatShort(v)} />
                  <Tooltip formatter={(v: number) => [formatBRL(v), 'Retorno']} />
                  <Area type="monotone" dataKey="valor" stroke="#3b82f6" strokeWidth={2} fill="url(#gradRetorno)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          {/* ROI table */}
          <Card>
            <CardHeader>
              <p className="text-sm font-semibold text-gray-700">Ranking por ROI</p>
            </CardHeader>
            <CardBody className="p-0">
              {top8.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum dado</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Ativo</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Valor</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">ROI%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...top8].sort((a, b) => b.roi - a.roi).map((b, i) => (
                      <tr key={b.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === top8.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-900 text-xs">{b.nome}</p>
                          <p className="text-[10px] text-gray-400">{b.categoria}{b.subtipo ? ` · ${b.subtipo}` : ''}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-900">{formatShort(b.valor)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`text-xs font-bold ${b.roi > 0 ? 'text-green-600' : b.roi < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {b.roi > 0 ? '+' : ''}{b.roi.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </div>

        {!bmTableExists && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-amber-800 mb-1">Tabela de Bens Móveis não encontrada</p>
            <p className="text-xs text-amber-700 mb-3">Execute no SQL Editor do Supabase:</p>
            <pre className="text-[10px] bg-white rounded-lg p-3 border border-amber-100 overflow-x-auto text-gray-700 select-all leading-relaxed">
{`CREATE TABLE IF NOT EXISTS bens_moveis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, nome TEXT NOT NULL, tipo TEXT DEFAULT 'automovel',
  marca TEXT, modelo TEXT, ano INTEGER, placa TEXT,
  valor_aquisicao DECIMAL(15,2), valor_atual DECIMAL(15,2),
  data_aquisicao DATE, status TEXT DEFAULT 'ativo',
  cidade TEXT, estado TEXT, notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bens_moveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bens_moveis" ON bens_moveis
  FOR ALL USING (auth.uid() = user_id);`}
            </pre>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
