'use client'

import { useEffect, useState } from 'react'
import { Download, FileText, BarChart3, TrendingUp, Building2, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { MetricCard } from '@/components/ui/metric-card'
import { formatBRL, formatShort, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface ReportData {
  totalPatrimonios: number
  valorCarteira: number
  totalProjetos: number
  totalAportes: number
  totalAlugueis: number
  receitaAluguel: number
  manutencoesPendentes: number
  patrimoniosPorCategoria: { nome: string; valor: number; quantidade: number }[]
  ultimasMovimentacoes: any[]
}

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportData | null>(null)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const [patrimoniosRes, projetosRes, aportesRes, alugueisRes, manutencoesRes, movRes] = await Promise.all([
        supabase.from('patrimonios').select('*, categorias(nome)').eq('status', 'ativo'),
        supabase.from('projetos').select('*'),
        supabase.from('aportes').select('*'),
        supabase.from('alugueis').select('*').eq('status', 'ativo'),
        supabase.from('manutencoes').select('*').neq('status', 'concluida'),
        supabase.from('movimentacoes').select('*').order('data', { ascending: false }).limit(10),
      ])

      const patrimonios = patrimoniosRes.data || []
      const projetos = projetosRes.data || []
      const aportes = aportesRes.data || []
      const alugueis = alugueisRes.data || []
      const manutencoes = manutencoesRes.data || []
      const movimentacoes = movRes.data || []

      const valorCarteira = patrimonios.reduce((s: number, p: any) => s + (p.valor_atual || p.valor_aquisicao || 0), 0)
      const totalAportes = aportes.reduce((s: number, a: any) => s + (a.valor || 0), 0)
      const receitaAluguel = alugueis.reduce((s: number, a: any) => s + (a.valor_mensal || 0), 0)

      const catMap: Record<string, { valor: number; quantidade: number }> = {}
      patrimonios.forEach((p: any) => {
        const cat = p.categorias?.nome || 'Sem categoria'
        if (!catMap[cat]) catMap[cat] = { valor: 0, quantidade: 0 }
        catMap[cat].valor += p.valor_atual || p.valor_aquisicao || 0
        catMap[cat].quantidade++
      })
      const patrimoniosPorCategoria = Object.entries(catMap).map(([nome, d]) => ({ nome, ...d })).sort((a, b) => b.valor - a.valor)

      setData({
        totalPatrimonios: patrimonios.length,
        valorCarteira,
        totalProjetos: projetos.length,
        totalAportes,
        totalAlugueis: alugueis.length,
        receitaAluguel,
        manutencoesPendentes: manutencoes.length,
        patrimoniosPorCategoria,
        ultimasMovimentacoes: movimentacoes,
      })
      setLoading(false)
    }
    fetchData()
  }, [])

  const exportCSV = async (type: string) => {
    if (!data) return
    let csv = ''
    let filename = ''

    if (type === 'patrimonio') {
      const supabase = createClient()
      const { data: items } = await supabase.from('patrimonios').select('*, categorias(nome)').eq('status', 'ativo')
      csv = ['Nome,Categoria,Cidade,Estado,Valor Aquisição,Valor Atual,Status', ...(items || []).map((p: any) => [p.nome, p.categorias?.nome || '', p.cidade || '', p.estado || '', p.valor_aquisicao || 0, p.valor_atual || 0, p.status].join(','))].join('\n')
      filename = 'relatorio-patrimonio.csv'
    } else if (type === 'financeiro') {
      const supabase = createClient()
      const { data: mov } = await supabase.from('movimentacoes').select('*').order('data', { ascending: false })
      csv = ['Data,Tipo,Descrição,Valor,Categoria', ...(mov || []).map((m: any) => [m.data, m.tipo, m.descricao || '', m.valor, m.categoria || ''].join(','))].join('\n')
      filename = 'relatorio-financeiro.csv'
    } else if (type === 'projetos') {
      const supabase = createClient()
      const { data: projetos } = await supabase.from('projetos').select('*')
      csv = ['Nome,Status,Valor Total,Data Início,Data Fim', ...(projetos || []).map((p: any) => [p.nome, p.status, p.valor_total || 0, p.data_inicio || '', p.data_fim || ''].join(','))].join('\n')
      filename = 'relatorio-projetos.csv'
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    toast.success('Relatório exportado!')
  }

  const exportPDFIA = () => {
    toast.info('Gerando relatório com IA…', { description: 'Esta funcionalidade estará disponível em breve.' })
  }

  if (loading) {
    return (
      <AppLayout>
        <Topbar title="Relatórios" subtitle="Exporte e analise seus dados" />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-28 bg-white rounded-xl border border-black/[0.08] animate-pulse" />)}
          </div>
        </div>
      </AppLayout>
    )
  }

  const d = data!

  return (
    <AppLayout>
      <Topbar title="Relatórios" subtitle="Exporte e analise seus dados">
        <Button size="sm" onClick={exportPDFIA}>
          <Download className="h-4 w-4" /> Relatório PDF com IA
        </Button>
      </Topbar>

      <div className="p-6 space-y-6">
        {/* Resumo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Patrimônios Ativos" value={String(d.totalPatrimonios)} subtitle={formatShort(d.valorCarteira)} icon={Building2} />
          <MetricCard label="Projetos" value={String(d.totalProjetos)} subtitle={`${formatShort(d.totalAportes)} aportados`} icon={BarChart3} />
          <MetricCard label="Receita Aluguel" value={formatShort(d.receitaAluguel)} subtitle={`${d.totalAlugueis} contratos ativos`} icon={TrendingUp} />
          <MetricCard label="Manutenções Pendentes" value={String(d.manutencoesPendentes)} subtitle="aguardando resolução" icon={FileText} />
        </div>

        {/* Exportações */}
        <Card>
          <CardHeader>
            <p className="text-sm font-semibold text-gray-700">Exportar Relatórios</p>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { key: 'patrimonio', label: 'Relatório de Patrimônio', desc: 'Lista completa de imóveis e ativos', icon: Building2, color: 'bg-blue-50 text-blue-600' },
                { key: 'financeiro', label: 'Relatório Financeiro', desc: 'Movimentações e fluxo de caixa', icon: TrendingUp, color: 'bg-green-50 text-green-600' },
                { key: 'projetos', label: 'Relatório de Projetos', desc: 'Status e valores dos projetos', icon: FileSpreadsheet, color: 'bg-purple-50 text-purple-600' },
              ].map(r => (
                <button
                  key={r.key}
                  onClick={() => exportCSV(r.key)}
                  className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 transition-colors text-left group"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${r.color}`}>
                    <r.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 group-hover:text-[#0f172a]">{r.label}</p>
                    <p className="text-xs text-gray-400">{r.desc}</p>
                  </div>
                  <Download className="h-4 w-4 text-gray-300 group-hover:text-gray-500 ml-auto" />
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Resumo por categoria */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <p className="text-sm font-semibold text-gray-700">Patrimônio por Categoria</p>
            </CardHeader>
            <CardBody>
              {d.patrimoniosPorCategoria.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Nenhum patrimônio cadastrado</p>
              ) : (
                <div className="space-y-2">
                  {d.patrimoniosPorCategoria.map((cat, i) => {
                    const total = d.patrimoniosPorCategoria.reduce((s, c) => s + c.valor, 0)
                    const pct = total > 0 ? cat.valor / total * 100 : 0
                    return (
                      <div key={cat.nome} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" style={{ opacity: 1 - i * 0.1 }} />
                          <span className="text-xs text-gray-700">{cat.nome}</span>
                          <span className="text-[10px] text-gray-400">{cat.quantidade} item(ns)</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-gray-400">{pct.toFixed(1)}%</span>
                          <span className="text-xs font-semibold text-gray-900">{formatBRL(cat.valor)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <p className="text-sm font-semibold text-gray-700">Últimas Movimentações</p>
            </CardHeader>
            <CardBody>
              {d.ultimasMovimentacoes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Nenhuma movimentação</p>
              ) : (
                <div className="space-y-2">
                  {d.ultimasMovimentacoes.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-xs font-medium text-gray-800 truncate max-w-[180px]">{m.descricao || 'Sem descrição'}</p>
                        <p className="text-[10px] text-gray-400">{m.data ? formatDate(m.data) : '—'}</p>
                      </div>
                      <span className={`text-xs font-semibold ${m.tipo === 'entrada' ? 'text-green-600' : 'text-red-500'}`}>
                        {m.tipo === 'entrada' ? '+' : '-'}{formatBRL(m.valor || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
