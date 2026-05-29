import { EngineResult, Finding } from '../types'

const BASE_V2 = 'https://api.escavador.com/api/v2'
const BASE_V1 = 'https://api.escavador.com/api/v1'

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
}

const TERMOS_CRIMINAIS = [
  'criminal', 'penal', 'crime', 'homicídio', 'homicidio', 'tráfico', 'trafico',
  'roubo', 'furto', 'corrupção', 'corrupcao', 'lavagem', 'estelionato', 'peculato',
  'extorsão', 'extorsao', 'inquérito', 'inquerito', 'ação penal', 'acao penal',
]

function isCriminal(texto: string): boolean {
  const t = texto.toLowerCase()
  return TERMOS_CRIMINAIS.some(k => t.includes(k))
}

function isAtivo(dataUltima: string | null | undefined): boolean {
  if (!dataUltima) return true
  const [y, m, d] = (dataUltima.includes('-') ? dataUltima : dataUltima.split('/').reverse().join('-')).split('-')
  if (!y || y.length !== 4) return true
  const data = new Date(`${y}-${m}-${d}`)
  const limite = new Date()
  limite.setFullYear(limite.getFullYear() - 3)
  return data > limite
}

async function getResumoEnvolvido(cpfCnpj: string, apiKey: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${BASE_V2}/envolvido/resumo?cpf_cnpj=${cpfCnpj}`,
      { headers: headers(apiKey), signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.quantidade_processos ?? data?.total ?? null
  } catch { return null }
}

function parseProcV2(proc: any): Finding {
  const numero = proc.numero_cnj || proc.numero || proc.numero_processo || ''
  const fontes: any[] = proc.fontes || []
  const tribunal = fontes[0]?.sigla || fontes[0]?.nome || proc.tribunal_sigla || proc.tribunal || 'N/A'

  // titulo_polo_* são nomes das partes, NÃO a classe do processo
  const nomePassivo = (proc.titulo_polo_passivo || '').substring(0, 80)
  const nomeAtivo   = (proc.titulo_polo_ativo   || '').substring(0, 80)

  // Polo do envolvido pesquisado — campo direto se vier; fallback INDEFINIDO
  const poloRaw = proc.polo_do_envolvido || proc.polo_envolvido || proc.polo || ''
  const poloPassivo = poloRaw
    ? /passiv|réu|reu|executad|reclamad|impetrad/i.test(poloRaw)
    : false
  const polo = poloRaw
    ? (poloPassivo ? 'PASSIVO' : 'ATIVO')
    : 'INDEFINIDO'

  // Classe processual real do processo
  const classe = proc.classe_processual || proc.classe || proc.tipo || proc.assunto || proc.area || 'Processo judicial'

  const dataUltima = proc.data_ultima_movimentacao || proc.ultima_movimentacao || null
  const criminal = isCriminal(classe)
  const ativo = isAtivo(dataUltima)

  // Descrição com partes identificadas
  const partes = [
    nomeAtivo   ? `Autor: ${nomeAtivo}`   : null,
    nomePassivo ? `Réu: ${nomePassivo}`   : null,
  ].filter(Boolean).join(' | ')

  return {
    categoria: criminal ? 'CRIMINAL' : 'JUDICIAL',
    severidade: criminal && ativo ? 'CRITICO' : criminal ? 'ALTO' : (poloPassivo && ativo) ? 'MEDIO' : 'BAIXO',
    titulo: `${ativo ? 'Processo ativo' : 'Processo encerrado'}: ${classe}`,
    descricao: [
      `Nº ${numero || 'N/A'}`,
      tribunal,
      polo !== 'INDEFINIDO' ? `Polo: ${polo}` : null,
      partes || null,
      `Última mov.: ${dataUltima || 'N/A'}`,
    ].filter(Boolean).join(' | '),
    fonte: `Escavador — ${tribunal}`,
    fonte_url: proc.link || proc.url || 'https://www.escavador.com',
    data_ocorrencia: proc.data_inicio || proc.data_distribuicao || undefined,
    status_ocorrencia: ativo ? 'ATIVO' : 'ARQUIVADO',
  }
}

function extractCursor(data: any): string | null {
  // Tenta todos os formatos conhecidos de cursor/paginação
  const direct = data?.cursor ?? data?.next_cursor ?? data?.next ?? null
  if (direct && typeof direct === 'string') return direct
  const meta = data?.meta?.cursor ?? data?.meta?.next_cursor ?? data?.meta?.next ?? null
  if (meta && typeof meta === 'string') return meta
  const links = data?.links?.next ?? null
  if (links && typeof links === 'string') {
    // Extrai cursor de URL "?cursor=abc123"
    try { return new URL(links).searchParams.get('cursor') } catch {}
  }
  return null
}

async function getProcessosEnvolvidoV2(cpfCnpj: string, apiKey: string): Promise<Finding[]> {
  const findings: Finding[] = []
  let cursor: string | null = null
  let page = 0
  const maxPages = 5 // até 5 páginas

  do {
    const url = new URL(`${BASE_V2}/envolvido/processos`)
    url.searchParams.set('cpf_cnpj', cpfCnpj)
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url.toString(), {
      headers: headers(apiKey),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) break

    const data = await res.json()

    // Suporta: { processos: [] } | { items: [] } | { data: [] } | array direto
    const lista: any[] = Array.isArray(data)
      ? data
      : (data?.processos || data?.items || data?.data || [])

    cursor = extractCursor(data)

    for (const proc of lista) findings.push(parseProcV2(proc))

    page++
    if (!cursor || lista.length === 0) break
  } while (page < maxPages)

  return findings
}

// Fallback v1 — usado se v2 não estiver disponível para a conta
async function getProcessosEnvolvidoV1(documento: string, tipo: 'CPF' | 'CNPJ', nome: string, apiKey: string): Promise<Finding[]> {
  const clean = documento.replace(/\D/g, '')
  const findings: Finding[] = []

  const tipoBusca = tipo === 'CPF' ? 'pessoas' : 'instituicoes'
  const query = clean ? `${nome} ${clean}` : nome
  const searchRes = await fetch(
    `${BASE_V1}/busca?q=${encodeURIComponent(query)}&tipo=${tipoBusca}`,
    { headers: headers(apiKey), signal: AbortSignal.timeout(15000) }
  )
  if (!searchRes.ok) throw new Error(`Erro ${searchRes.status} na busca v1`)

  const searchData = await searchRes.json()
  const entidades = (searchData?.items || []).filter((i: any) =>
    i.tipo_resultado === 'Pessoa' || i.tipo_resultado === 'Instituicao'
  )
  const candidatos = entidades.filter((p: any) => p.quantidade_processos > 0).slice(0, clean ? 1 : 2)

  for (const entidade of candidatos) {
    const entityId = entidade.id
    if (!entityId) continue

    const endpoint = tipo === 'CPF'
      ? `${BASE_V1}/pessoas/${entityId}/processos?limit=50`
      : `${BASE_V1}/instituicoes/${entityId}/processos?limit=50`

    const procRes = await fetch(endpoint, { headers: headers(apiKey), signal: AbortSignal.timeout(15000) })
    if (!procRes.ok) continue

    const procData = await procRes.json()
    const processos: any[] = procData?.items || []

    for (const proc of processos) {
      const numero = proc.numero_novo || proc.numero_antigo || ''
      const tribunal = proc.diario_sigla || proc.diario_nome || proc.estado || 'N/A'
      const classe = proc.tipo_ultima_movimentacao || proc.tipo || ''
      const criminal = isCriminal(classe)

      const dataStr = proc.data_movimentacoes?.split(' a ')?.pop() || ''
      const ativo = isAtivo(
        dataStr.includes('/') ? dataStr.split('/').reverse().join('-') : dataStr
      )

      findings.push({
        categoria: criminal ? 'CRIMINAL' : 'JUDICIAL',
        severidade: criminal && ativo ? 'CRITICO' : criminal ? 'ALTO' : ativo ? 'MEDIO' : 'BAIXO',
        titulo: `${ativo ? 'Processo ativo' : 'Processo encerrado'}: ${classe || 'Processo judicial'}`,
        descricao: `Nº ${numero || 'N/A'} | ${tribunal} | Movimentações: ${proc.data_movimentacoes || 'N/A'}`,
        fonte: `Escavador — ${tribunal}`,
        fonte_url: proc.link || 'https://www.escavador.com',
        data_ocorrencia: undefined,
        status_ocorrencia: ativo ? 'ATIVO' : 'ARQUIVADO',
      })
    }
  }

  const seen = new Set<string>()
  return findings.filter(f => {
    const m = f.descricao.match(/Nº ([\d\-\.]+)/)
    if (!m || m[1] === 'N/A') return true
    if (seen.has(m[1])) return false
    seen.add(m[1])
    return true
  })
}

export async function checkEscavador(documento: string, tipo: 'CPF' | 'CNPJ', nome: string = ''): Promise<EngineResult> {
  const apiKey = process.env.ESCAVADOR_API_KEY || ''
  if (!apiKey) {
    return { engine: 'Escavador (Processos Judiciais)', success: false, findings: [], error: 'ESCAVADOR_API_KEY não configurada.' }
  }

  const clean = documento.replace(/\D/g, '')

  try {
    // Pré-verificação barata (R$0,40): conta quantos processos existem
    const totalProcessos = await getResumoEnvolvido(clean, apiKey)

    // Se 0 processos confirmados, não gasta R$4,50
    if (totalProcessos === 0) {
      return {
        engine: 'Escavador (Processos Judiciais)',
        success: true,
        findings: [],
        metadata: { total_processos: 0, fonte: 'v2', resumo: 'Nenhum processo localizado via Escavador.' },
      }
    }

    // Roda v2 (por CPF) + v1 (por nome) em paralelo para máxima cobertura
    // v2 encontra processos indexados com CPF; v1 encontra processos indexados por nome
    const [v2Result, v1Result] = await Promise.allSettled([
      getProcessosEnvolvidoV2(clean, apiKey),
      nome ? getProcessosEnvolvidoV1(documento, tipo, nome, apiKey) : Promise.resolve([] as Finding[]),
    ])

    const v2Findings = v2Result.status === 'fulfilled' ? v2Result.value : []
    const v1Findings = v1Result.status === 'fulfilled' ? v1Result.value : []

    // Mescla e deduplica por número de processo
    const all = [...v2Findings, ...v1Findings]
    const seen = new Set<string>()
    const findings = all.filter(f => {
      const m = f.descricao.match(/Nº ([\d\-\.\/]+)/)
      const key = (m && m[1] !== 'N/A') ? m[1] : f.titulo + f.fonte
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return {
      engine: 'Escavador (Processos Judiciais)',
      success: true,
      findings,
      metadata: {
        total_processos: findings.length,
        total_escavador: totalProcessos,
        v2: v2Findings.length,
        v1: v1Findings.length,
      },
    }
  } catch (err: any) {
    if (nome) {
      try {
        const findings = await getProcessosEnvolvidoV1(documento, tipo, nome, apiKey)
        return { engine: 'Escavador (Processos Judiciais)', success: true, findings, metadata: { fonte: 'v1-fallback' } }
      } catch {}
    }
    return { engine: 'Escavador (Processos Judiciais)', success: false, findings: [], error: err.message }
  }
}
