'use client'

import { useEffect, useRef } from 'react'
import { formatBRL } from '@/lib/utils'

export type MapItemType = 'patrimonio' | 'projeto' | 'empresa' | 'bem_movel' | 'usina_solar'

export interface MapItem {
  id: string
  nome: string
  tipo: MapItemType
  latitude: number
  longitude: number
  status?: string
  valor?: number
  subtitulo?: string
  localizacao?: string
}

const TYPE_CONFIG: Record<MapItemType, { color: string; label: string; bg: string; emoji: string }> = {
  patrimonio:   { color: '#3b82f6', label: 'Imóvel',       bg: '#eff6ff', emoji: '🏠' },
  projeto:      { color: '#8b5cf6', label: 'Projeto',      bg: '#f5f3ff', emoji: '🏗' },
  empresa:      { color: '#f59e0b', label: 'Empresa',      bg: '#fffbeb', emoji: '🏢' },
  bem_movel:    { color: '#22c55e', label: 'Bem Móvel',    bg: '#f0fdf4', emoji: '🚗' },
  usina_solar:  { color: '#f59e0b', label: 'Usina Solar',  bg: '#fffbeb', emoji: '☀️' },
}

const STATUS_COLORS: Record<string, string> = {
  ativo: '#22c55e', alugado: '#3b82f6', manutencao: '#f97316',
  inativo: '#94a3b8', negociacao: '#f59e0b', vendido: '#ef4444',
  ativa: '#22c55e', em_construcao: '#f97316', concluido: '#6366f1',
  gerando: '#22c55e', online: '#22c55e', offline: '#ef4444',
}

interface Props {
  items: MapItem[]
}

export default function LeafletMap({ items }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false

    // Clean up any existing map instance before creating a new one
    if (mapRef.current) {
      try { mapRef.current.remove() } catch (_) {}
      mapRef.current = null
    }
    // Leaflet stores state on the container element — must be cleared between mounts
    delete (container as any)._leaflet_id

    import('leaflet').then((mod) => {
      if (cancelled || !container.isConnected) return

      // Webpack 5 wraps CJS modules — handle both interop styles
      const L: any = (mod as any).default ?? mod

      const center: [number, number] = items.length > 0
        ? [items[0].latitude, items[0].longitude]
        : [-15.7801, -47.9292]

      const map = L.map(container, {
        center,
        zoom: items.length > 0 ? (items.length === 1 ? 14 : 12) : 5,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      items.forEach((item) => {
        const tc = TYPE_CONFIG[item.tipo] ?? TYPE_CONFIG.patrimonio
        const statusColor = item.status ? (STATUS_COLORS[item.status] ?? tc.color) : tc.color

        const icon = L.divIcon({
          className: '',
          html: `<div style="position:relative;width:38px;height:38px;">
            <div style="
              width:36px;height:36px;
              background:${tc.bg};
              border:2.5px solid ${tc.color};
              border-radius:50%;
              box-shadow:0 3px 12px rgba(0,0,0,0.22);
              display:flex;align-items:center;justify-content:center;
              font-size:17px;line-height:1;
            ">${tc.emoji}</div>
            <div style="
              position:absolute;bottom:1px;right:1px;
              width:11px;height:11px;
              background:${statusColor};
              border:2px solid white;
              border-radius:50%;
            "></div>
          </div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 38],
          popupAnchor: [0, -40],
        })

        const marker = L.marker([item.latitude, item.longitude], { icon }).addTo(map)

        marker.bindPopup(`
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:4px 2px;min-width:200px;">
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:7px;">
              <span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:10px;font-weight:600;background:${tc.bg};color:${tc.color};border:1px solid ${tc.color}30;">${tc.label}</span>
              ${item.status ? `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:10px;font-weight:600;background:${statusColor}20;color:${statusColor};">${item.status}</span>` : ''}
            </div>
            <p style="font-weight:700;font-size:13px;margin:0 0 4px;color:#0f172a;">${item.nome}</p>
            ${item.subtitulo ? `<p style="color:#64748b;font-size:11px;margin:0 0 3px;">${item.subtitulo}</p>` : ''}
            ${item.localizacao ? `<p style="color:#94a3b8;font-size:10px;margin:0 0 7px;">📍 ${item.localizacao}</p>` : ''}
            ${item.valor ? `<p style="font-size:14px;font-weight:700;color:#0f172a;margin:0;">${formatBRL(item.valor)}</p>` : ''}
          </div>
        `, { maxWidth: 280 })
      })

      if (items.length > 1) {
        try {
          const bounds = L.latLngBounds(items.map(i => [i.latitude, i.longitude] as [number, number]))
          map.fitBounds(bounds.pad(0.2))
        } catch (_) {}
      }

      mapRef.current = map
    }).catch((err) => {
      console.error('[LeafletMap] Failed to load Leaflet:', err)
    })

    return () => {
      cancelled = true
      if (mapRef.current) {
        try { mapRef.current.remove() } catch (_) {}
        mapRef.current = null
      }
      if (container) delete (container as any)._leaflet_id
    }
  }, [items])

  return (
    <div
      ref={containerRef}
      style={{ height: '540px', width: '100%' }}
    />
  )
}
