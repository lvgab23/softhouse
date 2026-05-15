'use client'

import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, TrendingDown, BarChart2, Percent, ChevronDown } from 'lucide-react'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { MetricCard } from '@/components/ui/metric-card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatBRL, formatShort } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface DREItem {
  categoria: string
  receitas: number
  despesas: number
  resultado: number
}

export default function DREPage() {
  const [items, setItems] = useState<DREItem[]>([])
  const [loading, setLoading] = useState(true)
  const [ano, setAno] = useState(new Date().getFullYear())

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await (supabase as any)
      .from('lancamentos')
      .select('tipo, valor, categoria, status')
      .gte('data', `${ano}-01-01`)
      .lte('data', `${ano}-12-31`)
      .neq('status', 'cancelado')

    const grouped: Record<string, { receitas: number; despesas: number }> = {}
    ;(data || []).forEach((l: any) => {
      const cat = l.categoria || 'Sem categoria'
      if (!grouped[cat]) grouped[cat] = { receitas: 0, despesas: 0 }
      if (l.tipo === 'receita') grouped[cat].receitas += l.valor || 0
      else grouped[cat].despesas += l.valor || 0
    })

    const result: DREItem[] = Object.entries(grouped)
      .map(([categoria, { receitas, despesas }]) => ({
        categoria,
        receitas,
        despesas,
        resultado: receitas - despesas,
      }))
      .sort((a, b) => Math.abs(b.resultado) - Math.abs(a.resultado))

    setItems(result)
    setLoading(false)
  }, [ano])

  useEffect(() => { fetchData() }, [fetchData])

  const totalReceitas = items.reduce((s, i) => s + i.receitas, 0)
  const totalDespesas = items.reduce((s, i) => s + i.despesas, 0)
  const resultadoLiquido = totalReceitas - totalDespesas
  const margemLiquida = totalReceitas > 0 ? (resultadoLiquido / totalReceitas) * 100 : 0

  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  return (
    <AppLayout>
      <Topbar title="DRE" subtitle="Demonstração do Resultado do Exercício">
        <div className="relative">
          <select
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
            className="h-8 appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 cursor-pointer"
          >
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        </div>
      </Topbar>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Receita Bruta" value={formatShort(totalReceitas)} subtitle="total de entradas" icon={TrendingUp} trend="up" />
          <MetricCard label="Total de Despesas" value={formatShort(totalDespesas)} subtitle="total de saídas" icon={TrendingDown} trend="down" />
          <MetricCard
            label="Resultado Líquido"
            value={formatShort(Math.abs(resultadoLiquido))}
            subtitle={resultadoLiquido >= 0 ? 'lucro' : 'prejuízo'}
            icon={BarChart2}
            trend={resultadoLiquido >= 0 ? 'up' : 'down'}
          />
          <MetricCard
            label="Margem Líquida"
            value={`${margemLiquida.toFixed(1)}%`}
            subtitle="resultado / receita"
            icon={Percent}
          />
        </div>

        {/* Resumo consolidado */}
        <div className="bg-white rounded-xl border border-black/[0.08] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Resumo — {ano}</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Receita Bruta Total</span>
              <span className="text-sm font-semibold text-green-600">+ {formatBRL(totalReceitas)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Despesas Totais</span>
              <span className="text-sm font-semibold text-red-500">- {formatBRL(totalDespesas)}</span>
            </div>
            <div className="flex items-center justify-between py-2 bg-gray-50 px-3 rounded-lg mt-1">
              <span className="text-sm font-bold text-gray-800">Resultado Líquido</span>
              <span className={`text-sm font-bold ${resultadoLiquido >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {resultadoLiquido >= 0 ? '+' : '-'} {formatBRL(Math.abs(resultadoLiquido))}
              </span>
            </div>
          </div>
        </div>

        {/* Por categoria */}
        {loading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-12 bg-white rounded-lg animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState title="Nenhum lançamento no período" description="Adicione lançamentos para visualizar o DRE" />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-xs font-semibold text-gray-500">Detalhamento por Categoria</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Categoria</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Receitas</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Despesas</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Resultado</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">% Receita</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const pct = totalReceitas > 0 ? (item.receitas / totalReceitas) * 100 : 0
                  return (
                    <tr key={item.categoria} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === items.length - 1 ? 'border-b-0' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-800">{item.categoria}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">{item.receitas > 0 ? formatBRL(item.receitas) : '—'}</td>
                      <td className="px-4 py-3 text-right text-red-500 font-medium">{item.despesas > 0 ? formatBRL(item.despesas) : '—'}</td>
                      <td className={`px-4 py-3 text-right font-bold ${item.resultado >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {item.resultado >= 0 ? '+' : '-'}{formatBRL(Math.abs(item.resultado))}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-400">{pct.toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50/50">
                  <td className="px-4 py-3 text-xs font-bold text-gray-700">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-green-600">{formatBRL(totalReceitas)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-500">{formatBRL(totalDespesas)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${resultadoLiquido >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {resultadoLiquido >= 0 ? '+' : '-'}{formatBRL(Math.abs(resultadoLiquido))}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-gray-500">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
