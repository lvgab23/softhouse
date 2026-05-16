import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const BASE      = 'https://iop.saj-electric.com/dev-api'
const USERNAME  = process.env.ELEKEEPER_USERNAME!
const PASSWORD  = process.env.ELEKEEPER_PASSWORD!
const PLANT_UID = process.env.ELEKEEPER_PLANT_UID!

const AES_KEY  = 'ec1840a7c53cf0709eb784be480379b6'
const SIGN_KEY = 'ktoKRLgQPjvNyUZO8lVc9kU1Bsip6XIe'
const CHARSET  = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678'

let cachedToken = ''
let tokenExpiry = 0

// ── Supabase admin client (service role — sem cookies) ─────────────────────

const clean = (s: string = '') => s.replace(/^﻿/, '').replace(/[^\x20-\x7E]/g, '').trim()

function sbAdmin() {
  return createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  )
}

// ── crypto helpers ──────────────────────────────────────────────────────────

function md5hex(s: string) { return crypto.createHash('md5').update(s, 'utf8').digest('hex') }
function sha1hex(s: string) { return crypto.createHash('sha1').update(s, 'utf8').digest('hex') }
function aesEncrypt(text: string): string {
  const key = Buffer.from(AES_KEY, 'hex')
  const cipher = crypto.createCipheriv('aes-128-ecb', key, null)
  return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('hex')
}
function randomStr(len = 32): string {
  let s = ''
  for (let i = 0; i < len; i++) s += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  return s
}

// ── signature ───────────────────────────────────────────────────────────────

function buildSignature(params: Record<string, string>): string {
  const kvPairs = Object.entries(params).map(([k, v]) => `${k}=${v}`)
  const sorted = [...kvPairs].sort((a, b) => {
    for (let i = 0; i < a.length && i < b.length; i++) {
      if (a.charCodeAt(i) !== b.charCodeAt(i)) return a.charCodeAt(i) - b.charCodeAt(i)
    }
    return a.length - b.length
  })
  return sha1hex(md5hex(sorted.join('&') + `&key=${SIGN_KEY}`)).toUpperCase()
}

function baseSignParams(): Record<string, string> {
  return {
    appProjectName: 'elekeeper',
    clientDate:     new Date().toISOString().slice(0, 10),
    clientId:       'esolar-monitor-admin',
    lang:           'en',
    random:         randomStr(),
    timeStamp:      Date.now().toString(),
  }
}

// ── login ───────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const sign = baseSignParams()
  const body = new URLSearchParams({
    username: USERNAME, password: aesEncrypt(PASSWORD), loginType: '1',
    ...sign, signParams: Object.keys(sign).join(','), signature: buildSignature(sign),
  })
  const res  = await fetch(`${BASE}/api/v1/sys/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const json = await res.json()
  if (json.errCode !== 0 || !json.data?.token) throw new Error(`Login failed: ${json.errMsg}`)

  cachedToken = json.data.token
  tokenExpiry = Date.now() + Math.max(0, json.data.expiresIn - 300) * 1000
  return cachedToken
}

// ── signed GET ──────────────────────────────────────────────────────────────

async function apiGet(path: string, token: string, extra: Record<string, string> = {}) {
  const params = { ...baseSignParams(), ...extra }
  const signParams = Object.keys(params).join(',')
  const signature  = buildSignature(params)
  const qs = new URLSearchParams({ ...params, signParams, signature }).toString()
  const res = await fetch(`${BASE}${path}?${qs}`, {
    headers: { Authorization: `Bearer ${token}`, lang: 'en' },
  })
  return res.json()
}

// ── notificações ─────────────────────────────────────────────────────────────

async function sendEmailAlert(to: string, plantName: string, tipo: string, descricao: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) return
  const subject = tipo === 'offline'
    ? `⚠️ Usina ${plantName} está OFFLINE`
    : `⚠️ Alerta na Usina ${plantName}`
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.ALERT_FROM_EMAIL || 'alertas@softhouse.app',
      to,
      subject,
      html: `<p><strong>${plantName}</strong>: ${descricao}</p><p>Data/hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>`,
    }),
  }).catch(() => {})
}

async function sendWhatsappAlert(numero: string, plantName: string, descricao: string) {
  const instanceId = process.env.ZAPI_INSTANCE_ID
  const token      = process.env.ZAPI_TOKEN
  if (!instanceId || !token) return
  const phone = numero.replace(/\D/g, '')
  await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, message: `⚠️ *${plantName}*\n${descricao}\n${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` }),
  }).catch(() => {})
}

// ── persistir leitura + checar alarmes ──────────────────────────────────────

async function persistReading(usinaId: string, data: {
  kwh: number, potencia_pico_kw: number, eficiencia: number, status: string
}) {
  const sb = sbAdmin()
  const hoje = new Date().toISOString().slice(0, 10)

  // Upsert leitura diária
  await sb.from('usinas_solares_leituras').upsert({
    usina_id: usinaId,
    data: hoje,
    kwh: data.kwh,
    potencia_pico_kw: data.potencia_pico_kw,
    eficiencia: data.eficiencia,
    source: 'api',
  }, { onConflict: 'usina_id,data' })

  // Checar se entrou offline — criar alarme e notificar
  if (data.status === 'offline') {
    // Verificar se já existe alarme ativo
    const { data: alarmeExistente } = await sb
      .from('usinas_solares_alarmes')
      .select('id')
      .eq('usina_id', usinaId)
      .eq('tipo', 'offline')
      .eq('ativo', true)
      .maybeSingle()

    if (!alarmeExistente) {
      const { data: usina } = await sb
        .from('usinas_solares')
        .select('nome, email_alerta, whatsapp_numero, alertas_ativo')
        .eq('id', usinaId)
        .single()

      const descricao = `Usina ficou offline em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
      await sb.from('usinas_solares_alarmes').insert({
        usina_id: usinaId,
        tipo: 'offline',
        severidade: 'critical',
        descricao,
      })

      if (usina?.alertas_ativo) {
        if (usina.email_alerta) await sendEmailAlert(usina.email_alerta, usina.nome, 'offline', descricao)
        if (usina.whatsapp_numero) await sendWhatsappAlert(usina.whatsapp_numero, usina.nome, descricao)
        await sb.from('usinas_solares_alarmes').update({ notificado: true, notificado_em: new Date().toISOString() })
          .eq('usina_id', usinaId).eq('tipo', 'offline').eq('ativo', true)
      }
    }
  } else {
    // Usina online — resolver alarmes offline ativos
    await sb.from('usinas_solares_alarmes')
      .update({ ativo: false, resolvido_em: new Date().toISOString() })
      .eq('usina_id', usinaId).eq('tipo', 'offline').eq('ativo', true)
  }
}

// ── estimativas quando DB ainda não tem histórico ───────────────────────────
// Curva solar hemisfério sul (Jan=0..Dez=11) — mais geração no verão austral
const SOLAR_CURVE = [1.05, 1.00, 0.95, 0.85, 0.75, 0.68, 0.70, 0.78, 0.88, 0.97, 1.05, 1.10]

async function estimateMensal(mes: string, plantUid: string) {
  try {
    const token = await getToken()
    const listRes = await apiGet('/api/v1/monitor/plant/getPlantList', token, { pageNo: '1', pageSize: '10' })
    const plant = listRes.data?.list?.[0]
    const monthTotal = plant?.monthEnergy ?? 0

    const [y, m] = mes.split('-').map(Number)
    const today = new Date()
    const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m
    const daysToShow = isCurrentMonth ? today.getDate() : new Date(y, m, 0).getDate()
    const daysInMonth = new Date(y, m, 0).getDate()

    const dailyAvg = daysToShow > 0 ? monthTotal / daysToShow : 0
    const data = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const d = `${mes}-${String(day).padStart(2, '0')}`
      const kwh = day <= daysToShow ? parseFloat((dailyAvg * (0.85 + Math.random() * 0.3)).toFixed(1)) : 0
      return { data: d, kwh }
    })
    return NextResponse.json({ ok: true, data, estimated: true, needsMigration: true })
  } catch {
    return NextResponse.json({ ok: true, data: [], needsMigration: true })
  }
}

async function estimateAnual(ano: string, plantUid: string) {
  try {
    const token = await getToken()
    const listRes = await apiGet('/api/v1/monitor/plant/getPlantList', token, { pageNo: '1', pageSize: '10' })
    const plant = listRes.data?.list?.[0]
    const yearTotal = plant?.yearEnergy ?? 0

    const currentYear = new Date().getFullYear()
    const isCurrentYear = parseInt(ano) === currentYear
    const currentMonth = isCurrentYear ? new Date().getMonth() : 11 // índice 0-11

    // Distribui yearTotal proporcionalmente pela curva solar nos meses passados
    const pastCurve = SOLAR_CURVE.slice(0, currentMonth + 1)
    const pastSum = pastCurve.reduce((a, b) => a + b, 0)

    const meses = Array.from({ length: 12 }, (_, i) => {
      const m = `${ano}-${String(i + 1).padStart(2, '0')}`
      const kwh = i <= currentMonth && pastSum > 0
        ? parseFloat((yearTotal * (SOLAR_CURVE[i] / pastSum)).toFixed(1))
        : 0
      return { mes: m, kwh }
    })
    return NextResponse.json({ ok: true, data: meses, estimated: true, needsMigration: true })
  } catch {
    return NextResponse.json({ ok: true, data: Array.from({ length: 12 }, (_, i) => ({ mes: `${ano}-${String(i+1).padStart(2,'0')}`, kwh: 0 })), needsMigration: true })
  }
}

// ── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action   = searchParams.get('action') || 'status'
  const plantUid = searchParams.get('plantUid') || PLANT_UID
  const date     = searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const usinaId  = searchParams.get('usinaId') || ''
  const mes      = searchParams.get('mes') || new Date().toISOString().slice(0, 7)
  const ano      = searchParams.get('ano') || new Date().getFullYear().toString()

  // ── Leituras do banco (não precisam da API SAJ) ──────────────────────────
  if (action === 'mensal' && usinaId) {
    try {
      const sb = sbAdmin()
      const { data, error } = await sb.from('usinas_solares_leituras')
        .select('data, kwh, eficiencia')
        .eq('usina_id', usinaId)
        .gte('data', `${mes}-01`)
        .lte('data', `${mes}-31`)
        .order('data')
      if (error) {
        // Fallback: estima distribuição com base no monthEnergy da API
        return await estimateMensal(mes, plantUid)
      }
      return NextResponse.json({ ok: true, data: data || [] })
    } catch { return await estimateMensal(mes, plantUid) }
  }

  if (action === 'anual' && usinaId) {
    try {
      const sb = sbAdmin()
      const { data, error } = await sb.from('usinas_solares_leituras')
        .select('data, kwh')
        .eq('usina_id', usinaId)
        .gte('data', `${ano}-01-01`)
        .lte('data', `${ano}-12-31`)
        .order('data')
      if (error) {
        return await estimateAnual(ano, plantUid)
      }
      const byMonth: Record<string, number> = {}
      for (const row of data || []) {
        const m = (row.data as string).slice(0, 7)
        byMonth[m] = (byMonth[m] || 0) + Number(row.kwh)
      }
      const meses = Array.from({ length: 12 }, (_, i) => {
        const m = `${ano}-${String(i + 1).padStart(2, '0')}`
        return { mes: m, kwh: parseFloat((byMonth[m] || 0).toFixed(1)) }
      })
      return NextResponse.json({ ok: true, data: meses })
    } catch { return await estimateAnual(ano, plantUid) }
  }

  if (action === 'alarmes' && usinaId) {
    try {
      const sb = sbAdmin()
      const { data, error } = await sb.from('usinas_solares_alarmes')
        .select('*')
        .eq('usina_id', usinaId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) return NextResponse.json({ ok: true, data: [], needsMigration: true })
      return NextResponse.json({ ok: true, data: data || [] })
    } catch { return NextResponse.json({ ok: true, data: [], needsMigration: true }) }
  }

  if (action === 'resolver_alarme') {
    const alarmeId = searchParams.get('alarmeId')
    if (!alarmeId) return NextResponse.json({ error: 'alarmeId required' }, { status: 400 })
    const sb = sbAdmin()
    await sb.from('usinas_solares_alarmes')
      .update({ ativo: false, resolvido_em: new Date().toISOString() })
      .eq('id', alarmeId)
    return NextResponse.json({ ok: true })
  }

  // ── Chamadas à API SAJ Electric ──────────────────────────────────────────
  try {
    const token = await getToken()

    if (action === 'status') {
      const [listRes, homeRes, powerRes] = await Promise.all([
        apiGet('/api/v1/monitor/plant/getPlantList', token, { pageNo: '1', pageSize: '10' }),
        apiGet('/api/v1/monitor/home/getHomeEneryStatisticsData', token),
        apiGet('/api/v1/monitor/home/getHomePowerStatisticsData', token),
      ])

      const plant = listRes.data?.list?.[0]
      const home  = homeRes.data || {}
      const power = powerRes.data || {}

      if (!plant) return NextResponse.json({ error: 'Plant not found', mock: true, data: getMockData('status', date) })

      const result = {
        plantName:    plant.plantName,
        status:       plant.isOnline === 'Y' ? 'online' : 'offline',
        currentPower: parseFloat((plant.powerNow / 1000).toFixed(2)),
        todayEnergy:  plant.todayEnergy,
        monthEnergy:  plant.monthEnergy,
        yearEnergy:   plant.yearEnergy,
        totalEnergy:  plant.totalEnergy,
        systemPower:  plant.systemPower,
        efficiency:   power.pvEfficiency || 0,
        co2Saved:     home.reduceCo2 || 0,
        treesPlanted: home.plantTreeNum || 0,
        currency:     plant.currency || 'R$',
      }

      // Persistir leitura + checar alarmes (async, não bloqueia resposta)
      if (usinaId) {
        persistReading(usinaId, {
          kwh: plant.todayEnergy,
          potencia_pico_kw: result.currentPower,
          eficiencia: result.efficiency,
          status: result.status,
        }).catch(() => {})
      }

      return NextResponse.json({ ok: true, data: result })
    }

    if (action === 'daily') {
      const [curveRes, statusRes] = await Promise.all([
        apiGet('/api/v1/monitor/dataViews/getPlantPowerAndPVPowerCurve', token, { plantUid, date }),
        apiGet('/api/v1/monitor/plant/getPlantList', token, { pageNo: '1', pageSize: '10' }),
      ])

      if (curveRes.errCode === 0 && curveRes.data?.pvPower?.length) {
        const points = curveRes.data.pvPower
        return NextResponse.json({ ok: true, data: { date, hours: points, totalKwh: curveRes.data.pvEnergy || 0 } })
      }

      const plant = statusRes.data?.list?.[0]
      const todayKwh = date === new Date().toISOString().slice(0, 10) ? (plant?.todayEnergy ?? null) : null
      return NextResponse.json({ mock: true, data: getMockData('daily', date, todayKwh) })
    }

    if (action === 'history') {
      // Tenta DB primeiro se usinaId disponível
      if (usinaId) {
        try {
        const sb = sbAdmin()
        const startDate = new Date(date)
        startDate.setDate(startDate.getDate() - 29)
        const { data: rows, error } = await sb.from('usinas_solares_leituras')
          .select('data, kwh')
          .eq('usina_id', usinaId)
          .gte('data', startDate.toISOString().slice(0, 10))
          .lte('data', date)
          .order('data')

        if (!error && rows && rows.length >= 3) {
          const days = rows.map((r: any) => ({ date: r.data, kwh: Number(r.kwh) }))
          return NextResponse.json({ ok: true, data: { days } })
        }
        } catch { /* tabela não existe ainda, usa mock */ }
      }
      return NextResponse.json({ mock: true, data: getMockData('history', date) })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err: any) {
    console.error('[elekeeper]', err.message)
    return NextResponse.json({ error: err.message, mock: true, data: getMockData(action, date) }, { status: 200 })
  }
}

// ── mock fallback ─────────────────────────────────────────────────────────────

function getMockData(action: string, date: string, todayKwh: number | null = null) {
  if (action === 'status') {
    return {
      plantName: 'Usina Solar Cachoeira', status: 'online',
      currentPower: 0, todayEnergy: 0, monthEnergy: 0,
      yearEnergy: 0, totalEnergy: 0, systemPower: 30, efficiency: 0, co2Saved: 0, treesPlanted: 0,
    }
  }
  if (action === 'daily') {
    const rawHours = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, '0')}:00`,
      power: (h >= 7 && h <= 17) ? Math.max(0, Math.sin(Math.PI * (h - 6) / 12)) * (0.85 + Math.random() * 0.3) : 0,
    }))
    const rawTotal = rawHours.reduce((s, h) => s + h.power, 0)
    const targetKwh = todayKwh ?? 180
    const scale = rawTotal > 0 ? targetKwh / rawTotal : 1
    return { date, hours: rawHours.map(h => ({ ...h, power: parseFloat((h.power * scale).toFixed(2)) })), totalKwh: targetKwh }
  }
  if (action === 'history') {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(date); d.setDate(d.getDate() - 29 + i)
      return { date: d.toISOString().slice(0, 10), kwh: parseFloat((140 + Math.random() * 100).toFixed(1)) }
    })
    return { days }
  }
  return {}
}
