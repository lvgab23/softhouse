import { EngineResult, Finding } from '../types'
import { BROWSER_HEADERS, extractProcessNumbers, extractClasseAssunto, isCriminal, isBlockedResponse, hasNoResults } from './parse-utils'

function parse(html: string, tribunal: string): Finding[] {
  if (!html || html.length < 200 || isBlockedResponse(html) || hasNoResults(html)) return []
  return extractProcessNumbers(html).slice(0, 30).map(numero => {
    const { classe, assunto, arquivado } = extractClasseAssunto(html, numero)
    const criminal = isCriminal(classe + ' ' + assunto)
    return {
      categoria: criminal ? 'CRIMINAL' : 'JUDICIAL',
      severidade: criminal && !arquivado ? 'CRITICO' : criminal ? 'ALTO' : !arquivado ? 'MEDIO' : 'BAIXO',
      titulo: `${arquivado ? 'Processo encerrado' : 'Processo ativo'}${classe ? `: ${classe}` : ''}`,
      descricao: `Nº ${numero} | ${tribunal}${assunto ? ` | ${assunto}` : ''}`,
      fonte: `${tribunal} — EJEF`,
      fonte_url: `https://www.jusbrasil.com.br/processos/search?q=${numero.replace(/\D/g, '')}`,
      status_ocorrencia: arquivado ? 'ARQUIVADO' : 'ATIVO',
    } as Finding
  })
}

export async function checkTJMG(documento: string, nome: string): Promise<EngineResult> {
  const clean = documento.replace(/\D/g, '')
  const findings: Finding[] = []

  const urls = [
    `https://ejef.tjmg.jus.br/busca/faces/jsp/processos/consultaProcessos.jsp?nrDocumentoCpfCnpj=${clean}`,
    nome ? `https://ejef.tjmg.jus.br/busca/faces/jsp/processos/consultaProcessos.jsp?nmParte=${encodeURIComponent(nome)}` : null,
    `https://pje.tjmg.jus.br/pje/ConsultaPublica/listView.seam?cpfcnpj=${clean}`,
  ].filter(Boolean) as string[]

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(12000) })
      if (!res.ok) continue
      const found = parse(await res.text(), 'TJMG')
      findings.push(...found)
      if (found.length > 0) break
    } catch { }
  }

  return { engine: 'TJMG', success: true, findings, metadata: { processos_encontrados: findings.length } }
}
