import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'

const BASE = 'https://app.solarz.com.br/shareable'

const clean = (s: string = '') => s.replace(/^﻿/, '').replace(/[^\x20-\x7E]/g, '').trim()

function sbAdmin() {
  return createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  )
}

async function fetchSolarZ(path: string, uuid: string) {
  const res = await fetch(`${BASE}${path}?uuid=${uuid}`, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 300 }, // cache 5 min
  })
  if (!res.ok) throw new Error(`SolarZ ${path} error: ${res.status}`)
  return res.json()
}

async function persistReading(usinaId: string, kwh: number, status: string) {
  if (!usinaId || !kwh) return
  const sb = sbAdmin()
  const hoje = new Date().toISOString().slice(0, 10)
  await sb.from('usinas_solares_leituras').upsert({
    usina_id: usinaId,
    data: hoje,
    kwh,
    source: 'solarz',
  }, { onConflict: 'usina_id,data' })

  if (status === 'offline') {
    const { data: alarmeExistente } = await sb
      .from('usinas_solares_alarmes')
      .select('id')
      .eq('usina_id', usinaId)
      .eq('tipo', 'offline')
      .eq('ativo', true)
      .maybeSingle()

    if (!alarmeExistente) {
      await sb.from('usinas_solares_alarmes').insert({
        usina_id: usinaId,
        tipo: 'offline',
        severidade: 'critical',
        descricao: `Usina ficou offline em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      })
    }
  } else {
    await sb.from('usinas_solares_alarmes')
      .update({ ativo: false, resolvido_em: new Date().toISOString() })
      .eq('usina_id', usinaId).eq('tipo', 'offline').eq('ativo', true)
  }
}

export async function GET(req: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const action  = searchParams.get('action') || 'status'
  const uuid    = searchParams.get('uuid') || ''
  const usinaId = searchParams.get('usinaId') || ''
  const mes     = searchParams.get('mes') || new Date().toISOString().slice(0, 7)
  const ano     = searchParams.get('ano') || new Date().getFullYear().toString()

  if (!uuid) return NextResponse.json({ error: 'uuid required' }, { status: 400 })

  try {
    // ── Leituras do banco ────────────────────────────────────────────────────
    if (action === 'mensal' && usinaId) {
      const sb = sbAdmin()
      const { data } = await sb.from('usinas_solares_leituras')
        .select('data, kwh')
        .eq('usina_id', usinaId)
        .gte('data', `${mes}-01`)
        .lte('data', `${mes}-31`)
        .order('data')

      if (data && data.length >= 3) {
        return NextResponse.json({ ok: true, data })
      }

      // Fallback: estima distribuição baseada no total do mês
      const gen = await fetchSolarZ('/generations/usina', uuid)
      const monthTotal = gen.essaMes || 0
      const [y, m] = mes.split('-').map(Number)
      const daysInMonth = new Date(y, m, 0).getDate()
      const today = new Date()
      const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m
      const daysToShow = isCurrentMonth ? today.getDate() : daysInMonth
      const dailyAvg = daysToShow > 0 ? monthTotal / daysToShow : 0

      const estimated = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1
        return {
          data: `${mes}-${String(day).padStart(2, '0')}`,
          kwh: day <= daysToShow ? parseFloat((dailyAvg * (0.85 + Math.random() * 0.3)).toFixed(1)) : 0,
        }
      })
      return NextResponse.json({ ok: true, data: estimated, estimated: true })
    }

    if (action === 'anual' && usinaId) {
      const sb = sbAdmin()
      const { data } = await sb.from('usinas_solares_leituras')
        .select('data, kwh')
        .eq('usina_id', usinaId)
        .gte('data', `${ano}-01-01`)
        .lte('data', `${ano}-12-31`)
        .order('data')

      if (data && data.length > 0) {
        const byMonth: Record<string, number> = {}
        for (const row of data) {
          const m = (row.data as string).slice(0, 7)
          byMonth[m] = (byMonth[m] || 0) + Number(row.kwh)
        }
        const meses = Array.from({ length: 12 }, (_, i) => {
          const m = `${ano}-${String(i + 1).padStart(2, '0')}`
          return { mes: m, kwh: parseFloat((byMonth[m] || 0).toFixed(1)) }
        })
        return NextResponse.json({ ok: true, data: meses })
      }

      // Fallback: distribui o total anual por curva solar
      const gen = await fetchSolarZ('/generations/usina', uuid)
      const yearTotal = gen.essaAno || 0
      const SOLAR_CURVE = [1.05,1.00,0.95,0.85,0.75,0.68,0.70,0.78,0.88,0.97,1.05,1.10]
      const curMonth = parseInt(ano) === new Date().getFullYear() ? new Date().getMonth() : 11
      const pastCurve = SOLAR_CURVE.slice(0, curMonth + 1)
      const pastSum = pastCurve.reduce((a, b) => a + b, 0)
      const meses = Array.from({ length: 12 }, (_, i) => ({
        mes: `${ano}-${String(i + 1).padStart(2, '0')}`,
        kwh: i <= curMonth && pastSum > 0
          ? parseFloat((yearTotal * (SOLAR_CURVE[i] / pastSum)).toFixed(1))
          : 0,
      }))
      return NextResponse.json({ ok: true, data: meses, estimated: true })
    }

    if (action === 'alarmes' && usinaId) {
      const sb = sbAdmin()
      const { data } = await sb.from('usinas_solares_alarmes')
        .select('*').eq('usina_id', usinaId)
        .order('created_at', { ascending: false }).limit(50)
      return NextResponse.json({ ok: true, data: data || [] })
    }

    // ── Status em tempo real ─────────────────────────────────────────────────
    if (action === 'status') {
      const [plant, gen, currently, eco] = await Promise.all([
        fetchSolarZ('/usina', uuid),
        fetchSolarZ('/generations/usina', uuid),
        fetchSolarZ('/currently/usina', uuid),
        fetchSolarZ('/eco', uuid),
      ])

      const isOnline = currently?.status?.codigo === 0
      const todayKwh = gen.ontem || 0
      const monthKwh = gen.essaMes || 0
      const yearKwh  = gen.essaAno || 0
      const totalKwh = gen.ultimos365Dias || 0

      const result = {
        plantName:    plant.name || 'Usina SolarZ',
        status:       isOnline ? 'online' : 'offline',
        currentPower: 0, // não disponível na API pública
        todayEnergy:  todayKwh,
        monthEnergy:  monthKwh,
        yearEnergy:   yearKwh,
        totalEnergy:  totalKwh,
        systemPower:  0,
        efficiency:   0,
        co2Saved:     eco?.co2 || 0,
        treesPlanted: eco?.arvores || 0,
        climate:      currently?.clima?.descricao || '',
        provider:     'solarz',
      }

      if (usinaId) {
        persistReading(usinaId, todayKwh, result.status).catch(() => {})
      }

      return NextResponse.json({ ok: true, data: result })
    }

    if (action === 'daily') {
      // SolarZ não fornece curva diária na API pública — retorna estimativa
      const gen = await fetchSolarZ('/generations/usina', uuid)
      const todayKwh = gen.ontem || 0
      const rawHours = Array.from({ length: 24 }, (_, h) => ({
        hour: `${String(h).padStart(2, '0')}:00`,
        power: (h >= 6 && h <= 18) ? Math.max(0, Math.sin(Math.PI * (h - 5) / 13)) * (0.85 + Math.random() * 0.3) : 0,
      }))
      const rawTotal = rawHours.reduce((s, h) => s + h.power, 0)
      const scale = rawTotal > 0 ? todayKwh / rawTotal : 1
      return NextResponse.json({
        mock: true,
        data: {
          date: new Date().toISOString().slice(0, 10),
          hours: rawHours.map(h => ({ ...h, power: parseFloat((h.power * scale).toFixed(2)) })),
          totalKwh: todayKwh,
        },
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err: any) {
    console.error('[solarz]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
