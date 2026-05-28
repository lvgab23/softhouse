'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Bell, BellOff, CheckCheck, AlertTriangle, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

type Alert = {
  id: string
  check_id: string | null
  titulo: string
  mensagem: string | null
  severidade: string
  lido: boolean
  created_at: string
  compliance_checks?: { documento: string; tipo: string; nome: string | null }
}

const SEV_CONFIG: Record<string, { variant: any; label: string; iconColor: string }> = {
  CRITICO: { variant: 'danger', label: 'Crítico', iconColor: 'text-red-500' },
  ALTO: { variant: 'warning', label: 'Alto', iconColor: 'text-orange-500' },
  MEDIO: { variant: 'info', label: 'Médio', iconColor: 'text-yellow-500' },
  BAIXO: { variant: 'gray', label: 'Baixo', iconColor: 'text-blue-500' },
  INFO: { variant: 'gray', label: 'Info', iconColor: 'text-gray-400' },
}

export default function AlertasPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'todos' | 'nao_lidos'>('nao_lidos')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [marking, setMarking] = useState(false)

  const fetchAlerts = useCallback(async () => {
    const res = await fetch('/api/compliance/alerts')
    if (res.ok) setAlerts(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  const filteredAlerts = filter === 'nao_lidos'
    ? alerts.filter(a => !a.lido)
    : alerts

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const markAsRead = async (ids?: string[]) => {
    const toMark = ids || Array.from(selected)
    if (toMark.length === 0) return
    setMarking(true)
    try {
      await fetch('/api/compliance/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: toMark, lido: true }),
      })
      toast.success(`${toMark.length} alerta(s) marcado(s) como lido`)
      setSelected(new Set())
      fetchAlerts()
    } catch {
      toast.error('Erro ao atualizar alertas')
    } finally {
      setMarking(false)
    }
  }

  const markAllRead = () => markAsRead(alerts.filter(a => !a.lido).map(a => a.id))

  const unreadCount = alerts.filter(a => !a.lido).length

  return (
    <AppLayout>
      <Topbar title="Alertas de Compliance" subtitle="Ocorrências críticas e de alto risco detectadas">
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} loading={marking}>
            <CheckCheck className="h-4 w-4" /> Marcar todos como lidos
          </Button>
        )}
      </Topbar>

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-black/[0.07] p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <Bell className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{unreadCount}</p>
              <p className="text-xs text-gray-500">Não lidos</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-black/[0.07] p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
              <BellOff className="h-4 w-4 text-gray-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{alerts.filter(a => a.lido).length}</p>
              <p className="text-xs text-gray-500">Lidos</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-black/[0.07] p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">
                {alerts.filter(a => a.severidade === 'CRITICO' && !a.lido).length}
              </p>
              <p className="text-xs text-gray-500">Críticos não lidos</p>
            </div>
          </div>
        </div>

        {/* Filter + actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {(['nao_lidos', 'todos'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-[#0f172a] text-white'
                    : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700'
                }`}
              >
                {f === 'nao_lidos' ? `Não lidos (${unreadCount})` : `Todos (${alerts.length})`}
              </button>
            ))}
          </div>
          {selected.size > 0 && (
            <Button size="sm" onClick={() => markAsRead()} loading={marking}>
              <CheckCheck className="h-4 w-4" /> Marcar {selected.size} como lido
            </Button>
          )}
        </div>

        {/* Alerts list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />)}
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="bg-white rounded-xl border border-black/[0.07] flex flex-col items-center py-14">
            <CheckCheck className="h-10 w-10 text-green-400 mb-3" />
            <p className="text-sm font-medium text-gray-500">
              {filter === 'nao_lidos' ? 'Nenhum alerta pendente — tudo em dia!' : 'Nenhum alerta registrado'}
            </p>
            <Link href="/compliance/consulta" className="text-xs text-blue-500 hover:underline mt-2">
              Realizar nova consulta →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAlerts.map(alert => {
              const sevCfg = SEV_CONFIG[alert.severidade] || SEV_CONFIG.INFO
              const isSelected = selected.has(alert.id)
              return (
                <div
                  key={alert.id}
                  className={`bg-white rounded-xl border p-4 flex items-center gap-3 transition-all ${
                    alert.lido ? 'border-black/[0.05] opacity-70' :
                    alert.severidade === 'CRITICO' ? 'border-red-100 shadow-sm' :
                    alert.severidade === 'ALTO' ? 'border-orange-100' :
                    'border-black/[0.07]'
                  } ${isSelected ? 'ring-2 ring-blue-300' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(alert.id)}
                    className="rounded border-gray-300 text-blue-600 cursor-pointer"
                  />

                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    alert.severidade === 'CRITICO' ? 'bg-red-50' :
                    alert.severidade === 'ALTO' ? 'bg-orange-50' : 'bg-gray-50'
                  }`}>
                    <AlertTriangle className={`h-4 w-4 ${sevCfg.iconColor}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className={`text-sm font-semibold ${alert.lido ? 'text-gray-500' : 'text-gray-900'}`}>
                        {alert.titulo}
                      </span>
                      <Badge variant={sevCfg.variant}>{sevCfg.label}</Badge>
                      {!alert.lido && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                    </div>
                    {alert.mensagem && (
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{alert.mensagem}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[11px] text-gray-400">{formatDate(alert.created_at)}</span>
                      {alert.compliance_checks && (
                        <span className="text-[11px] text-gray-400">
                          {alert.compliance_checks.nome || alert.compliance_checks.documento}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!alert.lido && (
                      <button
                        onClick={() => markAsRead([alert.id])}
                        className="text-[11px] text-blue-500 hover:underline"
                      >
                        Marcar lido
                      </button>
                    )}
                    {alert.check_id && (
                      <Link href={`/compliance/resultado/${alert.check_id}`}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
