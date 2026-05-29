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

async function getProcessosEnvolvidoV2(cpfCnpj: string, apiKey: string): Promise<Finding[]> {
  const findings: Finding[] = []
  let cursor: string | null = null
  let page = 0
  const maxPages = 3 // até 300 processos (100 por página)

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
    const processos: any[] = data?.items || data?.processos || []
    cursor = data?.cursor ?? data?.next_cursor ?? null

    for (const proc of processos) {
      const numero = proc.numero_cnj || proc.numero || proc.numero_processo || ''
      const tribunal = proc.tribunal_sigla || proc.tribunal || proc.fonte || 'N/A'
      const classe = proc.classe_processual || proc.classe || proc.titulo || proc.tipo || ''
      const polo = (proc.polo_do_envolvido || proc.polo || '').toUpperCase()
      const dataUltima = proc.data_ultima_movimentacao || proc.ultima_movimentacao || null
      const criminal = isCriminal(classe)
      const ativo = isAtivo(dataUltima)
      const poloRisco = polo === 'PASSIVO' || polo === 'RÉU' || polo === 'REU'

      findings.push({
        categoria: criminal ? 'CRIMINAL' : 'JUDICIAL',
        severidade: criminal && ativo ? 'CRITICO' : criminal ? 'ALTO' : (poloRisco && ativo) ? 'MEDIO' : 'BAIXO',
        titulo: `${ativo ? 'Processo ativo' : 'Processo encerrado'}: ${classe || 'Processo judicial'}`,
        descricao: `Nº ${numero || 'N/A'} | ${tribunal}${polo ? ` | Polo: ${polo}` : ''} | Última mov.: ${dataUltima || 'N/A'}`,
        fonte: `Escavador — ${tribunal}`,
        fonte_url: proc.link || proc.url || `https://www.escavador.com`,
        data_ocorrencia: proc.data_inicio || proc.data_distribuicao || undefined,
        status_ocorrencia: ativo ? 'ATIVO' : 'ARQUIVADO',
      })
    }

    page++
    if (!cursor || processos.length === 0) break
  } while (page < maxPages)

  // Deduplica por número de processo
  const seen = new Set<string>()
  return findings.filter(f => {
    const m = f.descricao.match(/Nº ([\d\-\.\/]+)/)
    if (!m || m[1] === 'N/A') return true
    if (seen.has(m[1])) return false
    seen.add(m[1])
    return true
  })
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

    // Busca completa via v2 (R$4,50 até 200 processos)
    let findings: Finding[] = []
    let fonte = 'v2'

    try {
      findings = await getProcessosEnvolvidoV2(clean, apiKey)
    } catch {
      // Fallback para v1 se v2 não funcionar para esta conta
      if (nome) {
        findings = await getProcessosEnvolvidoV1(documento, tipo, nome, apiKey)
        fonte = 'v1'
      }
    }

    return {
      engine: 'Escavador (Processos Judiciais)',
      success: true,
      findings,
      metadata: {
        total_processos: findings.length,
        total_escavador: totalProcessos,
        fonte,
      },
    }
  } catch (err: any) {
    // Tenta v1 como último recurso
    if (nome) {
      try {
        const findings = await getProcessosEnvolvidoV1(documento, tipo, nome, apiKey)
        return { engine: 'Escavador (Processos Judiciais)', success: true, findings, metadata: { fonte: 'v1-fallback' } }
      } catch {}
    }
    return { engine: 'Escavador (Processos Judiciais)', success: false, findings: [], error: err.message }
  }
}
