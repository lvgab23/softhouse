'use client'

import { useEffect, useState } from 'react'
import { DollarSign, TrendingDown, BarChart3 } from 'lucide-react'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { MetricCard } from '@/components/ui/metric-card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatBRL, formatShort } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export default function DepreciacoesPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const { data } = await supabase
        .from('patrimonios')
        .select('id, nome, valor_aquisicao, data_aquisicao, categorias(nome, taxa_depreciacao, vida_util_anos)')
        .eq('status', 'ativo')
        .order('nome')

      const now = new Date()
      const result = (data || []).map((p: any) => {
        const taxa = p.categorias?.taxa_depreciacao || 0
        const anos = p.data_aquisicao
          ? (now.getTime() - new Date(p.data_aquisicao).getTime()) / (1000 * 60 * 60 * 24 * 365)
          : 0
        const depreciado = taxa > 0 ? Math.min((p.valor_aquisicao || 0) * (taxa / 100) * anos, p.valor_aquisicao || 0) : 0
        const valorAtual = (p.valor_aquisicao || 0) - depreciado
        const pct = p.valor_aquisicao > 0 ? (depreciado / p.valor_aquisicao) * 100 : 0
        return {
          id: p.id,
          nome: p.nome,
          categoria: p.categorias?.nome || 'Sem categoria',
          valorOriginal: p.valor_aquisicao || 0,
          depreciado,
          valorAtual: Math.max(valorAtual, 0),
          pct,
          taxa,
        }
      })

      setItems(result)
      setLoading(false)
    }
    fetchData()
  }, [])

  const totalOriginal = items.reduce((s, i) => s + i.valorOriginal, 0)
  const totalDepreciado = items.reduce((s, i) => s + i.depreciado, 0)
  const totalAtual = items.reduce((s, i) => s + i.valorAtual, 0)

  return (
    <AppLayout>
      <Topbar title="Depreciações" subtitle="Controle de depreciação dos patrimônios" />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard label="Valor Original Total" value={formatShort(totalOriginal)} subtitle="valor de aquisição" icon={DollarSign} />
          <MetricCard label="Depreciação Acumulada" value={formatShort(totalDepreciado)} subtitle="perda de valor calculada" icon={TrendingDown} />
          <MetricCard label="Valor Contábil Atual" value={formatShort(totalAtual)} subtitle="valor contábil estimado" icon={BarChart3} />
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-white rounded-lg animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState title="Nenhum patrimônio cadastrado" description="Cadastre imóveis e configure as categorias com taxa de depreciação" />
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Patrimônio</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Categoria</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor Original</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Depreciado</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor Atual</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">%</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === items.length - 1 ? 'border-b-0' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{item.nome}</td>
                      <td className="px-4 py-3 text-gray-500">{item.categoria}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatBRL(item.valorOriginal)}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-500">
                        {item.depreciado > 0 ? `-${formatBRL(item.depreciado)}` : formatBRL(0)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">{formatBRL(item.valorAtual)}</td>
                      <td className="px-4 py-3 text-right text-xs">
                        <span className={item.pct > 0 ? 'text-orange-500 font-medium' : 'text-gray-400'}>
                          {item.pct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
