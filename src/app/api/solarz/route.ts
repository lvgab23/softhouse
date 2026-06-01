import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'

const BASE        = 'https://app.solarz.com.br'
const BASE_PUBLIC = `${BASE}/shareable`
const BASE_AUTH   = `${BASE}/api-sz`

const clean = (s: string = '') => s.replace(/^﻿/, '').replace(/[^\x20-\x7E]/g, '').trim()

function sbAdmin() {
  return createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  )
}

// ── Token cache ──────────────────────────────────────────────────────────────
let cachedToken  = ''
let tokenExpiry  = 0

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const username = process.env.SOLARZ_USERNAME
  const password = process.env.SOLARZ_PASSWORD
  if (!username || !password) throw new Error('SOLARZ_USERNAME ou SOLARZ_PASSWORD não configurados')

  const res = await fetch(`${BASE}/cliente/authenticate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body:    JSON.stringify({ username, password }),
  })
  const json = await res.json()
  if (json.error || !json.token) throw new Error(json.error || 'SolarZ: login falhou')

  cachedToken = json.token
  tokenExpiry = Date.now() + 55 * 60 * 1000 // 55 min
  return cachedToken
}

async function authGet(path: string) {
  const token = await getToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  })
  return res.json()
}

async function publicGet(path: string, params: Record<string, string> = {}) {
  const qs  = new URLSearchParams(params).toString()
  const url = `${BASE_PUBLIC}${path}${qs ? '?' + qs : ''}`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  return res.json()
}

// ── Persiste leitura + alarmes ───────────────────────────────────────────────
async function persistReading(usinaId: string, kwh: number, status: string) {
  if (!usinaId) return
  const sb   = sbAdmin()
  const hoje = new Date().toISOString().slice(0, 10)
  await sb.from('usinas_solares_leituras').upsert(
    { usina_id: usinaId, data: hoje, kwh, source: 'solarz' },
    { onConflict: 'usina_id,data' }
  )
  if (status === 'offline') {
    const { data: ex } = await sb.from('usinas_solares_alarmes')
      .select('id').eq('usina_id', usinaId).eq('tipo', 'offline').eq('ativo', true).maybeSingle()
    if (!ex) {
      await sb.from('usinas_solares_alarmes').insert({
        usina_id: usinaId, tipo: 'offline', severidade: 'critical',
        descricao: `Usina ficou offline em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      })
    }
  } else {
    await sb.from('usinas_solares_alarmes')
      .update({ ativo: false, resolvido_em: new Date().toISOString() })
      .eq('usina_id', usinaId).eq('tipo', 'offline').eq('ativo', true)
  }
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const action  = searchParams.get('action') || 'status'
  const uuid    = searchParams.get('uuid')    || ''
  const usinaId = searchParams.get('usinaId') || ''
  const mes     = searchParams.get('mes')     || new Date().toISOString().slice(0, 7)
  const ano     = searchParams.get('ano')     || new Date().getFullYear().toString()
  const date    = searchParams.get('date')    || new Date().toISOString().slice(0, 10)

  if (!uuid) return NextResponse.json({ error: 'uuid required' }, { status: 400 })

  try {
    // ── Leituras do banco ──────────────────────────────────────────────────
    if (action === 'mensal' && usinaId) {
      const sb = sbAdmin()
      const { data } = await sb.from('usinas_solares_leituras')
        .select('data, kwh').eq('usina_id', usinaId)
        .gte('data', `${mes}-01`).lte('data', `${mes}-31`).order('data')

      if (data && data.length >= 3) return NextResponse.json({ ok: true, data })

      // Fallback: distribui o total do mês
      const gen = await publicGet('/generations/usina', { uuid })
      const monthTotal  = gen.essaMes || 0
      const [y, m]      = mes.split('-').map(Number)
      const daysInMonth = new Date(y, m, 0).getDate()
      const today       = new Date()
      const isCurrMonth = today.getFullYear() === y && today.getMonth() + 1 === m
      const daysToShow  = isCurrMonth ? today.getDate() : daysInMonth
      const dailyAvg    = daysToShow > 0 ? monthTotal / daysToShow : 0
      const estimated   = Array.from({ length: daysInMonth }, (_, i) => ({
        data: `${mes}-${String(i + 1).padStart(2, '0')}`,
        kwh:  i + 1 <= daysToShow ? parseFloat((dailyAvg * (0.85 + Math.random() * 0.3)).toFixed(1)) : 0,
      }))
      return NextResponse.json({ ok: true, data: estimated, estimated: true })
    }

    if (action === 'anual' && usinaId) {
      const sb = sbAdmin()
      const { data } = await sb.from('usinas_solares_leituras')
        .select('data, kwh').eq('usina_id', usinaId)
        .gte('data', `${ano}-01-01`).lte('data', `${ano}-12-31`).order('data')

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

      const gen = await publicGet('/generations/usina', { uuid })
      const yearTotal  = gen.essaAno || 0
      const CURVE      = [1.05,1.00,0.95,0.85,0.75,0.68,0.70,0.78,0.88,0.97,1.05,1.10]
      const curMonth   = parseInt(ano) === new Date().getFullYear() ? new Date().getMonth() : 11
      const pastCurve  = CURVE.slice(0, curMonth + 1)
      const pastSum    = pastCurve.reduce((a, b) => a + b, 0)
      const meses      = Array.from({ length: 12 }, (_, i) => ({
        mes: `${ano}-${String(i + 1).padStart(2, '0')}`,
        kwh: i <= curMonth && pastSum > 0 ? parseFloat((yearTotal * (CURVE[i] / pastSum)).toFixed(1)) : 0,
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

    // ── Status em tempo real (com autenticação) ────────────────────────────
    if (action === 'status') {
      // 1. Dados públicos (geração acumulada + eco)
      const [plant, gen, currently, eco] = await Promise.all([
        publicGet('/usina', { uuid }),
        publicGet('/generations/usina', { uuid }),
        publicGet('/currently/usina', { uuid }),
        publicGet('/eco', { uuid }),
      ])

      const plantId    = plant.id as number | null
      const isOnline   = currently?.status?.codigo === 0
      const yesterdayKwh = gen.ontem    || 0
      const monthKwh   = gen.essaMes    || 0
      const yearKwh    = gen.essaAno    || 0
      const totalKwh   = gen.ultimos365Dias || 0

      // 2. Potência atual via API autenticada
      let currentPower = 0
      let todayKwh     = yesterdayKwh

      if (plantId && process.env.SOLARZ_USERNAME) {
        try {
          const today   = new Date().toISOString().slice(0, 10)
          const dayData = await authGet(`/api-sz/generation/day?usinaId=${plantId}&day=${today}&unitePortals=true`)

          // Formato real: { dados: [{time, labeledValue: {value: kW}, identificar}] }
          const points: any[] = dayData?.dados || dayData?.data || []

          if (points.length > 0) {
            // Ordena por hora para pegar o mais recente
            const sorted = [...points].sort((a, b) => (a.time > b.time ? 1 : -1))

            // Potência atual = último ponto com valor > 0
            const lastPoint = [...sorted].reverse().find((p: any) => (p.labeledValue?.value ?? 0) > 0)
            if (lastPoint) {
              currentPower = parseFloat((lastPoint.labeledValue?.value ?? 0).toFixed(2))
            }

            // Geração de hoje = integração (kW × 5min/60 = kWh por intervalo)
            const totalKw = points.reduce((s: number, p: any) => s + (p.labeledValue?.value ?? 0), 0)
            if (totalKw > 0) todayKwh = parseFloat((totalKw * (5 / 60)).toFixed(1))
          }
        } catch (e) {
          console.error('[solarz auth]', e)
        }
      }

      const result = {
        plantName:    plant.name || 'Usina SolarZ',
        status:       isOnline ? 'online' : 'offline',
        currentPower,
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

      if (usinaId) persistReading(usinaId, todayKwh, result.status).catch(() => {})
      return NextResponse.json({ ok: true, data: result })
    }

    // ── Curva diária (via API autenticada) ────────────────────────────────
    if (action === 'daily') {
      const plant  = await publicGet('/usina', { uuid })
      const plantId = plant.id as number | null

      if (plantId && process.env.SOLARZ_USERNAME) {
        try {
          const dayData = await authGet(`/api-sz/generation/day?usinaId=${plantId}&day=${date}&unitePortals=true`)
          const points: any[] = dayData?.dados || dayData?.data || []

          if (points.length > 0) {
            const sorted = [...points].sort((a: any, b: any) => (a.time > b.time ? 1 : -1))
            const hours = sorted.map((p: any) => ({
              hour:  p.time || '',
              power: parseFloat((p.labeledValue?.value ?? 0).toFixed(2)),
            }))
            const totalKwh = parseFloat((hours.reduce((s, h) => s + h.power, 0) * (5 / 60)).toFixed(1))
            return NextResponse.json({ ok: true, data: { date, hours, totalKwh } })
          }
        } catch (e) {
          console.error('[solarz daily auth]', e)
        }
      }

      // Fallback mock baseado na geração de ontem
      const gen      = await publicGet('/generations/usina', { uuid })
      const todayKwh = gen.ontem || 0
      const rawHours = Array.from({ length: 24 }, (_, h) => ({
        hour:  `${String(h).padStart(2, '0')}:00`,
        power: (h >= 6 && h <= 18) ? Math.max(0, Math.sin(Math.PI * (h - 5) / 13)) * (0.85 + Math.random() * 0.3) : 0,
      }))
      const rawTotal = rawHours.reduce((s, h) => s + h.power, 0)
      const scale    = rawTotal > 0 ? todayKwh / rawTotal : 1
      return NextResponse.json({
        mock: true,
        data: {
          date,
          hours:    rawHours.map(h => ({ ...h, power: parseFloat((h.power * scale).toFixed(2)) })),
          totalKwh: todayKwh,
        },
      })
    }

    // ── Debug: ver resposta bruta da API autenticada ─────────────────────
    if (action === 'debug') {
      const plant   = await publicGet('/usina', { uuid })
      const plantId = plant.id as number | null
      const today   = new Date().toISOString().slice(0, 10)

      let tokenResult = 'sem credenciais configuradas'
      let dayResult: any = null
      let contextResult: any = null

      if (process.env.SOLARZ_USERNAME) {
        try {
          const token = await getToken()
          tokenResult = `token obtido (${token.slice(0, 20)}...)`

          // Tenta buscar context para ver formato de retorno
          contextResult = await authGet('/cliente/context')

          if (plantId) {
            dayResult = await authGet(`/api-sz/generation/day?usinaId=${plantId}&day=${today}&unitePortals=true`)
          }
        } catch (e: any) {
          tokenResult = `ERRO: ${e.message}`
        }
      }

      return NextResponse.json({
        plant_id: plantId,
        plant_name: plant.name,
        uuid,
        today,
        token_status: tokenResult,
        day_raw: dayResult,
        context_raw: contextResult ? JSON.stringify(contextResult).slice(0, 500) : null,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err: any) {
    console.error('[solarz]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
