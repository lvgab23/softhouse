import { EngineResult, Finding } from '../types'

const TERMOS_NEGATIVOS = ['fraude', 'crime', 'corrup', 'lavagem', 'investigad', 'preso', 'condenad', 'escândalo', 'desvio', 'golpe', 'estelionato', 'sonegação', 'tráfico', 'arrested', 'fraud', 'corrupt', 'scandal', 'money laundering']

function isNegativo(text: string): boolean {
  const lower = text.toLowerCase()
  return TERMOS_NEGATIVOS.some(t => lower.includes(t))
}

// ── GDELT Project — gratuito, sem chave, notícias globais ────────────────────
async function searchGDELT(nome: string): Promise<Finding[]> {
  try {
    const query = encodeURIComponent(`"${nome}"`)
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=25&format=json&sourcelang=por&timespan=12m`
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!res.ok) return []
    const data = await res.json()
    const articles: any[] = data?.articles || []

    return articles
      .filter(a => isNegativo((a.title || '') + ' ' + (a.seendate || '')))
      .slice(0, 10)
      .map(a => ({
        categoria: 'MIDIA' as const,
        severidade: 'MEDIO' as const,
        titulo: (a.title || 'Notícia').substring(0, 120),
        descricao: `${(a.title || 'N/A').substring(0, 280)} | Domínio: ${a.domain || 'N/A'}`,
        fonte: a.domain || 'GDELT News',
        fonte_url: a.url || undefined,
        data_ocorrencia: a.seendate ? a.seendate.substring(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : undefined,
        status_ocorrencia: 'ATIVO',
      }))
  } catch { return [] }
}

// ── GDELT sem filtro de idioma — amplia para notícias internacionais ──────────
async function searchGDELTGlobal(nome: string): Promise<Finding[]> {
  try {
    const query = encodeURIComponent(`"${nome}" (fraude OR crime OR corrupção OR investigado OR condenado OR preso OR fraud OR corrupt)`)
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=15&format=json&timespan=24m`
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!res.ok) return []
    const data = await res.json()
    const articles: any[] = data?.articles || []

    return articles.slice(0, 8).map(a => ({
      categoria: 'MIDIA' as const,
      severidade: 'MEDIO' as const,
      titulo: (a.title || 'Notícia').substring(0, 120),
      descricao: `${(a.title || 'N/A').substring(0, 280)} | Domínio: ${a.domain || 'N/A'}`,
      fonte: a.domain || 'GDELT News',
      fonte_url: a.url || undefined,
      data_ocorrencia: a.seendate ? a.seendate.substring(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : undefined,
      status_ocorrencia: 'ATIVO',
    }))
  } catch { return [] }
}

// ── Google Custom Search (opcional) ──────────────────────────────────────────
async function searchGoogle(nome: string): Promise<Finding[]> {
  const googleKey = process.env.GOOGLE_API_KEY || ''
  const googleCx = process.env.GOOGLE_SEARCH_CX || ''
  if (!googleKey || !googleCx) return []
  try {
    const termos = ['fraude', 'crime', 'corrupção', 'lavagem', 'investigado', 'preso']
    const query = `"${nome}" ${termos.join(' OR ')}`
    const res = await fetch(
      `https://customsearch.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=${encodeURIComponent(query)}&num=10&lr=lang_pt&dateRestrict=y5`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data?.items || [])
      .filter((item: any) => isNegativo((item.title || '') + ' ' + (item.snippet || '')))
      .map((item: any) => ({
        categoria: 'MIDIA' as const,
        severidade: 'MEDIO' as const,
        titulo: (item.title || '').substring(0, 120),
        descricao: `${(item.snippet || 'N/A').substring(0, 300)} | Domínio: ${item.displayLink || 'N/A'}`,
        fonte: item.displayLink || 'Google Search',
        fonte_url: item.link,
        status_ocorrencia: 'ATIVO',
      }))
  } catch { return [] }
}

// ── NewsAPI (opcional) ────────────────────────────────────────────────────────
async function searchNewsAPI(nome: string): Promise<Finding[]> {
  const newsApiKey = process.env.NEWSAPI_KEY || ''
  if (!newsApiKey) return []
  try {
    const res = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(`"${nome}"`)}&language=pt&sortBy=relevancy&pageSize=20&apiKey=${newsApiKey}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data?.articles || [])
      .filter((a: any) => a.title && isNegativo((a.title || '') + ' ' + (a.description || '')))
      .map((a: any) => ({
        categoria: 'MIDIA' as const,
        severidade: 'MEDIO' as const,
        titulo: (a.title || '').substring(0, 120),
        descricao: `${(a.description || 'N/A').substring(0, 300)} | Publicado: ${a.publishedAt?.split('T')[0] || 'N/A'} | Fonte: ${a.source?.name || 'N/A'}`,
        fonte: a.source?.name || 'NewsAPI',
        fonte_url: a.url,
        data_ocorrencia: a.publishedAt?.split('T')[0],
        status_ocorrencia: 'ATIVO',
      }))
  } catch { return [] }
}

// ── Engine principal ──────────────────────────────────────────────────────────
export async function checkMidia(nome: string, tipo: 'CPF' | 'CNPJ'): Promise<EngineResult> {
  const engineName = 'Mídia Negativa'

  if (!nome) {
    return { engine: engineName, success: false, findings: [], error: 'Nome obrigatório para busca em mídia negativa.' }
  }

  try {
    // Executa todas as fontes em paralelo
    const [gdelt, gdeltGlobal, google, newsapi] = await Promise.all([
      searchGDELT(nome),
      searchGDELTGlobal(nome),
      searchGoogle(nome),
      searchNewsAPI(nome),
    ])

    // Combina e deduplica por URL
    const seen = new Set<string>()
    const findings: Finding[] = []
    for (const f of [...gdeltGlobal, ...gdelt, ...google, ...newsapi]) {
      const key = f.fonte_url || f.titulo
      if (seen.has(key)) continue
      seen.add(key)
      findings.push(f)
    }

    const fontes = [
      'GDELT',
      process.env.GOOGLE_API_KEY ? 'Google Custom Search' : null,
      process.env.NEWSAPI_KEY ? 'NewsAPI' : null,
    ].filter(Boolean).join(', ')

    return {
      engine: engineName,
      success: true,
      findings: findings.slice(0, 15),
      metadata: { fontes, total: findings.length },
    }
  } catch (err: any) {
    return { engine: engineName, success: false, findings: [], error: err.message }
  }
}
