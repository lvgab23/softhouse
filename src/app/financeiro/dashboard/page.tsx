'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, Clock,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { MetricCard } from '@/components/ui/metric-card'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatBRL, formatShort, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export default function FinanceiroDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [fluxoMensal, setFluxoMensal] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const now = new Date()
    const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const mesFim = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const [allRes, monthRes] = await Promise.all([
      (supabase as any).from('lancamentos').select('*').order('data', { ascending: false }).limit(100),
      (supabase as any).from('lancamentos').select('*').gte('data', mesInicio).lte('data', mesFim),
    ])

    setLancamentos(allRes.data || [])

    // Build 6-month chart data
    const meses = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return {
        label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        inicio: d.toISOString().split('T')[0],
        fim: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0],
      }
    })

    const fluxo = await Promise.all(
      meses.map(async (m) => {
        const res = await (supabase as any).from('lancamentos').select('tipo, valor').gte('data', m.inicio).lte('data', m.fim)
        const rows = res.data || []
        return {
          mes: m.label,
          receitas: rows.filter((r: any) => r.tipo === 'receita').reduce((s: number, r: any) => s + r.valor, 0),
          despesas: rows.filter((r: any) => r.tipo === 'despesa').reduce((s: number, r: any) => s + r.valor, 0),
        }
      })
    )
    setFluxoMensal(fluxo)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const now = new Date()
  const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const mesFim = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const mesLancamentos = lancamentos.filter(l => l.data >= mesInicio && l.data <= mesFim)
  const totalReceitas = mesLancamentos.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0)
  const totalDespesas = mesLancamentos.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0)
  const saldoLiquido = totalReceitas - totalDespesas
  const pendentes = lancamentos.filter(l => l.status === 'pendente').length
  const ultimos5 = lancamentos.slice(0, 5)

  return (
    <AppLayout>
      <Topbar title="Dashboard Financeiro" subtitle="Visão geral do fluxo de caixa" />

      <div className="p-6 space-y-5">
        {loading ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white rounded-xl border border-black/[0.08] animate-pulse" />)}
            </div>
            <div className="h-72 bg-white rounded-xl border border-black/[0.08] animate-pulse" />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Total Receitas"
                value={formatShort(totalReceitas)}
                subtitle="este mês"
                icon={TrendingUp}
                trend="up"
                trendValue="Mês atual"
              />
              <MetricCard
                label="Total Despesas"
                value={formatShort(totalDespesas)}
                subtitle="este mês"
                icon={TrendingDown}
                trend="down"
                trendValue="Mês atual"
              />
              <MetricCard
                label="Saldo Líquido"
                value={formatShort(Math.abs(saldoLiquido))}
                subtitle={saldoLiquido >= 0 ? 'superávit' : 'déficit'}
                icon={Wallet}
                trend={saldoLiquido >= 0 ? 'up' : 'down'}
                trendValue={saldoLiquido >= 0 ? 'Positivo' : 'Negativo'}
              />
              <MetricCard
                label="Pendentes"
                value={String(pendentes)}
                subtitle="lançamentos a confirmar"
                icon={Clock}
              />
            </div>

            <Card>
              <CardHeader>
                <p className="text-sm font-semibold text-gray-700">Receitas vs Despesas — últimos 6 meses</p>
              </CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={fluxoMensal} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => formatShort(v)} />
                    <Tooltip formatter={(v: number) => formatBRL(v)} />
                    <Legend />
                    <Bar dataKey="receitas" name="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <p className="text-sm font-semibold text-gray-700">Últimos 5 Lançamentos</p>
              </CardHeader>
              {ultimos5.length === 0 ? (
                <CardBody>
                  <p className="text-sm text-gray-400 text-center py-6">Nenhum lançamento encontrado</p>
                </CardBody>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Data</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Descrição</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Categoria</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Tipo</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                        <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ultimos5.map((l: any, i: number) => (
                        <tr key={l.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === ultimos5.length - 1 ? 'border-b-0' : ''}`}>
                          <td className="px-5 py-3 text-xs text-gray-500">{formatDate(l.data)}</td>
                          <td className="px-5 py-3 text-sm text-gray-800 font-medium">{l.descricao || '—'}</td>
                          <td className="px-5 py-3 text-xs text-gray-500">{l.categoria || '—'}</td>
                          <td className="px-5 py-3">
                            <Badge variant={l.tipo === 'receita' ? 'success' : 'danger'}>
                              {l.tipo === 'receita' ? 'Receita' : 'Despesa'}
                            </Badge>
                          </td>
                          <td className="px-5 py-3">
                            <Badge variant={l.status === 'confirmado' ? 'success' : l.status === 'cancelado' ? 'danger' : 'warning'}>
                              {l.status === 'confirmado' ? 'Confirmado' : l.status === 'cancelado' ? 'Cancelado' : 'Pendente'}
                            </Badge>
                          </td>
                          <td className={`px-5 py-3 text-right font-semibold text-sm ${l.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                            {l.tipo === 'receita' ? '+' : '-'}{formatBRL(l.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  )
}
