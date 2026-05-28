import { EngineResult, Finding } from '../types'
import { BROWSER_HEADERS, extractProcessNumbers, extractClasseAssunto, isCriminal, isBlockedResponse, hasNoResults } from './parse-utils'

const SAJ_COURTS = [
  { sigla: 'TJSP', base: 'https://esaj.tjsp.jus.br' },
  { sigla: 'TJSC', base: 'https://esaj.tjsc.jus.br' },
  { sigla: 'TJAL', base: 'https://esaj.tjal.jus.br' },
  { sigla: 'TJMS', base: 'https://esaj.tjms.jus.br' },
  { sigla: 'TJPI', base: 'https://esaj.tjpi.jus.br' },
  { sigla: 'TJTO', base: 'https://esaj.tjto.jus.br' },
  { sigla: 'TJSE', base: 'https://esaj.tjse.jus.br' },
  { sigla: 'TJAC', base: 'https://esaj.tjac.jus.br' },
  { sigla: 'TJAM', base: 'https://esaj.tjam.jus.br' },
  { sigla: 'TJAP', base: 'https://esaj.tjap.jus.br' },
  { sigla: 'TJRO', base: 'https://esaj.tjro.jus.br' },
  { sigla: 'TJRR', base: 'https://esaj.tjrr.jus.br' },
  { sigla: 'TJBA', base: 'https://esaj.tjba.jus.br' },
  { sigla: 'TJCE', base: 'https://esaj.tjce.jus.br' },
  { sigla: 'TJMA', base: 'https://esaj.tjma.jus.br' },
  { sigla: 'TJRN', base: 'https://esaj.tjrn.jus.br' },
]

function parseSAJ(html: string, tribunal: string): Finding[] {
  if (!html || html.length < 200) return []
  if (isBlockedResponse(html) || hasNoResults(html)) return []

  const numbers = extractProcessNumbers(html)
  return numbers.slice(0, 30).map(numero => {
    const { classe, assunto, arquivado } = extractClasseAssunto(html, numero)
    const criminal = isCriminal(classe + ' ' + assunto)
    return {
      categoria: criminal ? 'CRIMINAL' : 'JUDICIAL',
      severidade: criminal && !arquivado ? 'CRITICO' : criminal ? 'ALTO' : !arquivado ? 'MEDIO' : 'BAIXO',
      titulo: `${arquivado ? 'Processo encerrado' : 'Processo ativo'}${classe ? `: ${classe}` : ''}`,
      descricao: `Nº ${numero} | ${tribunal}${assunto ? ` | ${assunto}` : ''}`,
      fonte: `${tribunal} — eSAJ`,
      fonte_url: `https://www.jusbrasil.com.br/processos/search?q=${numero.replace(/\D/g, '')}`,
      status_ocorrencia: arquivado ? 'ARQUIVADO' : 'ATIVO',
    } as Finding
  })
}

async function searchCourt(court: { sigla: string; base: string }, documento: string): Promise<Finding[]> {
  const clean = documento.replace(/\D/g, '')
  const findings: Finding[] = []
  for (const grau of ['cpopg', 'cposg']) {
    try {
      const url = `${court.base}/${grau}/search.do?cbPesquisa=NUMDOC&dadosConsulta.valorConsulta=${clean}&dadosConsulta.tipoPesquisaDN=DTNASC&tipoCertidao=&nmAgente=`
      const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10000) })
      if (!res.ok) continue
      findings.push(...parseSAJ(await res.text(), court.sigla))
    } catch { }
  }
  return findings
}

export async function checkSAJ(documento: string): Promise<EngineResult> {
  const results = await Promise.allSettled(SAJ_COURTS.map(c => searchCourt(c, documento)))
  const allFindings: Finding[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') allFindings.push(...r.value)
  }

  const seen = new Set<string>()
  const deduped = allFindings.filter(f => {
    const m = f.descricao.match(/Nº (\S+)/)
    if (!m) return true
    if (seen.has(m[1])) return false
    seen.add(m[1])
    return true
  })

  return {
    engine: 'Tribunais Estaduais — SAJ',
    success: true,
    findings: deduped,
    metadata: { tribunais_consultados: SAJ_COURTS.length, processos_encontrados: deduped.length },
  }
}
