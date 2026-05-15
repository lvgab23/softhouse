'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { MapItem } from '@/components/maps/leaflet-map'

const LeafletMap = dynamic(() => import('@/components/maps/leaflet-map'), {
  ssr: false,
  loading: () => <div className="w-full h-72 bg-gray-100 rounded-xl animate-pulse" />,
})

export interface UsinaMapEntry {
  id: string
  nome: string
  cidade?: string
  estado?: string
  status: string
  isGenerating?: boolean
  currentPower?: number
  todayKwh?: number
  monthKwh?: number
}

async function geocodeCidade(cidade: string, estado?: string): Promise<[number, number] | null> {
  try {
    const q = encodeURIComponent(`${cidade}${estado ? `, ${estado}` : ''}, Brasil`)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=br`,
      { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'SoftHouseApp/1.0' } }
    )
    const data = await res.json()
    if (data[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)]
  } catch {}
  return null
}

export function UsinasMap({ usinas, height = 320 }: { usinas: UsinaMapEntry[]; height?: number }) {
  const [items, setItems] = useState<MapItem[]>([])
  const [geocoding, setGeocoding] = useState(true)

  useEffect(() => {
    if (!usinas.length) { setGeocoding(false); return }
    setGeocoding(true)
    setItems([])

    const load = async () => {
      const resolved: MapItem[] = []
      for (const u of usinas) {
        if (!u.cidade) continue
        // Nominatim pede 1 req/s
        await new Promise(r => setTimeout(r, 400))
        const coords = await geocodeCidade(u.cidade, u.estado)
        if (!coords) continue

        const statusKey = u.isGenerating ? 'gerando' : u.status === 'ativa' ? 'ativa' : 'offline'
        const sub = u.isGenerating
          ? `Gerando ${u.currentPower?.toFixed(1)} kW · Hoje: ${u.todayKwh?.toFixed(1)} kWh`
          : u.status === 'ativa' ? 'Ativa · sem geração no momento' : 'Offline'

        resolved.push({
          id: u.id,
          nome: u.nome,
          tipo: 'usina_solar',
          latitude: coords[0],
          longitude: coords[1],
          status: statusKey,
          subtitulo: sub,
          localizacao: [u.cidade, u.estado].filter(Boolean).join(', '),
          valor: u.monthKwh,
        })
      }
      setItems(resolved)
      setGeocoding(false)
    }
    load()
  }, [usinas.map(u => u.id + u.cidade + u.estado).join(',')])  // eslint-disable-line

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-100" style={{ height }}>
      {geocoding && items.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10 gap-2">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-400">Localizando usinas no mapa...</p>
        </div>
      )}
      <LeafletMap items={items} />
    </div>
  )
}
