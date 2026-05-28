import { EngineResult, Finding } from '../types'
import { BROWSER_HEADERS, extractProcessNumbers, extractClasseAssunto, isCriminal, isBlockedResponse, hasNoResults } from './parse-utils'

function parse(html: string): Finding[] {
  if (!html || html.length < 200 || isBlockedResponse(html) || hasNoResults(html)) return []
  return extractProcessNumbers(html).slice(0, 30).map(numero => {
    const { classe, assunto, arquivado } = extractClasseAssunto(html, numero)
    const criminal = isCriminal(classe + ' ' + assunto)
    return {
      categoria: criminal ? 'CRIMINAL' : 'JUDICIAL',
      severidade: criminal && !arquivado ? 'CRITICO' : criminal ? 'ALTO' : !arquivado ? 'MEDIO' : 'BAIXO',
      titulo: `${arquivado ? 'Processo encerrado' : 'Processo ativo'}${classe ? `: ${classe}` : ''}`,
      descricao: `Nº ${numero} | TJRJ${assunto ? ` | ${assunto}` : ''}`,
      fonte: 'TJRJ',
      fonte_url: `https://www.jusbrasil.com.br/processos/search?q=${numero.replace(/\D/g, '')}`,
      status_ocorrencia: arquivado ? 'ARQUIVADO' : 'ATIVO',
    } as Finding
  })
}

export async function checkTJRJ(documento: string, nome: string): Promise<EngineResult> {
  const clean = documento.replace(/\D/g, '')
  const findings: Finding[] = []

  const endpoints = [
    `https://www4.tjrj.jus.br/consultaProcessualPublica/faces/consultaPublica/consultaPublicaIndex.xhtml?cpfSolicitante=${clean}`,
    `https://www4.tjrj.jus.br/numeracaoUnica/faces/index.jsp?numero=${clean}`,
    nome ? `https://www4.tjrj.jus.br/consultaProcessualPublica/faces/consultaPublica/consultaPublicaIndex.xhtml?nomeParte=${encodeURIComponent(nome)}` : null,
  ].filter(Boolean) as string[]

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(12000) })
      if (!res.ok) continue
      const found = parse(await res.text())
      if (found.length > 0) { findings.push(...found); break }
    } catch { }
  }

  return { engine: 'TJRJ', success: true, findings, metadata: { processos_encontrados: findings.length } }
}
