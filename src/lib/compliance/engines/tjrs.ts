import { EngineResult, Finding } from '../types'
import { BROWSER_HEADERS, extractProcessNumbers, extractClasseAssunto, isCriminal, isBlockedResponse, hasNoResults } from './parse-utils'

function parse(html: string, tribunal: string): Finding[] {
  if (!html || html.length < 200 || isBlockedResponse(html) || hasNoResults(html)) return []
  return extractProcessNumbers(html).slice(0, 20).map(numero => {
    const { classe, assunto, arquivado } = extractClasseAssunto(html, numero)
    const criminal = isCriminal(classe + ' ' + assunto)
    return {
      categoria: criminal ? 'CRIMINAL' : 'JUDICIAL',
      severidade: criminal && !arquivado ? 'CRITICO' : criminal ? 'ALTO' : !arquivado ? 'MEDIO' : 'BAIXO',
      titulo: `${arquivado ? 'Processo encerrado' : 'Processo ativo'}${classe ? `: ${classe}` : ''}`,
      descricao: `Nº ${numero} | ${tribunal}${assunto ? ` | ${assunto}` : ''}`,
      fonte: tribunal,
      fonte_url: `https://www.jusbrasil.com.br/processos/search?q=${numero.replace(/\D/g, '')}`,
      status_ocorrencia: arquivado ? 'ARQUIVADO' : 'ATIVO',
    } as Finding
  })
}

const PJE_ESTADUAL = [
  { sigla: 'TJPE', url: 'https://pje.tjpe.jus.br/1g/ConsultaPublica/listView.seam' },
  { sigla: 'TJGO', url: 'https://pje.tjgo.jus.br/pje/ConsultaPublica/listView.seam' },
  { sigla: 'TJMT', url: 'https://pje.tjmt.jus.br/pje/ConsultaPublica/listView.seam' },
  { sigla: 'TJPA', url: 'https://pje.tjpa.jus.br/pje/ConsultaPublica/listView.seam' },
  { sigla: 'TJPB', url: 'https://pje.tjpb.jus.br/pje/ConsultaPublica/listView.seam' },
]

async function searchPJeEstadual(court: { sigla: string; url: string }, clean: string, nome: string): Promise<Finding[]> {
  for (const url of [
    `${court.url}?cpfcnpj=${clean}`,
    nome ? `${court.url}?nmparte=${encodeURIComponent(nome)}` : null,
  ].filter(Boolean) as string[]) {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const found = parse(await res.text(), court.sigla)
      if (found.length > 0) return found
    } catch { }
  }
  return []
}

export async function checkTJRS(documento: string, nome: string): Promise<EngineResult> {
  const clean = documento.replace(/\D/g, '')
  const allFindings: Finding[] = []

  // TJRS
  for (const url of [
    nome ? `https://www.tjrs.jus.br/novo/busca-solr/?q=${encodeURIComponent(nome)}&aba=processos&pesquisa=processos&tipoLista=0` : null,
    `https://www.tjrs.jus.br/novo/busca-solr/?q=${clean}&aba=processos&pesquisa=processos&tipoLista=0`,
  ].filter(Boolean) as string[]) {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10000) })
      if (!res.ok) continue
      const found = parse(await res.text(), 'TJRS')
      if (found.length > 0) { allFindings.push(...found); break }
    } catch { }
  }

  // TJPR — Projudi
  try {
    const res = await fetch(
      `https://projudi.tjpr.jus.br/projudi/listProcessos.do?_docType=CPF&_docNumber=${clean}`,
      { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10000) }
    )
    if (res.ok) allFindings.push(...parse(await res.text(), 'TJPR'))
  } catch { }

  // TJs com PJe estadual
  const pjeResults = await Promise.allSettled(PJE_ESTADUAL.map(c => searchPJeEstadual(c, clean, nome)))
  for (const r of pjeResults) {
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

  return { engine: 'Tribunais Estaduais — Demais', success: true, findings: deduped, metadata: { processos_encontrados: deduped.length } }
}
