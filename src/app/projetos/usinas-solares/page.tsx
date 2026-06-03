'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Sun, Zap, DollarSign, BarChart3, MapPin, ExternalLink, Database, Wifi, WifiOff, RefreshCw, ChevronDown, Map } from 'lucide-react'
import { UsinasMap, type UsinaMapEntry } from '@/components/usinas/UsinasMap'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { formatBRL } from '@/lib/utils'
import { usePortfolio } from '@/lib/portfolio-context'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  localizacao: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  potencia_kw: z.number().min(0).optional(),
  geracao_mensal_kwh: z.number().min(0).optional(),
  valor_investimento: z.number().min(0).optional(),
  receita_mensal: z.number().min(0).optional(),
  data_instalacao: z.string().optional(),
  status: z.enum(['ativa', 'inativa', 'manutencao']).default('ativa'),
  provider: z.enum(['elekeeper', 'solarz', 'none']).default('none'),
  elekeeper_plant_uid: z.string().optional(),
  solarz_uuid: z.string().optional(),
  tarifa_kwh: z.number().min(0).default(0.85),
  notas: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'gray' }> = {
  ativa:      { label: 'Ativa',      variant: 'success' },
  inativa:    { label: 'Inativa',    variant: 'gray' },
  manutencao: { label: 'Manutenção', variant: 'warning' },
}

const CACHOEIRA_SEED = {
  nome: 'Usina Solar Cachoeira',
  cidade: 'Cachoeira de Goiás',
  estado: 'GO',
  status: 'ativa' as const,
  elekeeper_plant_uid: 'supermercadosantosilumi',
  tarifa_kwh: 0.85,
}

export default function UsinasSolaresPage() {
  const { activeOwnerId } = usePortfolio()
  const [usinas, setUsinas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [liveData, setLiveData] = useState<Record<string, any>>({})
  const [loadingLive, setLoadingLive] = useState(false)
  const [selectedUsinaId, setSelectedUsinaId] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'ativa', tarifa_kwh: 0.85, provider: 'none' },
  })

  const fetchData = useCallback(async () => {
    const supabase = createClient() as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data, error } = await supabase.from('usinas_solares').select('*').eq('user_id', activeOwnerId).order('created_at', { ascending: false })
    if (error) { setLoading(false); return }

    const list = data || []
    // Corrige localização antiga da Cachoeira (MG → GO)
    const old = list.find((u: any) => u.nome === 'Usina Solar Cachoeira' && u.estado === 'MG')
    if (old) {
      await supabase.from('usinas_solares')
        .update({ cidade: 'Cachoeira de Goiás', estado: 'GO' })
        .eq('id', old.id)
      old.cidade = 'Cachoeira de Goiás'
      old.estado = 'GO'
    }
    setUsinas(list)
    setLoading(false)
    return list
  }, [])

  const fetchLiveData = useCallback(async (usinasList: any[]) => {
    const integrated = usinasList.filter(u =>
      (u.provider === 'elekeeper' && u.elekeeper_plant_uid) ||
      (u.provider === 'solarz' && u.solarz_uuid) ||
      (!u.provider && u.elekeeper_plant_uid) // retrocompatibilidade
    )
    if (!integrated.length) return
    setLoadingLive(true)
    const results = await Promise.all(
      integrated.map(u => {
        const provider = u.provider || 'elekeeper'
        const url = provider === 'solarz'
          ? `/api/solarz?action=status&uuid=${encodeURIComponent(u.solarz_uuid)}&usinaId=${u.id}`
          : `/api/elekeeper?action=status&plantUid=${encodeURIComponent(u.elekeeper_plant_uid)}&usinaId=${u.id}`
        return fetch(url)
          .then(r => r.json())
          .then(res => ({ id: u.id, data: res.data || res }))
          .catch(() => ({ id: u.id, data: null }))
      })
    )
    const map: Record<string, any> = {}
    for (const r of results) if (r.data && !r.data.error) map[r.id] = r.data
    setLiveData(map)
    setLoadingLive(false)
  }, [])

  useEffect(() => {
    fetchData().then(list => { if (list && list.length) fetchLiveData(list) })
  }, [fetchData, fetchLiveData])

  // Checa se tabelas de histórico existem
  useEffect(() => {
    const check = async () => {
      const sb = createClient() as any
      const { error } = await sb.from('usinas_solares_leituras').select('id').limit(1)
      setNeedsMigration(!!error)
    }
    check()
  }, [])

  const openModal = (item?: any) => {
    if (item) {
      setEditing(item)
      reset({
        nome: item.nome,
        localizacao: item.localizacao || '',
        cidade: item.cidade || '',
        estado: item.estado || '',
        potencia_kw: item.potencia_kw || undefined,
        geracao_mensal_kwh: item.geracao_mensal_kwh || undefined,
        valor_investimento: item.valor_investimento || undefined,
        receita_mensal: item.receita_mensal || undefined,
        data_instalacao: item.data_instalacao || '',
        status: item.status,
        provider: item.provider || (item.elekeeper_plant_uid ? 'elekeeper' : 'none'),
        elekeeper_plant_uid: item.elekeeper_plant_uid || '',
        solarz_uuid: item.solarz_uuid || '',
        tarifa_kwh: item.tarifa_kwh || 0.85,
        notas: item.notas || '',
      })
    } else {
      setEditing(null)
      reset({ status: 'ativa', tarifa_kwh: 0.85 })
    }
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    const supabase = createClient() as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = {
      ...data,
      data_instalacao: data.data_instalacao || null,
      elekeeper_plant_uid: data.elekeeper_plant_uid || null,
      solarz_uuid: data.solarz_uuid || null,
      localizacao: data.localizacao || null,
      notas: data.notas || null,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }
    if (editing) {
      const { error } = await supabase.from('usinas_solares').update(payload).eq('id', editing.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('Usina atualizada!')
    } else {
      const { error } = await supabase.from('usinas_solares').insert(payload)
      if (error) { toast.error(`Erro ao criar: ${error.message}`); return }
      toast.success('Usina criada!')
    }
    setModalOpen(false)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    const { error } = await (createClient() as any).from('usinas_solares').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Usina excluída')
    setDeleting(null)
    fetchData()
  }

  const filteredUsinas   = selectedUsinaId ? usinas.filter(u => u.id === selectedUsinaId) : usinas
  const totalPotencia    = filteredUsinas.reduce((s, u) => s + (u.potencia_kw || 0), 0)
  const totalInvestimento = filteredUsinas.reduce((s, u) => s + (u.valor_investimento || 0), 0)
  const totalAtivas      = filteredUsinas.filter(u => u.status === 'ativa').length
  const totalGerandoAgora = filteredUsinas.reduce((s, u) => s + (liveData[u.id]?.currentPower || 0), 0)
  const totalGeracaoHoje = filteredUsinas.reduce((s, u) => s + (liveData[u.id]?.todayEnergy || 0), 0)
  const totalGeracaoMes  = filteredUsinas.reduce((s, u) => s + (liveData[u.id]?.monthEnergy || u.geracao_mensal_kwh || 0), 0)
  const totalReceitaMes  = filteredUsinas.reduce((s, u) => {
    const kwh    = liveData[u.id]?.monthEnergy || u.geracao_mensal_kwh || 0
    const tarifa = u.tarifa_kwh || 0.85
    return s + kwh * tarifa
  }, 0)
  const usinaOnlineCount = filteredUsinas.filter(u => liveData[u.id]?.status === 'online').length

  return (
    <AppLayout>
      <Topbar title="Usinas Solares" subtitle="Dashboard consolidado · monitoramento e gestão de usinas solares">
        <div className="flex items-center gap-2">
          {/* Filtro por usina */}
          {usinas.length > 1 && (
            <div className="relative">
              <select
                value={selectedUsinaId || ''}
                onChange={e => setSelectedUsinaId(e.target.value || null)}
                className="h-8 pl-3 pr-7 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 appearance-none cursor-pointer">
                <option value="">Todas as usinas</option>
                {usinas.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
            </div>
          )}
          <button onClick={() => setShowMap(v => !v)}
            className={`flex items-center gap-1.5 h-8 px-3 border rounded-lg text-xs font-medium transition-colors ${showMap ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <Map className="h-3.5 w-3.5" /> {showMap ? 'Ocultar mapa' : 'Ver no mapa'}
          </button>
          <button onClick={() => fetchLiveData(usinas)} disabled={loadingLive}
            className="flex items-center gap-1.5 h-8 px-3 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors bg-white">
            <RefreshCw className={`h-3.5 w-3.5 ${loadingLive ? 'animate-spin' : ''}`} />
            {loadingLive ? 'Atualizando...' : 'Atualizar'}
          </button>
          <Button size="sm" onClick={() => openModal()}>
            <Plus className="h-4 w-4" /> Nova Usina
          </Button>
        </div>
      </Topbar>

      <div className="p-6 space-y-6">
        {/* Banner de setup */}
        {needsMigration && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <Database className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800">Histórico e alarmes requerem configuração do banco</p>
              <p className="text-xs text-amber-600">Execute o SQL de migração uma vez para ativar histórico persistente e alertas automáticos.</p>
            </div>
            <Link href="/setup" className="flex-shrink-0 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors">
              Configurar
            </Link>
          </div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[
            {
              label: 'Usinas',
              value: String(filteredUsinas.length),
              sub: `${totalAtivas} ativa${totalAtivas !== 1 ? 's' : ''}${usinaOnlineCount > 0 ? ` · ${usinaOnlineCount} online` : ''}`,
              icon: Sun, color: '#f59e0b', bg: '#fffbeb',
            },
            {
              label: 'Gerando Agora',
              value: `${totalGerandoAgora.toFixed(2)} kW`,
              sub: totalGerandoAgora > 0 ? 'em operação' : 'sem geração',
              icon: Zap, color: totalGerandoAgora > 0 ? '#22c55e' : '#94a3b8', bg: totalGerandoAgora > 0 ? '#f0fdf4' : '#f8fafc',
            },
            {
              label: 'Geração Hoje',
              value: `${totalGeracaoHoje.toFixed(1)} kWh`,
              sub: formatBRL(filteredUsinas.reduce((s, u) => s + (liveData[u.id]?.todayEnergy || 0) * (u.tarifa_kwh || 0.85), 0)),
              icon: BarChart3, color: '#f97316', bg: '#fff7ed',
            },
            {
              label: 'Geração do Mês',
              value: `${totalGeracaoMes.toFixed(0)} kWh`,
              sub: Object.keys(liveData).length > 0 ? 'dados da API' : 'estimativa cadastrada',
              icon: BarChart3, color: '#8b5cf6', bg: '#f5f3ff',
            },
            {
              label: 'Receita do Mês',
              value: formatBRL(totalReceitaMes),
              sub: Object.keys(liveData).length > 0 ? 'baseada na API' : 'estimativa mensal',
              icon: DollarSign, color: '#22c55e', bg: '#f0fdf4',
            },
            {
              label: 'Total Investido',
              value: formatBRL(totalInvestimento),
              sub: 'valor de aquisição',
              icon: DollarSign, color: '#64748b', bg: '#f1f5f9',
            },
          ].map(({ label, value, sub, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-black/[0.07] p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                <Icon className="h-5 w-5" style={{ color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400 truncate">{label}</p>
                <p className="text-lg font-bold text-gray-900">{loading ? '—' : value}</p>
                <p className="text-xs text-gray-400 truncate">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Mapa de usinas */}
        {showMap && !loading && (
          <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
              <Map className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-semibold text-gray-700">Localização das Usinas</p>
              <span className="text-xs text-gray-400 ml-1">· OpenStreetMap</span>
            </div>
            <UsinasMap
              height={380}
              usinas={filteredUsinas.map((u): UsinaMapEntry => ({
                id: u.id,
                nome: u.nome,
                cidade: u.cidade,
                estado: u.estado,
                status: u.status,
                isGenerating: (liveData[u.id]?.currentPower || 0) > 0,
                currentPower: liveData[u.id]?.currentPower,
                todayKwh: liveData[u.id]?.todayEnergy,
                monthKwh: liveData[u.id]?.monthEnergy || u.geracao_mensal_kwh,
              }))}
            />
          </div>
        )}

        {/* Plants grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-52 bg-white rounded-2xl animate-pulse border border-black/[0.07]" />)}
          </div>
        ) : filteredUsinas.length === 0 ? (
          <EmptyState icon={Sun} title="Nenhuma usina cadastrada" description="Adicione usinas solares para monitorar geração e receita" action={{ label: 'Nova Usina', onClick: () => openModal() }} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredUsinas.map(u => {
              const sc      = statusConfig[u.status] || statusConfig.ativa
              const live    = liveData[u.id]
              const isOnline    = live?.status === 'online'
              const isGenerating = (live?.currentPower || 0) > 0
              const todayKwh    = live?.todayEnergy || 0
              const monthKwh    = live?.monthEnergy || u.geracao_mensal_kwh || 0
              const tarifa      = u.tarifa_kwh || 0.85
              const monthBRL    = monthKwh * tarifa
              const dashHref    = `/projetos/usinas-solares/${u.id}`
              const hasLive     = !!live

              return (
                <div key={u.id} className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden hover:shadow-md transition-shadow">
                  {/* Card header */}
                  <div className="flex items-start justify-between px-5 pt-5 pb-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Ícone com indicador de status */}
                      <div className="relative flex-shrink-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isGenerating ? 'bg-green-50' : 'bg-amber-50'}`}>
                          <Sun className={`h-5 w-5 ${isGenerating ? 'text-green-500' : 'text-amber-500'}`} />
                        </div>
                        {hasLive && (
                          <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isGenerating ? 'bg-green-400 animate-pulse' : isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{u.nome}</p>
                        {(u.cidade || u.localizacao) && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {[u.cidade, u.estado].filter(Boolean).join(', ') || u.localizacao}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <Badge variant={sc.variant}>{sc.label}</Badge>
                      {hasLive && (
                        <div className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isGenerating ? 'bg-green-50 text-green-700' : isOnline ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                          {isGenerating
                            ? <><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" /> Gerando {live.currentPower?.toFixed(1)} kW</>
                            : isOnline
                              ? <><Wifi className="h-2.5 w-2.5" /> Online</>
                              : <><WifiOff className="h-2.5 w-2.5" /> Offline</>
                          }
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stats grid — dados reais quando disponíveis */}
                  <div className="grid grid-cols-4 gap-px bg-gray-100 border-t border-gray-100">
                    {[
                      { label: 'Potência',    value: u.potencia_kw ? `${u.potencia_kw} kW` : '—', highlight: false },
                      { label: 'Hoje',        value: hasLive ? `${todayKwh.toFixed(1)} kWh` : '—', highlight: isGenerating },
                      { label: 'Mês (kWh)',   value: monthKwh > 0 ? `${monthKwh.toFixed(0)} kWh` : '—', highlight: false },
                      { label: 'Mês (R$)',    value: monthBRL > 0 ? formatBRL(monthBRL) : '—', highlight: false },
                    ].map(s => (
                      <div key={s.label} className={`bg-white px-3 py-3 ${s.highlight ? 'bg-green-50/50' : ''}`}>
                        <p className="text-[10px] text-gray-400">{s.label}</p>
                        <p className={`text-xs font-semibold ${s.highlight ? 'text-green-700' : 'text-gray-800'}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 border-t border-gray-100">
                    <div className="flex gap-1">
                      <button onClick={() => openModal(u)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleting(u.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Link href={dashHref}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" /> Ver Dashboard
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal cadastro */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Usina' : 'Nova Usina Solar'} size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{editing ? 'Salvar' : 'Criar'}</Button>
          </>
        }
      >
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input label="Nome *" placeholder="Ex: Usina Solar Cachoeira" error={errors.nome?.message} {...register('nome')} />
          </div>
          <Input label="Cidade" placeholder="Cachoeira" {...register('cidade')} />
          <Input label="Estado" placeholder="MG" {...register('estado')} />
          <Input label="Localização / Endereço" placeholder="Rodovia BR-040 km 12" {...register('localizacao')} />
          <Select label="Status" {...register('status')}>
            <option value="ativa">Ativa</option>
            <option value="inativa">Inativa</option>
            <option value="manutencao">Manutenção</option>
          </Select>
          <Input label="Potência (kW)" type="number" step="0.1" placeholder="100" {...register('potencia_kw', { valueAsNumber: true })} />
          <Input label="Geração Mensal Est. (kWh)" type="number" step="1" placeholder="12000" {...register('geracao_mensal_kwh', { valueAsNumber: true })} />
          <Input label="Valor do Investimento (R$)" type="number" step="0.01" placeholder="500000" {...register('valor_investimento', { valueAsNumber: true })} />
          <Input label="Receita Mensal Est. (R$)" type="number" step="0.01" placeholder="8000" {...register('receita_mensal', { valueAsNumber: true })} />
          <Input label="Data de Instalação" type="date" {...register('data_instalacao')} />
          <Input label="Tarifa (R$/kWh)" type="number" step="0.01" placeholder="0.85" {...register('tarifa_kwh', { valueAsNumber: true })} />
          <div className="md:col-span-2 space-y-3 border border-gray-100 rounded-xl p-3 bg-gray-50/50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Monitoramento em Tempo Real</p>
            <Select label="Provedor de dados" {...register('provider')}>
              <option value="none">Sem monitoramento</option>
              <option value="elekeeper">Elekeeper (SAJ)</option>
              <option value="solarz">SolarZ</option>
            </Select>
            {/* Campo condicional por provider */}
            <div id="provider-fields">
              <Input label="Plant UID (Elekeeper)" placeholder="Ex: supermercadosantosilumi" {...register('elekeeper_plant_uid')} />
              <div className="mt-2">
                <Input label="UUID da Usina (SolarZ)" placeholder="Ex: b01fc2b5-132a-4368-..." {...register('solarz_uuid')} />
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            <Textarea label="Notas" placeholder="Observações..." rows={2} {...register('notas')} />
          </div>
        </form>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Confirmar exclusão" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={() => deleting && handleDelete(deleting)}>Excluir</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">Tem certeza que deseja excluir esta usina?</p>
      </Modal>
    </AppLayout>
  )
}
