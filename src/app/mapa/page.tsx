'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, Building2, DollarSign, FolderOpen, Car, ChevronDown, RefreshCw, Loader2, Sun } from 'lucide-react'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { formatBRL, formatShort } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { MapItem, MapItemType } from '@/components/maps/leaflet-map'

const MapComponent = dynamic(() => import('@/components/maps/leaflet-map'), {
  ssr: false,
  loading: () => (
    <div className="h-[540px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
      <p className="text-gray-400 text-sm">Carregando mapa...</p>
    </div>
  ),
})

const TYPE_LABELS: Record<MapItemType, string> = {
  patrimonio:  'Imóveis',
  projeto:     'Projetos',
  empresa:     'Empresas',
  bem_movel:   'Bens Móveis',
  usina_solar: 'Usinas Solares',
}

const TYPE_COLORS: Record<MapItemType, string> = {
  patrimonio:  '#3b82f6',
  projeto:     '#8b5cf6',
  empresa:     '#f59e0b',
  bem_movel:   '#22c55e',
  usina_solar: '#f97316',
}

const geocodeCache = new Map<string, [number, number] | null>()

async function geocode(query: string): Promise<[number, number] | null> {
  const key = query.toLowerCase().trim()
  if (geocodeCache.has(key)) return geocodeCache.get(key)!
  if (!key) return null
  try {
    await new Promise(r => setTimeout(r, 200))
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(key + ', Brasil')}&format=json&limit=1&countrycodes=br`,
      { headers: { 'User-Agent': 'SoftHouse-FamilyOffice/1.0 (family-office-app)' } }
    )
    const data = await res.json()
    if (data?.length > 0) {
      const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)]
      geocodeCache.set(key, coords)
      return coords
    }
  } catch (_) {}
  geocodeCache.set(key, null)
  return null
}

function buildAddress(item: { logradouro?: string; numero?: string; bairro?: string; cidade?: string; estado?: string }) {
  return [item.logradouro, item.numero, item.bairro, item.cidade, item.estado].filter(Boolean).join(', ')
}

function StatCard({ icon: Icon, label, value, color, count }: any) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-black/[0.08] px-4 py-3 flex-1 min-w-[120px]">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '18' }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div>
        <p className="text-base font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-[11px] text-gray-400">{label}{count != null ? ` (${count})` : ''}</p>
      </div>
    </div>
  )
}

export default function MapaPage() {
  const [allItems, setAllItems] = useState<MapItem[]>([])
  const [loading, setLoading] = useState(true)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeProgress, setGeocodeProgress] = useState(0)
  const [typeFilter, setTypeFilter] = useState<MapItemType | 'todos'>('todos')
  const [statusFilter, setStatusFilter] = useState('todos')

  const fetchAndGeocode = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const [patrimoniosRes, projetosRes, empresasRes, usinasRes] = await Promise.all([
      supabase.from('patrimonios').select('id, nome, latitude, longitude, valor_atual, valor_aquisicao, status, logradouro, numero, bairro, cidade, estado, categorias(nome)'),
      supabase.from('projetos').select('id, nome, status, valor_total, cidade, estado').eq('status', 'ativo'),
      (supabase as any).from('empresas').select('id, nome, status, logradouro, numero, cidade, estado'),
      (supabase as any).from('usinas_solares').select('id, nome, status, cidade, estado, potencia_kw, valor_investimento, geracao_mensal_kwh, tarifa_kwh'),
    ])

    const raw: { id: string; nome: string; tipo: MapItemType; lat?: number | null; lng?: number | null; status?: string; valor?: number; subtitulo?: string; address?: string; localizacao?: string }[] = []

    // Patrimônios / Imóveis
    for (const p of (patrimoniosRes.data || [])) {
      raw.push({
        id: p.id, nome: p.nome, tipo: 'patrimonio',
        lat: p.latitude ? Number(p.latitude) : null,
        lng: p.longitude ? Number(p.longitude) : null,
        status: p.status,
        valor: p.valor_atual || p.valor_aquisicao || 0,
        subtitulo: (p as any).categorias?.nome,
        address: buildAddress(p),
        localizacao: [p.cidade, p.estado].filter(Boolean).join(', '),
      })
    }

    // Projetos
    for (const p of (projetosRes.data || [])) {
      raw.push({
        id: p.id, nome: p.nome, tipo: 'projeto',
        lat: null, lng: null,
        status: p.status,
        valor: p.valor_total || 0,
        address: [p.cidade, p.estado].filter(Boolean).join(', '),
        localizacao: [p.cidade, p.estado].filter(Boolean).join(', '),
      })
    }

    // Empresas
    for (const e of (empresasRes.data || [])) {
      raw.push({
        id: e.id, nome: e.nome, tipo: 'empresa',
        lat: null, lng: null,
        status: e.status,
        address: buildAddress(e),
        localizacao: [e.cidade, e.estado].filter(Boolean).join(', '),
      })
    }

    // Usinas Solares
    for (const u of (usinasRes.data || [])) {
      raw.push({
        id: u.id, nome: u.nome, tipo: 'usina_solar',
        lat: null, lng: null,
        status: u.status,
        valor: u.valor_investimento || 0,
        subtitulo: u.potencia_kw ? `${u.potencia_kw} kW instalados` : undefined,
        address: [u.cidade, u.estado].filter(Boolean).join(', '),
        localizacao: [u.cidade, u.estado].filter(Boolean).join(', '),
      })
    }

    // Geocode items without coordinates
    const needsGeocode = raw.filter(i => (i.lat == null || i.lng == null) && i.address)
    setLoading(false)

    if (needsGeocode.length > 0) {
      setGeocoding(true)
      const geocoded: typeof raw = raw.filter(i => i.lat != null && i.lng != null)

      for (let idx = 0; idx < needsGeocode.length; idx++) {
        const item = needsGeocode[idx]
        const coords = await geocode(item.address!)
        if (coords) {
          item.lat = coords[0]
          item.lng = coords[1]
          geocoded.push(item)
        }
        setGeocodeProgress(Math.round(((idx + 1) / needsGeocode.length) * 100))
      }

      const finalItems: MapItem[] = [...raw.filter(i => i.lat != null && i.lng != null)].map(i => ({
        id: i.id, nome: i.nome, tipo: i.tipo,
        latitude: i.lat!, longitude: i.lng!,
        status: i.status, valor: i.valor,
        subtitulo: i.subtitulo, localizacao: i.localizacao,
      }))

      setAllItems(finalItems)
      setGeocoding(false)
    } else {
      const finalItems: MapItem[] = raw.filter(i => i.lat != null && i.lng != null).map(i => ({
        id: i.id, nome: i.nome, tipo: i.tipo,
        latitude: i.lat!, longitude: i.lng!,
        status: i.status, valor: i.valor,
        subtitulo: i.subtitulo, localizacao: i.localizacao,
      }))
      setAllItems(finalItems)
    }
  }, [])

  useEffect(() => { fetchAndGeocode() }, [fetchAndGeocode])

  const filteredItems = useMemo(() => {
    return allItems.filter(i => {
      if (typeFilter !== 'todos' && i.tipo !== typeFilter) return false
      if (statusFilter !== 'todos' && i.status !== statusFilter) return false
      return true
    })
  }, [allItems, typeFilter, statusFilter])

  const countByType = useMemo(() => {
    const c: Record<string, number> = {}
    allItems.forEach(i => { c[i.tipo] = (c[i.tipo] || 0) + 1 })
    return c
  }, [allItems])

  const totalValor = filteredItems.reduce((s, i) => s + (i.valor || 0), 0)

  const statusOptions = useMemo(() => {
    const statuses = [...new Set(allItems.map(i => i.status).filter(Boolean))] as string[]
    return [{ value: 'todos', label: 'Todos os status' }, ...statuses.map(s => ({ value: s, label: s }))]
  }, [allItems])

  return (
    <AppLayout>
      <Topbar
        title="Mapa Patrimonial"
        subtitle={`${filteredItems.length} ponto(s) exibido(s)${geocoding ? ' · geocodificando...' : ''}`}
      >
        <Button onClick={fetchAndGeocode} variant="outline" size="sm" disabled={loading || geocoding}>
          <RefreshCw className={`h-4 w-4 ${loading || geocoding ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </Topbar>

      <div className="p-6 space-y-4">
        {/* Stats */}
        <div className="flex flex-wrap gap-3">
          <StatCard icon={MapPin}     label="Total no mapa"    value={String(allItems.length)}                       color="#64748b" />
          <StatCard icon={Building2}  label="Imóveis"          value={String(countByType.patrimonio || 0)}           color={TYPE_COLORS.patrimonio} />
          <StatCard icon={FolderOpen} label="Projetos"         value={String(countByType.projeto || 0)}              color={TYPE_COLORS.projeto} />
          <StatCard icon={Building2}  label="Empresas"         value={String(countByType.empresa || 0)}              color={TYPE_COLORS.empresa} />
          <StatCard icon={Sun}        label="Usinas Solares"   value={String(countByType.usina_solar || 0)}          color={TYPE_COLORS.usina_solar} />
          <StatCard icon={DollarSign} label="Valor mapeado"    value={formatShort(totalValor)}                       color="#22c55e" />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Filtrar:</span>

          {/* Type pills */}
          <div className="flex items-center gap-1">
            {(['todos', 'patrimonio', 'projeto', 'empresa', 'usina_solar'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  typeFilter === t
                    ? 'text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700'
                }`}
                style={typeFilter === t ? { background: t === 'todos' ? '#0f172a' : TYPE_COLORS[t] } : {}}
              >
                {t === 'todos' ? 'Todos' : TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-8 appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-7 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 cursor-pointer"
            >
              {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
          </div>

          {geocoding && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Geocodificando endereços... {geocodeProgress}%
            </div>
          )}
        </div>

        {/* Mapa */}
        {loading ? (
          <div className="h-[540px] bg-white rounded-xl border border-black/[0.08] animate-pulse flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
              <p className="text-xs text-gray-400">Carregando dados...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-black/[0.08] overflow-hidden">
            {filteredItems.length === 0 && !geocoding ? (
              <div className="h-[540px] flex flex-col items-center justify-center gap-3 text-gray-400">
                <MapPin className="h-10 w-10 text-gray-200" />
                <p className="text-sm font-medium">Nenhum ponto com localização</p>
                <p className="text-xs text-center max-w-xs">
                  Cadastre endereços nos imóveis, projetos e empresas para que apareçam no mapa.
                  A geocodificação é automática via CEP ou endereço.
                </p>
              </div>
            ) : (
              <MapComponent items={filteredItems} />
            )}
          </div>
        )}

        {/* Legenda */}
        <div className="bg-white rounded-xl border border-black/[0.08] px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Legenda</p>
          <div className="flex flex-wrap gap-6">
            {(Object.entries(TYPE_LABELS) as [MapItemType, string][]).map(([type, label]) => (
              <div key={type} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full border-2 border-white shadow flex items-center justify-center text-sm" style={{ background: TYPE_COLORS[type] + '18', borderColor: TYPE_COLORS[type] }}>
                  {type === 'patrimonio' ? '🏠' : type === 'projeto' ? '🏗' : type === 'empresa' ? '🏢' : type === 'usina_solar' ? '☀️' : '🚗'}
                </div>
                <span className="text-xs text-gray-600">{label}</span>
                <span className="text-xs text-gray-400">({countByType[type] || 0})</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-300 mt-3">
            O ponto colorido no canto inferior direito do ícone indica o status. Endereços sem coordenadas são geocodificados automaticamente via Nominatim/OpenStreetMap.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}

function Button({ onClick, variant, size, disabled, children }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
        variant === 'outline'
          ? 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          : 'bg-[#0f172a] text-white hover:bg-[#1e293b]'
      }`}
    >
      {children}
    </button>
  )
}
