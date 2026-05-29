'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck, AlertTriangle, FileSearch, CheckCircle2,
  ChevronRight, Clock, XCircle, Search, Trash2,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

type Check = {
  id: string
  tipo: string
  documento: string
  nome: string | null
  status: string
  score_total: number
  nivel_risco: string
  created_at: string
}

const RISCO_CONFIG: Record<string, { label: string; variant: any; color: string }> = {
  CRITICO: { label: 'Crítico', variant: 'danger', color: '#ef4444' },
  ALTO: { label: 'Alto', variant: 'warning', color: '#f97316' },
  MEDIO: { label: 'Médio', variant: 'info', color: '#eab308' },
  BAIXO: { label: 'Baixo', variant: 'gray', color: '#3b82f6' },
  LIMPO: { label: 'Limpo', variant: 'success', color: '#22c55e' },
}

function ScoreBadge({ nivel }: { nivel: string }) {
  const cfg = RISCO_CONFIG[nivel] || RISCO_CONFIG.LIMPO
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

function formatDoc(doc: string, tipo: string) {
  if (tipo === 'CNPJ') return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export default function ComplianceDashboard() {
  const router = useRouter()
  const [checks, setChecks] = useState<Check[]>([])
  const [alertsCount, setAlertsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const [checksRes, alertsRes] = await Promise.all([
      fetch('/api/compliance/checks'),
      fetch('/api/compliance/alerts'),
    ])
    if (checksRes.ok) setChecks(await checksRes.json())
    if (alertsRes.ok) {
      const alerts = await alertsRes.json()
      setAlertsCount(alerts.filter((a: any) => !a.lido).length)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Excluir esta consulta? Esta ação não pode ser desfeita.')) return
    setDeleting(id)
    const res = await fetch(`/api/compliance/checks?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setChecks(prev => prev.filter(c => c.id !== id))
    } else {
      const data = await res.json().catch(() => ({}))
      alert(`Erro ao excluir: ${data.error || res.status}`)
    }
    setDeleting(null)
  }

  const total = checks.length
  const criticos = checks.filter(c => c.nivel_risco === 'CRITICO').length
  const limpos = checks.filter(c => c.nivel_risco === 'LIMPO').length
  const emAnalise = checks.filter(c => c.status === 'running' || c.status === 'pending').length

  const pieData = Object.entries(
    checks.reduce((acc: Record<string, number>, c) => {
      acc[c.nivel_risco] = (acc[c.nivel_risco] || 0) + 1
      return acc
    }, {})
  ).map(([nivel, value]) => ({ name: RISCO_CONFIG[nivel]?.label || nivel, value, color: RISCO_CONFIG[nivel]?.color || '#ccc' }))

  const metrics = [
    { label: 'Total de Consultas', value: total, sub: 'realizadas', icon: FileSearch, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Risco Crítico', value: criticos, sub: 'precisam de atenção', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Alertas Novos', value: alertsCount, sub: 'não lidos', icon: ShieldCheck, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Aprovados', value: limpos, sub: 'sem ocorrências', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  ]

  return (
    <AppLayout>
      <Topbar title="Compliance" subtitle="Verificação de risco — processos, sanções e antecedentes">
        <Button size="sm" onClick={() => router.push('/compliance/consulta')}>
          <Search className="h-4 w-4" /> Nova Consulta
        </Button>
      </Topbar>

      <div className="p-6 space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map(m => (
            <div key={m.label} className="bg-white rounded-xl border border-black/[0.07] p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center flex-shrink-0`}>
                <m.icon className={`h-5 w-5 ${m.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{loading ? '—' : m.value}</p>
                <p className="text-xs text-gray-500 leading-tight">{m.label}</p>
                <p className="text-[10px] text-gray-400">{m.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent checks */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-black/[0.07]">
            <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Consultas Recentes</h3>
              <Link href="/compliance/consulta" className="text-xs text-blue-600 hover:underline">+ Nova consulta</Link>
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />)}
              </div>
            ) : checks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShieldCheck className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500">Nenhuma consulta realizada</p>
                <p className="text-xs text-gray-400 mt-1">Inicie uma análise para ver os resultados aqui</p>
                <Button size="sm" className="mt-4" onClick={() => router.push('/compliance/consulta')}>
                  Iniciar primeira consulta
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {checks.map(c => (
                  <div key={c.id} className="flex items-center gap-2 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                    <Link href={`/compliance/resultado/${c.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {c.nome || formatDoc(c.documento, c.tipo)}
                          </span>
                          {c.nome && (
                            <span className="text-xs text-gray-400">{formatDoc(c.documento, c.tipo)}</span>
                          )}
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">{c.tipo}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                          {c.status === 'running' && (
                            <span className="text-xs text-blue-500 flex items-center gap-1"><Clock className="h-3 w-3" /> Analisando...</span>
                          )}
                          {c.status === 'error' && (
                            <span className="text-xs text-red-500 flex items-center gap-1"><XCircle className="h-3 w-3" /> Erro</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {c.status === 'done' && (
                          <>
                            <span className="text-sm font-bold text-gray-700">{c.score_total}</span>
                            <ScoreBadge nivel={c.nivel_risco} />
                          </>
                        )}
                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                      </div>
                    </Link>
                    <button
                      onClick={e => handleDelete(e, c.id)}
                      disabled={deleting === c.id}
                      title="Excluir consulta"
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 flex-shrink-0 disabled:opacity-50 transition-colors"
                    >
                      {deleting === c.id
                        ? <Clock className="h-4 w-4 animate-spin text-red-400" />
                        : <Trash2 className="h-4 w-4" />
                      }
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pie chart + alerts */}
          <div className="space-y-4">
            {pieData.length > 0 && (
              <div className="bg-white rounded-xl border border-black/[0.07] p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Distribuição de Risco</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any, name: any) => [`${v} consulta(s)`, name]} />
                    <Legend iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-white rounded-xl border border-black/[0.07] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Alertas</h3>
                <Link href="/compliance/alertas" className="text-xs text-blue-600 hover:underline">Ver todos</Link>
              </div>
              <div className="space-y-2">
                {alertsCount > 0 ? (
                  <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-700">{alertsCount} alerta{alertsCount > 1 ? 's' : ''} não lido{alertsCount > 1 ? 's' : ''}</p>
                      <Link href="/compliance/alertas" className="text-xs text-red-500 hover:underline">Verificar agora →</Link>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <p className="text-sm text-green-700">Nenhum alerta pendente</p>
                  </div>
                )}
                {emAnalise > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <p className="text-sm text-blue-700">{emAnalise} consulta{emAnalise > 1 ? 's' : ''} em andamento</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 text-white">
              <ShieldCheck className="h-6 w-6 text-blue-400 mb-2" />
              <p className="text-sm font-semibold mb-1">Fontes verificadas</p>
              <ul className="text-xs text-slate-300 space-y-1">
                <li>• Receita Federal (CNPJ/situação)</li>
                <li>• Portal Transparência (CEIS/CNEP)</li>
                <li>• Escavador (processos — requer plano)</li>
                <li>• Serasa / BigData (em breve)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
