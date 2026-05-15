'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import {
  Sun, Zap, Activity, RefreshCw, Wifi, WifiOff, DollarSign, Leaf,
  Battery, Clock, ArrowLeft, Bell, BellOff, CheckCircle2, AlertTriangle,
  XCircle, ChevronLeft, ChevronRight, CalendarDays, BarChart2, Settings,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }) }
function fmtKwh(v: number, d = 1) { return `${v.toFixed(d)} kWh` }
function fmtKw(v: number)  { return `${v.toFixed(2)} kW` }

type TabType = 'overview' | 'dia' | 'mes' | 'ano' | 'alarmes' | 'config'

const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function UsinaDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const usinaId = params?.id as string

  const [usina, setUsina]       = useState<any>(null)
  const [tab, setTab]           = useState<TabType>('overview')
  const [status, setStatus]     = useState<any>(null)
  const [daily, setDaily]       = useState<any>(null)
  const [alarmes, setAlarmes]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isMock, setIsMock]     = useState(false)
  const [tarifa, setTarifa]     = useState(0.85)

  // Seletores de período
  const [selectedDate, setSelectedDate]   = useState(new Date().toISOString().slice(0, 10))
  const [selectedMes, setSelectedMes]     = useState(new Date().toISOString().slice(0, 7))
  const [selectedAno, setSelectedAno]     = useState(new Date().getFullYear().toString())
  const [mesData, setMesData]             = useState<any[]>([])
  const [anoData, setAnoData]             = useState<any[]>([])
  const [mesEstimated, setMesEstimated]   = useState(false)
  const [anoEstimated, setAnoEstimated]   = useState(false)
  const [loadingPeriod, setLoadingPeriod] = useState(false)

  // Configurações de alerta (edit state)
  const [editConfig, setEditConfig] = useState<any>(null)
  const [savingConfig, setSavingConfig] = useState(false)

  // Carrega usina do DB
  useEffect(() => {
    const load = async () => {
      const sb = createClient() as any
      const { data } = await sb.from('usinas_solares').select('*').eq('id', usinaId).single()
      if (!data) { router.push('/projetos/usinas-solares'); return }
      setUsina(data)
      setTarifa(data.tarifa_kwh || 0.85)
      setEditConfig({ email_alerta: data.email_alerta || '', whatsapp_numero: data.whatsapp_numero || '', alertas_ativo: data.alertas_ativo ?? true })
    }
    if (usinaId) load()
  }, [usinaId, router])

  // Status em tempo real
  const fetchStatus = useCallback(async () => {
    if (!usina) return
    setRefreshing(true)
    const plantUid = usina.elekeeper_plant_uid || ''
    // Se não tem integração configurada, usa mock direto
    if (!plantUid) {
      setStatus(null)
      setIsMock(true)
      setLoading(false)
      setRefreshing(false)
      return
    }
    const res = await fetch(`/api/elekeeper?action=status&plantUid=${encodeURIComponent(plantUid)}&usinaId=${usinaId}`).then(r => r.json())
    setStatus(res.data || res)
    setIsMock(!!res.mock)
    setLoading(false)
    setRefreshing(false)
  }, [usina, usinaId])

  // Gráfico diário
  const fetchDaily = useCallback(async (date: string) => {
    if (!usina) return
    setLoadingPeriod(true)
    const plantUid = usina.elekeeper_plant_uid || ''
    const res = await fetch(`/api/elekeeper?action=daily&plantUid=${encodeURIComponent(plantUid)}&date=${date}&usinaId=${usinaId}`).then(r => r.json())
    setDaily(res.data || res)
    setLoadingPeriod(false)
  }, [usina, usinaId])

  // Dados mensais (do banco)
  const fetchMes = useCallback(async (mes: string) => {
    if (!usinaId) return
    setLoadingPeriod(true)
    const res = await fetch(`/api/elekeeper?action=mensal&usinaId=${usinaId}&mes=${mes}`).then(r => r.json())
    setMesEstimated(!!res.estimated)
    // Preenche todos os dias do mês (0 para dias sem leitura)
    const [y, m] = mes.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const byDate: Record<string, number> = {}
    for (const row of res.data || []) byDate[row.data] = Number(row.kwh)
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const d = `${mes}-${String(i + 1).padStart(2, '0')}`
      return { dia: String(i + 1), data: d, kwh: byDate[d] || 0 }
    })
    setMesData(days)
    setLoadingPeriod(false)
  }, [usinaId])

  // Dados anuais (do banco)
  const fetchAno = useCallback(async (ano: string) => {
    if (!usinaId) return
    setLoadingPeriod(true)
    const res = await fetch(`/api/elekeeper?action=anual&usinaId=${usinaId}&ano=${ano}`).then(r => r.json())
    setAnoEstimated(!!res.estimated)
    const months = (res.data || []).map((r: any, i: number) => ({
      ...r, label: MONTHS_PT[i],
    }))
    setAnoData(months)
    setLoadingPeriod(false)
  }, [usinaId])

  // Alarmes
  const fetchAlarmes = useCallback(async () => {
    if (!usinaId) return
    const res = await fetch(`/api/elekeeper?action=alarmes&usinaId=${usinaId}`).then(r => r.json())
    setAlarmes(res.data || [])
  }, [usinaId])

  // Boot + auto-refresh a cada 5 minutos
  useEffect(() => {
    if (!usina) return
    fetchStatus()
    fetchAlarmes()
    const interval = setInterval(fetchStatus, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [usina, fetchStatus, fetchAlarmes])

  // Busca dados do tab selecionado
  useEffect(() => {
    if (!usina) return
    if (tab === 'dia')    fetchDaily(selectedDate)
    if (tab === 'mes')    fetchMes(selectedMes)
    if (tab === 'ano')    fetchAno(selectedAno)
    if (tab === 'alarmes') fetchAlarmes()
  }, [tab, usina]) // eslint-disable-line

  // Helpers de navegação
  function navMes(dir: number) {
    const [y, m] = selectedMes.split('-').map(Number)
    const next = new Date(y, m - 1 + dir, 1)
    const s = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
    setSelectedMes(s); fetchMes(s)
  }
  function navAno(dir: number) {
    const s = String(parseInt(selectedAno) + dir)
    setSelectedAno(s); fetchAno(s)
  }

  const resolverAlarme = async (id: string) => {
    await fetch(`/api/elekeeper?action=resolver_alarme&alarmeId=${id}`)
    fetchAlarmes()
    toast.success('Alarme resolvido')
  }

  const salvarConfig = async () => {
    setSavingConfig(true)
    const sb = createClient() as any
    const { error } = await sb.from('usinas_solares').update({
      email_alerta:    editConfig.email_alerta    || null,
      whatsapp_numero: editConfig.whatsapp_numero || null,
      alertas_ativo:   editConfig.alertas_ativo,
    }).eq('id', usinaId)
    if (error) {
      const needsMig = error.message?.toLowerCase().includes('column') || error.code === '42703'
      toast.error(needsMig
        ? 'Execute a migração do banco em /setup antes de configurar alertas'
        : 'Erro ao salvar configurações')
    } else {
      toast.success('Configurações salvas!')
      setUsina((p: any) => ({ ...p, ...editConfig }))
    }
    setSavingConfig(false)
  }

  // Métricas derivadas
  const hasIntegration = !!usina?.elekeeper_plant_uid
  const todayKwh  = status?.todayEnergy || 0
  const curPower  = status?.currentPower || 0
  const totalKwh  = status?.totalEnergy || 0
  const isOnline  = status?.status === 'online' || curPower > 0
  const alarmesAtivos = alarmes.filter(a => a.ativo)

  const TABS: { key: TabType; label: string; icon: any }[] = [
    { key: 'overview', label: 'Visão Geral', icon: Activity },
    { key: 'dia',      label: 'Por Dia',     icon: CalendarDays },
    { key: 'mes',      label: 'Por Mês',     icon: BarChart2 },
    { key: 'ano',      label: 'Por Ano',     icon: BarChart2 },
    { key: 'alarmes',  label: 'Alarmes',     icon: alarmesAtivos.length > 0 ? AlertTriangle : Bell },
    { key: 'config',   label: 'Config.',     icon: Settings },
  ]

  return (
    <AppLayout>
      <Topbar
        title={usina?.nome || 'Usina Solar'}
        subtitle="Monitoramento em tempo real — SAJ Electric / Elekeeper"
      >
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/projetos/usinas-solares')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </button>
          {isMock && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 text-xs font-medium border border-amber-200">
              Estimado
            </span>
          )}
          {alarmesAtivos.length > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-medium border border-red-200 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {alarmesAtivos.length} alarme{alarmesAtivos.length > 1 ? 's' : ''}
            </span>
          )}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${isOnline ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
            {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <button onClick={fetchStatus} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </Topbar>

      <div className="p-6 space-y-6">

        {/* Banner sem integração */}
        {!hasIntegration && !loading && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <Zap className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">Integração Elekeeper não configurada</p>
              <p className="text-xs text-blue-600">Para monitorar dados em tempo real, edite a usina e adicione o Plant UID do Elekeeper.</p>
            </div>
            <button onClick={() => setTab('config')} className="text-xs text-blue-600 underline flex-shrink-0">Configurar</button>
          </div>
        )}

        {/* Banner de alarme crítico */}
        {alarmesAtivos.some(a => a.severidade === 'critical') && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">Atenção: usina offline</p>
              <p className="text-xs text-red-600">{alarmesAtivos.find(a => a.severidade === 'critical')?.descricao}</p>
            </div>
            <button onClick={() => setTab('alarmes')} className="ml-auto text-xs text-red-600 underline">Ver alarmes</button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[
            { icon: Zap,        label: 'Potência Atual',      value: fmtKw(curPower),                                    sub: isOnline ? 'Gerando agora' : 'Sem geração',  color: '#f59e0b', bg: '#fffbeb' },
            { icon: Sun,        label: 'Geração Hoje',        value: fmtKwh(todayKwh),                                   sub: fmtBRL(todayKwh * tarifa),                   color: '#22c55e', bg: '#f0fdf4' },
            { icon: DollarSign, label: 'Receita do Mês',      value: fmtBRL((status?.monthEnergy || 0) * tarifa),        sub: fmtKwh(status?.monthEnergy || 0) + ' este mês', color: '#8b5cf6', bg: '#f5f3ff' },
            { icon: DollarSign, label: 'Receita Total (est)', value: fmtBRL(totalKwh * tarifa),                          sub: fmtKwh(totalKwh, 0) + ' acumulado',          color: '#3b82f6', bg: '#eff6ff' },
            { icon: Leaf,       label: 'CO₂ Evitado',         value: `${(status?.co2Saved || 0).toFixed(1)} kg`,         sub: 'acumulado este mês',                        color: '#10b981', bg: '#ecfdf5' },
          ].map(({ icon: Icon, label, value, sub, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-black/[0.07] p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                <Icon className="h-5 w-5" style={{ color }} />
              </div>
              <div>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-lg font-bold text-gray-900">{loading ? '—' : value}</p>
                <p className="text-xs text-gray-400">{loading ? '...' : sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tarifa */}
        <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3">
          <DollarSign className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">Tarifa de energia:</span>
          <input type="number" step="0.01" value={tarifa}
            onChange={e => setTarifa(parseFloat(e.target.value) || 0.85)}
            className="w-24 h-7 text-sm border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-slate-300 text-center font-medium" />
          <span className="text-sm text-gray-500">R$/kWh</span>
          <div className="ml-auto flex gap-4 text-xs text-gray-500">
            <span>Geração mês: <strong className="text-gray-800">{fmtKwh(status?.monthEnergy || 0)}</strong></span>
            <span>Geração ano: <strong className="text-gray-800">{fmtKwh(status?.yearEnergy || 0, 0)}</strong></span>
            <span>Receita ano: <strong className="text-gray-800">{fmtBRL((status?.yearEnergy || 0) * tarifa)}</strong></span>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
          <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-none">
            {TABS.map(t => {
              const Icon = t.icon
              const hasAlert = t.key === 'alarmes' && alarmesAtivos.length > 0
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${tab === t.key ? 'text-slate-900 border-b-2 border-slate-800' : 'text-gray-400 hover:text-gray-600'} ${hasAlert ? 'text-red-500' : ''}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                  {hasAlert && (
                    <span className="ml-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center">{alarmesAtivos.length}</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="p-6">

            {/* ── VISÃO GERAL ──────────────────────────────────────────── */}
            {tab === 'overview' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Eficiência',     value: `${(status?.efficiency || 0).toFixed(1)}%`,                       icon: Activity },
                    { label: 'Energia Total',  value: fmtKwh(totalKwh, 0),                                              icon: Battery },
                    { label: 'Este Mês',       value: fmtKwh(status?.monthEnergy || 0),                                 icon: BarChart2 },
                    { label: 'Última leitura', value: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), icon: Clock },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
                      <Icon className="h-5 w-5 mx-auto mb-2 text-gray-400" />
                      <p className="text-xs text-gray-400 mb-1">{label}</p>
                      <p className="text-base font-bold text-gray-800">{loading ? '—' : value}</p>
                    </div>
                  ))}
                </div>
                <div className="text-center py-4">
                  <p className="text-xs text-gray-400 mb-3">Selecione uma visualização detalhada</p>
                  <div className="flex justify-center gap-3 flex-wrap">
                    {(['dia','mes','ano'] as TabType[]).map(t => (
                      <button key={t} onClick={() => setTab(t)}
                        className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors capitalize">
                        Ver por {t === 'dia' ? 'Dia' : t === 'mes' ? 'Mês' : 'Ano'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── POR DIA ───────────────────────────────────────────────── */}
            {tab === 'dia' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm font-semibold text-gray-700 flex-1">Geração por hora</p>
                  <input type="date" value={selectedDate}
                    onChange={e => { setSelectedDate(e.target.value); fetchDaily(e.target.value) }}
                    className="h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
                </div>
                {daily && (
                  <div className="flex gap-3 flex-wrap">
                    <div className="bg-amber-50 rounded-xl px-4 py-2">
                      <p className="text-xs text-amber-600">Total do dia</p>
                      <p className="font-bold text-amber-700">{fmtKwh(daily.totalKwh || 0)}</p>
                    </div>
                    <div className="bg-green-50 rounded-xl px-4 py-2">
                      <p className="text-xs text-green-600">Valor gerado</p>
                      <p className="font-bold text-green-700">{fmtBRL((daily.totalKwh || 0) * tarifa)}</p>
                    </div>
                  </div>
                )}
                {loadingPeriod ? <div className="h-64 animate-pulse bg-gray-50 rounded-xl" /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={daily?.hours || []}>
                      <defs>
                        <linearGradient id="gPower" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                      <YAxis tick={{ fontSize: 10 }} unit=" kW" width={42} />
                      <Tooltip formatter={(v: any) => [`${v} kW`, 'Potência']} />
                      <Area type="monotone" dataKey="power" stroke="#f59e0b" fill="url(#gPower)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {/* ── POR MÊS ──────────────────────────────────────────────── */}
            {tab === 'mes' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => navMes(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronLeft className="h-4 w-4" /></button>
                  <p className="text-sm font-semibold text-gray-700 flex-1 text-center flex items-center justify-center gap-2">
                    {new Date(selectedMes + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    {mesEstimated && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded text-[10px] font-medium">Estimado</span>}
                  </p>
                  <button onClick={() => navMes(1)} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronRight className="h-4 w-4" /></button>
                  <input type="month" value={selectedMes}
                    onChange={e => { setSelectedMes(e.target.value); fetchMes(e.target.value) }}
                    className="h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
                </div>
                {mesData.length > 0 && (
                  <div className="flex gap-3 flex-wrap">
                    <div className="bg-amber-50 rounded-xl px-4 py-2">
                      <p className="text-xs text-amber-600">Total do mês</p>
                      <p className="font-bold text-amber-700">{fmtKwh(mesData.reduce((s, d) => s + d.kwh, 0))}</p>
                    </div>
                    <div className="bg-green-50 rounded-xl px-4 py-2">
                      <p className="text-xs text-green-600">Receita estimada</p>
                      <p className="font-bold text-green-700">{fmtBRL(mesData.reduce((s, d) => s + d.kwh * tarifa, 0))}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl px-4 py-2">
                      <p className="text-xs text-blue-600">Dias com leitura</p>
                      <p className="font-bold text-blue-700">{mesData.filter(d => d.kwh > 0).length} / {mesData.length}</p>
                    </div>
                  </div>
                )}
                {loadingPeriod ? <div className="h-64 animate-pulse bg-gray-50 rounded-xl" /> : mesData.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">Nenhum dado disponível para este mês.<br/>As leituras são gravadas automaticamente conforme o app é utilizado.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={mesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} unit=" kW" width={42} />
                      <Tooltip formatter={(v: any) => [fmtKwh(Number(v)), 'Geração']} labelFormatter={l => `Dia ${l}`} />
                      <Bar dataKey="kwh" radius={[3,3,0,0]}>
                        {mesData.map((entry, i) => (
                          <Cell key={i} fill={entry.kwh > 0 ? '#f59e0b' : '#e5e7eb'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {/* ── POR ANO ───────────────────────────────────────────────── */}
            {tab === 'ano' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => navAno(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronLeft className="h-4 w-4" /></button>
                  <p className="text-sm font-semibold text-gray-700 flex-1 text-center flex items-center justify-center gap-2">
                    {selectedAno}
                    {anoEstimated && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded text-[10px] font-medium">Estimado</span>}
                  </p>
                  <button onClick={() => navAno(1)} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronRight className="h-4 w-4" /></button>
                  <input type="number" value={selectedAno} min="2020" max="2035"
                    onChange={e => { setSelectedAno(e.target.value); fetchAno(e.target.value) }}
                    className="w-20 h-8 text-xs border border-gray-200 rounded-lg px-2 text-center focus:outline-none focus:ring-2 focus:ring-slate-300" />
                </div>
                {anoData.length > 0 && (
                  <div className="flex gap-3 flex-wrap">
                    <div className="bg-amber-50 rounded-xl px-4 py-2">
                      <p className="text-xs text-amber-600">Total do ano</p>
                      <p className="font-bold text-amber-700">{fmtKwh(anoData.reduce((s, d) => s + d.kwh, 0), 0)}</p>
                    </div>
                    <div className="bg-green-50 rounded-xl px-4 py-2">
                      <p className="text-xs text-green-600">Receita estimada</p>
                      <p className="font-bold text-green-700">{fmtBRL(anoData.reduce((s, d) => s + d.kwh * tarifa, 0))}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl px-4 py-2">
                      <p className="text-xs text-blue-600">API real (acumulado)</p>
                      <p className="font-bold text-blue-700">{fmtKwh(status?.yearEnergy || 0, 0)}</p>
                    </div>
                  </div>
                )}
                {loadingPeriod ? <div className="h-64 animate-pulse bg-gray-50 rounded-xl" /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={anoData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} unit=" kW" width={48} />
                      <Tooltip formatter={(v: any) => [fmtKwh(Number(v), 0), 'Geração']} />
                      <Bar dataKey="kwh" radius={[3,3,0,0]}>
                        {anoData.map((entry, i) => (
                          <Cell key={i} fill={entry.kwh > 0 ? '#3b82f6' : '#e5e7eb'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {/* ── ALARMES ──────────────────────────────────────────────── */}
            {tab === 'alarmes' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">Histórico de Alarmes</p>
                  <button onClick={fetchAlarmes} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" /> Atualizar
                  </button>
                </div>
                {alarmes.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-10 w-10 text-green-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Nenhum alarme registrado</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {alarmes.map((a: any) => (
                      <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border ${a.ativo ? (a.severidade === 'critical' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200') : 'bg-gray-50 border-gray-100'}`}>
                        {a.severidade === 'critical'
                          ? <XCircle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${a.ativo ? 'text-red-500' : 'text-gray-400'}`} />
                          : <AlertTriangle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${a.ativo ? 'text-amber-500' : 'text-gray-400'}`} />
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-semibold uppercase tracking-wide ${a.ativo ? (a.severidade === 'critical' ? 'text-red-600' : 'text-amber-600') : 'text-gray-400'}`}>
                              {a.tipo.replace('_', ' ')}
                            </span>
                            {a.ativo ? (
                              <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">Ativo</span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">Resolvido</span>
                            )}
                            {a.notificado && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded-full">Notificado</span>}
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">{a.descricao}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(a.created_at).toLocaleString('pt-BR')}
                            {a.resolvido_em && ` · resolvido ${new Date(a.resolvido_em).toLocaleString('pt-BR')}`}
                          </p>
                        </div>
                        {a.ativo && (
                          <button onClick={() => resolverAlarme(a.id)}
                            className="text-xs px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 whitespace-nowrap flex-shrink-0">
                            Resolver
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── CONFIG ───────────────────────────────────────────────── */}
            {tab === 'config' && editConfig && (
              <div className="space-y-5 max-w-lg">
                <p className="text-sm font-semibold text-gray-700">Configurações de Alertas</p>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">E-mail para alertas</label>
                    <input type="email" value={editConfig.email_alerta}
                      onChange={e => setEditConfig((p: any) => ({ ...p, email_alerta: e.target.value }))}
                      placeholder="email@exemplo.com"
                      className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-slate-300" />
                    <p className="text-xs text-gray-400 mt-1">Requer RESEND_API_KEY configurado no servidor</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">WhatsApp (número com DDD)</label>
                    <input type="tel" value={editConfig.whatsapp_numero}
                      onChange={e => setEditConfig((p: any) => ({ ...p, whatsapp_numero: e.target.value }))}
                      placeholder="5511999999999"
                      className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-slate-300" />
                    <p className="text-xs text-gray-400 mt-1">Requer ZAPI_INSTANCE_ID e ZAPI_TOKEN no servidor</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button onClick={() => setEditConfig((p: any) => ({ ...p, alertas_ativo: !p.alertas_ativo }))}
                      className={`relative w-10 h-5 rounded-full transition-colors ${editConfig.alertas_ativo ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editConfig.alertas_ativo ? 'translate-x-5' : ''}`} />
                    </button>
                    <span className="text-sm text-gray-600">
                      {editConfig.alertas_ativo ? 'Alertas ativos' : 'Alertas desativados'}
                    </span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                  <p className="font-semibold">Variáveis de ambiente necessárias (.env.local):</p>
                  <p><code>RESEND_API_KEY</code> — chave da API Resend (resend.com)</p>
                  <p><code>ALERT_FROM_EMAIL</code> — remetente do email (ex: alertas@seudominio.com)</p>
                  <p><code>ZAPI_INSTANCE_ID</code> + <code>ZAPI_TOKEN</code> — credenciais Z-API (z-api.io)</p>
                </div>

                <button onClick={salvarConfig} disabled={savingConfig}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors">
                  {savingConfig ? 'Salvando...' : 'Salvar Configurações'}
                </button>
              </div>
            )}

          </div>
        </div>

        {/* Rodapé info */}
        {usina?.elekeeper_plant_uid && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-500 flex items-center gap-4 flex-wrap">
            <span>Plant UID: <strong>{usina.elekeeper_plant_uid}</strong></span>
            <span>Tarifa: {tarifa} R$/kWh</span>
            <span>{isMock ? '⚠ Curva estimada (API não fornece detalhe por hora)' : '✓ Dados em tempo real'}</span>
            {status?.monthEnergy && <span>Este mês via API: <strong>{fmtKwh(status.monthEnergy)}</strong></span>}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
