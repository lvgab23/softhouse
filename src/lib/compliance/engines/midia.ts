import { EngineResult, Finding } from '../types'

const TERMOS_NEGATIVOS = ['fraude', 'crime', 'corrup', 'lavagem', 'investigad', 'preso', 'condenad', 'escândalo', 'desvio', 'golpe', 'estelionato', 'sonegação', 'tráfico']

function isNegativo(text: string): boolean {
  const lower = text.toLowerCase()
  return TERMOS_NEGATIVOS.some(t => lower.includes(t))
}

export async function checkMidia(nome: string, tipo: 'CPF' | 'CNPJ'): Promise<EngineResult> {
  const engineName = 'Mídia Negativa'

  if (!nome) {
    return { engine: engineName, success: false, findings: [], error: 'Nome obrigatório para busca em mídia negativa.' }
  }

  const googleKey = process.env.GOOGLE_API_KEY || ''
  const googleCx = process.env.GOOGLE_SEARCH_CX || ''
  const newsApiKey = process.env.NEWSAPI_KEY || ''
  const findings: Finding[] = []

  try {
    // Google Custom Search (requer GOOGLE_API_KEY + GOOGLE_SEARCH_CX)
    if (googleKey && googleCx) {
      const query = `"${nome}" ${TERMOS_NEGATIVOS.slice(0, 6).join(' OR ')}`
      const res = await fetch(
        `https://customsearch.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=${encodeURIComponent(query)}&num=10&lr=lang_pt&dateRestrict=y5`,
        { signal: AbortSignal.timeout(10000) }
      )
      if (res.ok) {
        const data = await res.json()
        for (const item of (data?.items || [])) {
          if (!isNegativo(item.title + ' ' + (item.snippet || ''))) continue
          findings.push({
            categoria: 'MIDIA',
            severidade: 'MEDIO',
            titulo: (item.title || '').substring(0, 120),
            descricao: `${(item.snippet || 'N/A').substring(0, 300)} | Domínio: ${item.displayLink || 'N/A'}`,
            fonte: item.displayLink || 'Google Search',
            fonte_url: item.link,
            status_ocorrencia: 'ATIVO',
          })
        }
        return { engine: engineName, success: true, findings, metadata: { fonte: 'Google Custom Search' } }
      }
    }

    // NewsAPI (requer NEWSAPI_KEY — plano gratuito: 100 req/dia, últimos 30 dias)
    if (newsApiKey) {
      const res = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(`"${nome}"`)}&language=pt&sortBy=relevancy&pageSize=20&apiKey=${newsApiKey}`,
        { signal: AbortSignal.timeout(10000) }
      )
      if (res.ok) {
        const data = await res.json()
        for (const article of (data?.articles || [])) {
          if (!article.title) continue
          if (!isNegativo(article.title + ' ' + (article.description || ''))) continue
          findings.push({
            categoria: 'MIDIA',
            severidade: 'MEDIO',
            titulo: (article.title || '').substring(0, 120),
            descricao: `${(article.description || 'N/A').substring(0, 300)} | Publicado: ${article.publishedAt?.split('T')[0] || 'N/A'} | Fonte: ${article.source?.name || 'N/A'}`,
            fonte: article.source?.name || 'NewsAPI',
            fonte_url: article.url,
            data_ocorrencia: article.publishedAt?.split('T')[0],
            status_ocorrencia: 'ATIVO',
          })
        }
        return { engine: engineName, success: true, findings, metadata: { fonte: 'NewsAPI' } }
      }
    }

    return {
      engine: engineName,
      success: false,
      findings: [],
      error: 'Configure GOOGLE_API_KEY + GOOGLE_SEARCH_CX ou NEWSAPI_KEY para ativar busca em mídia negativa.',
    }
  } catch (err: any) {
    return { engine: engineName, success: false, findings: [], error: err.message }
  }
}
