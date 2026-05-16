'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Building2, Car, DollarSign, TrendingUp, TrendingDown,
  Percent, Wallet, CreditCard, Users, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { formatBRL, formatShort } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type BemFilter = 'todos' | 'imovel' | 'bem_movel'

const TIPO_AQUISICAO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  avista:      { label: 'À Vista',      color: '#22c55e', bg: 'bg-green-50'  },
  financiado:  { label: 'Financiado',   color: '#3b82f6', bg: 'bg-blue-50'   },
  consorcio:   { label: 'Consórcio',    color: '#f59e0b', bg: 'bg-amber-50'  },
  misto:       { label: 'Misto',        color: '#8b5cf6', bg: 'bg-purple-50' },
}

function KpiCard({ label, value, sub, icon: Icon, color = 'blue', trend, delta }: any) {
  const clr: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-600 ring-blue-100',
    green:  'bg-green-50 text-green-600 ring-green-100',
    red:    'bg-red-50 text-red-600 ring-red-100',
    amber:  'bg-amber-50 text-amber-600 ring-amber-100',
    purple: 'bg-purple-50 text-purple-600 ring-purple-100',
    gray:   'bg-gray-50 text-gray-500 ring-gray-100',
    teal:   'bg-teal-50 text-teal-600 ring-teal-100',
  }
  return (
    <div className="bg-white rounded-2xl border border-black/[0.07] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ring-1 ${clr[color] ?? clr.blue}`}>
          <Icon size={17} />
        </div>
        {delta && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend === 'up' ? 'text-green-600' : 'text-red-500'}`}>
            {trend === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {delta}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-none mb-0.5">{value}</p>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      {sub && <p className="text-[10px] text-gray-300 mt-0.5">{sub}</p>}
    </div>
  )
}

const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.fill || p.color }} />
            <span className="text-gray-500">{p.name}</span>
          </div>
          <span className="font-semibold">{typeof p.value === 'number' && p.value > 100 ? formatBRL(p.value) : `${p.value}`}</span>
        </div>
      ))}
    </div>
  )
}

export default function BensDashboardPage() {
  const [loading, setLoading]     = useState(true)
  const [patrimonios, setPatri]   = useState<any[]>([])
  const [bensMo, setBensMo]       = useState<any[]>([])
  const [tipoFilter, setTipo]     = useState<BemFilter>('todos')
  const [search, setSearch]       = useState('')
  const [activeTab, setTab]       = useState('Visão Geral')

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const [pRes, bmRes] = await Promise.all([
        sb.from('patrimonios').select('*, categorias(nome)'),
        (sb as any).from('bens_moveis').select('*'),
      ])
      setPatri(pRes.data || [])
      setBensMo(bmRes.error ? [] : (bmRes.data || []))
      setLoading(false)
    }
    load()
  }, [])

  const allBens = useMemo(() => [
    ...patrimonios.map((p: any) => ({
      id: p.id, nome: p.nome, tipo: 'imovel' as const,
      categoria: (p.categorias as any)?.nome || 'Imóvel',
      valor: p.valor_atual || p.valor_aquisicao || 0,
      valorAq: p.valor_aquisicao || 0,
      cidade: p.cidade, estado: p.estado,
      tipo_aquisicao: p.tipo_aquisicao || null,
      avista_valor: p.avista_valor || 0,
      financiamento_valor: p.financiamento_valor || 0,
      consorcio_valor: p.consorcio_valor || 0,
      socio_aquisicao: p.socio_aquisicao || false,
      socio_valor: p.socio_aquisicao_valor || 0,
      socio_nome: p.socio_aquisicao_nome || null,
    })),
    ...bensMo.map((b: any) => ({
      id: b.id, nome: b.nome, tipo: 'bem_movel' as const,
      categoria: b.tipo || 'Bem Móvel',
      valor: b.valor_atual || b.valor_aquisicao || 0,
      valorAq: b.valor_aquisicao || 0,
      cidade: b.cidade, estado: b.estado,
      tipo_aquisicao: null,
      avista_valor: 0, financiamento_valor: 0, consorcio_valor: 0,
      socio_aquisicao: false, socio_valor: 0, socio_nome: null,
    })),
  ], [patrimonios, bensMo])

  const filtrado = useMemo(() => {
    let items = allBens
    if (tipoFilter === 'imovel')    items = items.filter(b => b.tipo === 'imovel')
    if (tipoFilter === 'bem_movel') items = items.filter(b => b.tipo === 'bem_movel')
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(b => b.nome.toLowerCase().includes(q) || b.categoria.toLowerCase().includes(q))
    }
    return items
  }, [allBens, tipoFilter, search])

  // ── Totals ───────────────────────────────────────────────────────────────
  const totalValor   = filtrado.reduce((s, b) => s + b.valor, 0)
  const totalAq      = filtrado.reduce((s, b) => s + b.valorAq, 0)
  const valorizacao  = totalValor - totalAq
  const totalImoveis = filtrado.filter(b => b.tipo === 'imovel').reduce((s, b) => s + b.valor, 0)
  const totalMoveis  = filtrado.filter(b => b.tipo === 'bem_movel').reduce((s, b) => s + b.valor, 0)

  // ── Aquisição breakdown (only imoveis have these fields) ─────────────────
  const aquisicaoBreakdown = useMemo(() => {
    const imoveis = allBens.filter(b => b.tipo === 'imovel')
    let avista = 0, financiado = 0, consorcio = 0, socio = 0, semInfo = 0

    imoveis.forEach(im => {
      avista     += im.avista_valor
      financiado += im.financiamento_valor
      consorcio  += im.consorcio_valor
      socio      += im.socio_valor
      if (!im.avista_valor && !im.financiamento_valor && !im.consorcio_valor) {
        if (im.tipo_aquisicao === 'avista') avista += im.valorAq
        else if (im.tipo_aquisicao === 'financiado') financiado += im.valorAq
        else if (im.tipo_aquisicao === 'consorcio') consorcio += im.valorAq
        else semInfo += im.valorAq
      }
    })

    return [
      { name: 'À Vista',    value: avista,     color: '#22c55e' },
      { name: 'Financiado', value: financiado,  color: '#3b82f6' },
      { name: 'Consórcio',  value: consorcio,  color: '#f59e0b' },
      { name: 'Com Sócio',  value: socio,      color: '#8b5cf6' },
      { name: 'Não informado', value: semInfo, color: '#e2e8f0' },
    ].filter(d => d.value > 0)
  }, [allBens])

  const countByTipoAq = useMemo(() => {
    const map: Record<string, number> = {}
    allBens.filter(b => b.tipo === 'imovel' && b.tipo_aquisicao).forEach(b => {
      const t = b.tipo_aquisicao!
      map[t] = (map[t] || 0) + 1
    })
    return map
  }, [allBens])

  // ── Category distribution ────────────────────────────────────────────────
  const catData = useMemo(() => {
    const map: Record<string, { value: number; tipo: string }> = {}
    filtrado.forEach(b => {
      if (!map[b.categoria]) map[b.categoria] = { value: 0, tipo: b.tipo }
      map[b.categoria].value += b.valor
    })
    return Object.entries(map)
      .map(([name, d]) => ({ name, value: d.value, tipo: d.tipo }))
      .sort((a, b) => b.value - a.value).slice(0, 8)
  }, [filtrado])

  // ── Top 8 by value ───────────────────────────────────────────────────────
  const top8 = useMemo(() =>
    [...filtrado].sort((a, b) => b.valor - a.valor).slice(0, 8).map(b => ({
      ...b,
      nomeShort: b.nome.length > 22 ? b.nome.slice(0, 22) + '…' : b.nome,
      roi: b.valorAq > 0 ? ((b.valor - b.valorAq) / b.valorAq * 100) : 0,
    })),
    [filtrado]
  )

  const donutCompo = [
    { name: 'Imóveis',     value: filtrado.filter(b => b.tipo === 'imovel').reduce((s, b) => s + b.valor, 0),    color: '#3b82f6' },
    { name: 'Bens Móveis', value: filtrado.filter(b => b.tipo === 'bem_movel').reduce((s, b) => s + b.valor, 0), color: '#22c55e' },
  ].filter(d => d.value > 0)

  if (loading) return (
    <AppLayout>
      <Topbar title="Dashboard de Bens" subtitle="Imóveis · Bens Móveis · Capital · ROI" />
      <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />)}
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <Topbar title="Dashboard de Bens" subtitle={`Portfólio completo · ${filtrado.length} ativo(s)`} />

      <div className="p-6 space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-black/[0.08] rounded-2xl px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar bem..."
            className="h-7 w-40 rounded-lg border border-gray-200 bg-gray-50 pl-3 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20" />
          <div className="w-px h-5 bg-gray-200" />
          {([
            { v: 'todos',     l: 'Todos os Bens', active: 'bg-[#0f172a] text-white' },
            { v: 'imovel',    l: 'Imóveis',       active: 'bg-blue-600 text-white' },
            { v: 'bem_movel', l: 'Bens Móveis',   active: 'bg-green-600 text-white' },
          ] as any[]).map(opt => (
            <button key={opt.v} onClick={() => setTipo(opt.v as BemFilter)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${tipoFilter === opt.v ? opt.active : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {opt.l}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 bg-white border border-black/[0.08] p-1 rounded-xl">
            {['Visão Geral','Forma de Aquisição','Ranking'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === t ? 'bg-[#0f172a] text-white' : 'text-gray-500 hover:text-gray-800'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ TAB: VISÃO GERAL ═══ */}
        {activeTab === 'Visão Geral' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Valor Total dos Bens" value={formatShort(totalValor)} sub={`${filtrado.length} ativo(s)`} icon={Wallet} color="blue"
                trend={valorizacao >= 0 ? 'up' : 'down'} delta={`${valorizacao >= 0 ? '+' : ''}${formatShort(valorizacao)}`} />
              <KpiCard label="Imóveis" value={formatShort(totalImoveis)} sub={`${filtrado.filter(b => b.tipo === 'imovel').length} imóvel(eis)`} icon={Building2} color="blue" />
              <KpiCard label="Bens Móveis" value={formatShort(totalMoveis)} sub={`${filtrado.filter(b => b.tipo === 'bem_movel').length} bem(ns)`} icon={Car} color="green" />
              <KpiCard label="ROI Médio"
                value={`${totalAq > 0 ? ((valorizacao / totalAq) * 100).toFixed(1) : '0'}%`}
                sub={valorizacao >= 0 ? `+${formatShort(valorizacao)} valorizado` : `${formatShort(valorizacao)} desvalorizado`}
                icon={valorizacao >= 0 ? TrendingUp : TrendingDown}
                color={valorizacao >= 0 ? 'green' : 'red'}
                trend={valorizacao >= 0 ? 'up' : 'down'} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Composition donut */}
              <div className="bg-white rounded-2xl border border-black/[0.07] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Composição do Portfólio</h3>
                {donutCompo.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-10">Nenhum bem cadastrado</p>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={donutCompo} cx="50%" cy="50%" outerRadius={70} innerRadius={40} dataKey="value" paddingAngle={3}>
                          {donutCompo.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="w-full space-y-2">
                      {donutCompo.map(e => (
                        <div key={e.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
                            <span className="text-gray-600">{e.name}</span>
                          </div>
                          <span className="font-semibold text-gray-900">{formatShort(e.value)} <span className="text-gray-400">({totalValor > 0 ? (e.value/totalValor*100).toFixed(0) : 0}%)</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Top bens bar */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-black/[0.07] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Ativos por Valor</h3>
                {top8.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-10">Nenhum bem</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={top8} layout="vertical" barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="nomeShort" tick={{ fontSize: 10, fill: '#64748b' }} width={130} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="valor" name="Valor Atual" radius={[0,4,4,0]}>
                        {top8.map((b, i) => <Cell key={i} fill={b.tipo === 'imovel' ? '#3b82f6' : '#22c55e'} fillOpacity={0.85} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Category distribution */}
            <div className="bg-white rounded-2xl border border-black/[0.07] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribuição por Categoria</h3>
              <div className="space-y-3">
                {catData.length === 0 ? <p className="text-xs text-gray-300 text-center py-4">Sem dados</p>
                : catData.map((c, i) => {
                  const pct = totalValor > 0 ? (c.value / totalValor * 100) : 0
                  const color = c.tipo === 'imovel' ? '#3b82f6' : '#22c55e'
                  return (
                    <div key={c.name}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                          <span className="text-xs text-gray-700">{c.name}</span>
                          <span className="text-[10px] text-gray-400">{c.tipo === 'imovel' ? 'Imóvel' : 'Bem Móvel'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400">{pct.toFixed(1)}%</span>
                          <span className="text-xs font-bold text-gray-900">{formatBRL(c.value)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: FORMA DE AQUISIÇÃO ═══ */}
        {activeTab === 'Forma de Aquisição' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { k: 'avista',     label: 'À Vista',    icon: DollarSign, color: 'green' },
                { k: 'financiado', label: 'Financiado', icon: CreditCard, color: 'blue'  },
                { k: 'consorcio',  label: 'Consórcio',  icon: Wallet,     color: 'amber' },
                { k: 'socio',      label: 'Com Sócio',  icon: Users,      color: 'purple'},
              ].map(({ k, label, icon, color }) => {
                const v = aquisicaoBreakdown.find(a => a.name.toLowerCase().includes(k === 'socio' ? 'sócio' : k.substring(0,3)))?.value || 0
                const cnt = k === 'socio'
                  ? allBens.filter(b => b.tipo === 'imovel' && b.socio_aquisicao).length
                  : (countByTipoAq[k] || 0)
                return (
                  <KpiCard key={k} label={label} value={formatShort(v)}
                    sub={`${cnt} imóvel(eis)`} icon={icon} color={color as any} />
                )
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Donut aquisição */}
              <div className="bg-white rounded-2xl border border-black/[0.07] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Forma de Aquisição dos Imóveis</h3>
                {aquisicaoBreakdown.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-10">Cadastre imóveis com forma de aquisição para ver este gráfico</p>
                ) : (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width="50%" height={200}>
                      <PieChart>
                        <Pie data={aquisicaoBreakdown} cx="50%" cy="50%" outerRadius={85} innerRadius={50} dataKey="value" paddingAngle={2}>
                          {aquisicaoBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2.5">
                      {aquisicaoBreakdown.map(e => {
                        const total = aquisicaoBreakdown.reduce((s, a) => s + a.value, 0)
                        const pct = total > 0 ? (e.value / total * 100) : 0
                        return (
                          <div key={e.name}>
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
                                <span className="text-[11px] text-gray-600">{e.name}</span>
                              </div>
                              <span className="text-[11px] font-semibold text-gray-800">{pct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: e.color }} />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">{formatBRL(e.value)}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Table of imoveis with acquisition details */}
              <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">Imóveis — Detalhes de Aquisição</h3>
                </div>
                <div className="overflow-y-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50 sticky top-0">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">Nome</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">Tipo Aquisição</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500">Valor</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">Sócio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allBens.filter(b => b.tipo === 'imovel').map((im, i) => {
                        const cfg = im.tipo_aquisicao ? TIPO_AQUISICAO_CONFIG[im.tipo_aquisicao] : null
                        return (
                          <tr key={im.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === allBens.filter(b => b.tipo === 'imovel').length - 1 ? 'border-b-0' : ''}`}>
                            <td className="px-4 py-2.5 font-medium text-gray-900 truncate max-w-[120px]">{im.nome}</td>
                            <td className="px-4 py-2.5">
                              {cfg ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg}`} style={{ color: cfg.color }}>
                                  {cfg.label}
                                </span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{formatShort(im.valor)}</td>
                            <td className="px-4 py-2.5 text-[10px] text-gray-500">{im.socio_aquisicao ? (im.socio_nome || 'Sim') : '—'}</td>
                          </tr>
                        )
                      })}
                      {allBens.filter(b => b.tipo === 'imovel').length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-300">Nenhum imóvel cadastrado</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Stacked bar per imovel showing financing breakdown */}
            {allBens.filter(b => b.tipo === 'imovel' && (b.avista_valor || b.financiamento_valor || b.consorcio_valor || b.socio_valor)).length > 0 && (
              <div className="bg-white rounded-2xl border border-black/[0.07] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Composição do Capital por Imóvel</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={allBens.filter(b => b.tipo === 'imovel' && (b.avista_valor || b.financiamento_valor || b.consorcio_valor || b.socio_valor))
                      .map(im => ({
                        nome: im.nome.length > 18 ? im.nome.slice(0, 18) + '…' : im.nome,
                        avista: im.avista_valor,
                        financiado: im.financiamento_valor,
                        consorcio: im.consorcio_valor,
                        socio: im.socio_valor,
                      }))}
                    barSize={18}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="nome" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShort} axisLine={false} width={44} />
                    <Tooltip content={<ChartTip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="avista"     name="À Vista"    stackId="a" fill="#22c55e" />
                    <Bar dataKey="financiado" name="Financiado" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="consorcio"  name="Consórcio"  stackId="a" fill="#f59e0b" />
                    <Bar dataKey="socio"      name="Sócio"      stackId="a" fill="#8b5cf6" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: RANKING ═══ */}
        {activeTab === 'Ranking' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Maior Ativo" value={top8.length > 0 ? formatShort(top8[0].valor) : '—'} sub={top8[0]?.nome || '—'} icon={TrendingUp} color="blue" />
              <KpiCard label="Melhor ROI" value={top8.length > 0 ? `${[...top8].sort((a,b) => b.roi - a.roi)[0]?.roi.toFixed(1)}%` : '—'} sub="valorização" icon={Percent} color="green" />
              <KpiCard label="Custo Total de Aquisição" value={formatShort(totalAq)} sub="valor pago histórico" icon={DollarSign} color="gray" />
              <KpiCard label="Valorização Total" value={formatShort(Math.abs(valorizacao))} sub={valorizacao >= 0 ? 'acima do custo' : 'abaixo do custo'} icon={valorizacao >= 0 ? ArrowUpRight : ArrowDownRight} color={valorizacao >= 0 ? 'green' : 'red'} trend={valorizacao >= 0 ? 'up' : 'down'} />
            </div>

            <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Ranking Completo de Bens</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">#</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nome</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tipo</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Categoria</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Aquisição</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor Atual</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valorização</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filtrado].sort((a, b) => b.valor - a.valor).map((b, i) => {
                      const val = b.valor - b.valorAq
                      const roi = b.valorAq > 0 ? (val / b.valorAq * 100) : 0
                      return (
                        <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-5 py-3 text-xs text-gray-400">{i+1}</td>
                          <td className="px-4 py-3 text-xs font-medium text-gray-900">{b.nome}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${b.tipo === 'imovel' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                              {b.tipo === 'imovel' ? 'Imóvel' : 'Bem Móvel'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{b.categoria}</td>
                          <td className="px-4 py-3 text-xs text-right text-gray-500">{b.valorAq ? formatBRL(b.valorAq) : '—'}</td>
                          <td className="px-4 py-3 text-xs text-right font-semibold text-gray-900">{formatBRL(b.valor)}</td>
                          <td className="px-4 py-3 text-xs text-right font-semibold">
                            {b.valorAq ? <span className={val >= 0 ? 'text-green-600' : 'text-red-500'}>{val >= 0 ? '+' : ''}{formatBRL(val)}</span> : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-right font-bold">
                            {b.valorAq ? <span className={roi >= 0 ? 'text-green-600' : 'text-red-500'}>{roi >= 0 ? '+' : ''}{roi.toFixed(1)}%</span> : '—'}
                          </td>
                        </tr>
                      )
                    })}
                    {filtrado.length === 0 && (
                      <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-gray-300">Nenhum bem encontrado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
