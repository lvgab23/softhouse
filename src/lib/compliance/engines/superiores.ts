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

async function tryFetch(urls: (string | null)[], tribunal: string): Promise<Finding[]> {
  for (const url of urls.filter(Boolean) as string[]) {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const found = parse(await res.text(), tribunal)
      if (found.length > 0) return found
    } catch { }
  }
  return []
}

const TRF_COURTS = [
  { sigla: 'TRF1', base: 'https://processual.trf1.jus.br/consultaProcessual/processo.php' },
  { sigla: 'TRF2', base: 'https://portal.trf2.jus.br/portal/consulta/cons_procs.asp' },
  { sigla: 'TRF3', base: 'https://web.trf3.jus.br/base/base/consulta-publica-de-processos' },
  { sigla: 'TRF4', base: 'https://eproc.trf4.jus.br/eproc2trf4/controlador.php?acao=consulta_processual_pesquisa_doc' },
  { sigla: 'TRF5', base: 'https://pje.trf5.jus.br/pje/ConsultaPublica/listView.seam' },
  { sigla: 'TRF6', base: 'https://pje.trf6.jus.br/pje/ConsultaPublica/listView.seam' },
]

const TRT_URLS = Array.from({ length: 24 }, (_, i) => ({
  sigla: `TRT${i + 1}`,
  base: `https://pje.trt${i + 1}.jus.br/pje/ConsultaPublica/listView.seam`,
}))

export async function checkSuperiores(documento: string, nome: string): Promise<EngineResult> {
  const clean = documento.replace(/\D/g, '')
  const allFindings: Finding[] = []

  // STJ
  allFindings.push(...await tryFetch([
    nome ? `https://ww2.stj.jus.br/processo/pesquisa/?tipoPesquisa=tipoPesquisaMultiVariavel&PartePesquisa=${encodeURIComponent(nome)}` : null,
    `https://ww2.stj.jus.br/processo/pesquisa/?tipoPesquisa=tipoPesquisaMultiVariavel&PartePesquisa=${clean}`,
  ], 'STJ'))

  // STF
  allFindings.push(...await tryFetch([
    nome ? `https://portal.stf.jus.br/processos/pesquisar.asp?tipoLocalStorage=pesquisaLivre&pesquisaLivre=${encodeURIComponent(nome)}` : null,
    `https://portal.stf.jus.br/processos/pesquisar.asp?tipoLocalStorage=pesquisaLivre&pesquisaLivre=${clean}`,
  ], 'STF'))

  // TST
  if (nome) {
    allFindings.push(...await tryFetch([
      `https://pje.tst.jus.br/pje/ConsultaPublica/listView.seam?nmparte=${encodeURIComponent(nome)}`,
    ], 'TST'))
  }

  // TRFs — CPF/CNPJ e nome
  const trfTasks = TRF_COURTS.flatMap(c => [
    tryFetch([
      `${c.base}?cpfcnpj=${clean}`,
      `${c.base}?documento=${clean}`,
    ], c.sigla),
    nome ? tryFetch([`${c.base}?nmparte=${encodeURIComponent(nome)}&nome=${encodeURIComponent(nome)}`], c.sigla) : Promise.resolve([]),
  ])
  const trfResults = await Promise.allSettled(trfTasks)
  for (const r of trfResults) {
    if (r.status === 'fulfilled') allFindings.push(...r.value)
  }

  // TRTs — 24 tribunais
  const trtTasks = TRT_URLS.flatMap(c => [
    tryFetch([
      `${c.base}?cpfcnpj=${clean}`,
      `${c.base}?documento=${clean}`,
    ], c.sigla),
    nome ? tryFetch([`${c.base}?nmparte=${encodeURIComponent(nome)}`], c.sigla) : Promise.resolve([]),
  ])
  const trtResults = await Promise.allSettled(trtTasks)
  for (const r of trtResults) {
    if (r.status === 'fulfilled') allFindings.push(...r.value)
  }

  // Deduplica
  const seen = new Set<string>()
  const deduped = allFindings.filter(f => {
    const m = f.descricao.match(/Nº (\S+)/)
    if (!m) return true
    if (seen.has(m[1])) return false
    seen.add(m[1])
    return true
  })

  return {
    engine: 'Tribunais Superiores e Federais',
    success: true,
    findings: deduped,
    metadata: {
      tribunais_consultados: 3 + TRF_COURTS.length + TRT_URLS.length,
      processos_encontrados: deduped.length,
    },
  }
}
