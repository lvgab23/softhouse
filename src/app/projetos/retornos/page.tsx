'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, DollarSign, Percent, BarChart2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { MetricCard } from '@/components/ui/metric-card'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatBRL, formatShort } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export default function RetornosPage() {
  const [loading, setLoading] = useState(true)
  const [projetos, setProjetos] = useState<any[]>([])
  const [aportes, setAportes] = useState<any[]>([])
  const [alugueis, setAlugueis] = useState<any[]>([])
  const [entradas, setEntradas] = useState<any[]>([])

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const [projetosRes, aportesRes, alugueisRes, entradasRes] = await Promise.all([
        supabase.from('projetos').select('*').order('nome'),
        supabase.from('aportes').select('*, projetos(nome)').order('data', { ascending: false }),
        supabase.from('alugueis').select('*, patrimonios(nome)').eq('status', 'ativo'),
        supabase.from('movimentacoes').select('*').eq('tipo', 'entrada').order('data', { ascending: false }).limit(20),
      ])
      setProjetos(projetosRes.data || [])
      setAportes(aportesRes.data || [])
      setAlugueis(alugueisRes.data || [])
      setEntradas(entradasRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  // ROI per project: (valor_total - total_aportado) / total_aportado
  const projetosROI = projetos.map(p => {
    const aportado = aportes.filter(a => a.projeto_id === p.id).reduce((s, a) => s + (a.valor || 0), 0)
    const roi = aportado > 0 ? (((p.valor_total || 0) - aportado) / aportado * 100) : 0
    return {
      nome: p.nome.length > 16 ? p.nome.slice(0, 16) + '…' : p.nome,
      nomeCompleto: p.nome,
      aportado,
      valorTotal: p.valor_total || 0,
      roi,
      status: p.status,
    }
  }).filter(p => p.aportado > 0 || p.valorTotal > 0)

  const receitaAluguel = alugueis.reduce((s, a) => s + (a.valor_mensal || 0), 0)
  const totalAportado = aportes.reduce((s, a) => s + (a.valor || 0), 0)
  const totalEntradas = entradas.reduce((s, e) => s + (e.valor || 0), 0)
  const roiMedio = projetosROI.length > 0
    ? projetosROI.reduce((s, p) => s + p.roi, 0) / projetosROI.length
    : 0

  return (
    <AppLayout>
      <Topbar title="Retornos" subtitle="Análise de retornos dos seus investimentos e projetos" />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="ROI Médio Projetos" value={`${roiMedio.toFixed(1)}%`} subtitle="retorno médio" icon={Percent} trend={roiMedio >= 0 ? 'up' : 'down'} trendValue={roiMedio >= 0 ? 'Positivo' : 'Negativo'} />
          <MetricCard label="Receita de Aluguéis" value={formatShort(receitaAluguel)} subtitle={`${alugueis.length} contratos ativos`} icon={DollarSign} />
          <MetricCard label="Total Entradas (mês)" value={formatShort(totalEntradas)} subtitle="movimentações de entrada" icon={TrendingUp} />
          <MetricCard label="Total Aportado" value={formatShort(totalAportado)} subtitle="em projetos" icon={BarChart2} />
        </div>

        {projetosROI.length > 0 && (
          <Card>
            <CardHeader>
              <p className="text-sm font-semibold text-gray-700">ROI por Projeto (%)</p>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="h-52 bg-gray-50 rounded-lg animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={projetosROI} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="nome" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                    <Tooltip formatter={(v: number, name: string) => name === 'roi' ? [`${v.toFixed(2)}%`, 'ROI'] : [formatBRL(v), name]} />
                    <Bar dataKey="roi" name="ROI %" radius={[4,4,0,0]}>
                      {projetosROI.map((entry, i) => (
                        <Cell key={i} fill={entry.roi >= 0 ? COLORS[i % COLORS.length] : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardBody>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <p className="text-sm font-semibold text-gray-700">Detalhamento por Projeto</p>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                {projetosROI.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Nenhum projeto com aportes cadastrados</p>
                ) : (
                  projetosROI.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-xs font-medium text-gray-800">{p.nomeCompleto}</p>
                        <p className="text-[10px] text-gray-400">Aportado: {formatBRL(p.aportado)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-gray-900">{formatBRL(p.valorTotal)}</p>
                        <p className={`text-[10px] font-semibold ${p.roi >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {p.roi >= 0 ? '+' : ''}{p.roi.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <p className="text-sm font-semibold text-gray-700">Receitas de Aluguel</p>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                {alugueis.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Nenhum contrato de aluguel ativo</p>
                ) : (
                  alugueis.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-xs font-medium text-gray-800">{a.inquilino}</p>
                        <p className="text-[10px] text-gray-400">{a.patrimonios?.nome}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-green-600">{formatBRL(a.valor_mensal || 0)}/mês</p>
                        <Badge variant="success" className="text-[10px]">Ativo</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
