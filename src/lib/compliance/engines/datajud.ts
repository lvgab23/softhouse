import { EngineResult, Finding } from '../types'

const BASE = 'https://api-publica.datajud.cnj.jus.br'
const API_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=='

// CNJ NPU format: NNNNNNN-DD.AAAA.J.TT.OOOO (20 digits)
// positions (without separators): J=digits[13], TT=digits[14-15]
const TJ_MAP: Record<string, string> = {
  '01': 'tjac', '02': 'tjal', '03': 'tjam', '04': 'tjap', '05': 'tjba',
  '06': 'tjce', '07': 'tjdft', '08': 'tjes', '09': 'tjgo', '10': 'tjma',
  '11': 'tjmt', '12': 'tjms', '13': 'tjmg', '14': 'tjpa', '15': 'tjpb',
  '16': 'tjpr', '17': 'tjpe', '18': 'tjpi', '19': 'tjrj', '20': 'tjrn',
  '21': 'tjrs', '22': 'tjro', '23': 'tjrr', '24': 'tjsc', '25': 'tjse',
  '26': 'tjsp', '27': 'tjto',
}
const TRF_MAP: Record<string, string> = {
  '01': 'trf1', '02': 'trf2', '03': 'trf3', '04': 'trf4', '05': 'trf5', '06': 'trf6',
}
const TRT_MAP: Record<string, string> = {
  '01': 'trt1', '02': 'trt2', '03': 'trt3', '04': 'trt4', '05': 'trt5',
  '06': 'trt6', '07': 'trt7', '08': 'trt8', '09': 'trt9', '10': 'trt10',
  '11': 'trt11', '12': 'trt12', '13': 'trt13', '14': 'trt14', '15': 'trt15',
  '16': 'trt16', '17': 'trt17', '18': 'trt18', '19': 'trt19', '20': 'trt20',
  '21': 'trt21', '22': 'trt22', '23': 'trt23', '24': 'trt24',
}
const SUPERIOR_MAP: Record<string, string> = {
  '1': 'stf', '2': 'cnj', '3': 'stj', '6': 'tse', '7': 'stm', '9': 'tst',
}

function resolveIndex(digits: string): string | null {
  if (digits.length !== 20) return null
  const j = digits[13]
  const tt = digits.substring(14, 16)
  if (j === '8') return TJ_MAP[tt] ? `api_publica_${TJ_MAP[tt]}` : null
  if (j === '4') return TRF_MAP[tt] ? `api_publica_${TRF_MAP[tt]}` : null
  if (j === '5') return TRT_MAP[tt] ? `api_publica_${TRT_MAP[tt]}` : null
  if (SUPERIOR_MAP[j]) return `api_publica_${SUPERIOR_MAP[j]}`
  return null
}

function formatDataAjuizamento(raw: string): string {
  if (!raw || raw.length < 8) return 'N/A'
  return `${raw.substring(6, 8)}/${raw.substring(4, 6)}/${raw.substring(0, 4)}`
}

export async function checkDataJud(processos: string[]): Promise<EngineResult> {
  if (!processos || processos.length === 0) {
    return {
      engine: 'DataJud / CNJ',
      success: true,
      findings: [],
      metadata: { info: 'Nenhum número de processo informado' },
    }
  }

  const findings: Finding[] = []
  const erros: string[] = []

  for (const proc of processos.slice(0, 10)) {
    const digits = proc.replace(/\D/g, '')
    if (digits.length !== 20) {
      erros.push(`Número inválido (${proc}) — deve ter 20 dígitos no formato CNJ`)
      continue
    }

    const index = resolveIndex(digits)
    if (!index) {
      erros.push(`Tribunal não identificado para o processo ${proc}`)
      continue
    }

    try {
      const res = await fetch(`${BASE}/${index}/_search`, {
        method: 'POST',
        headers: {
          Authorization: `APIKey ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          size: 1,
          query: { term: { numeroProcesso: digits } },
        }),
        signal: AbortSignal.timeout(12000),
      })

      if (!res.ok) {
        erros.push(`Erro ${res.status} ao buscar ${proc}`)
        continue
      }

      const data = await res.json()
      const hit = data.hits?.hits?.[0]?._source
      if (!hit) {
        erros.push(`Processo ${proc} não encontrado no DataJud`)
        continue
      }

      const classe = hit.classe?.nome || ''
      const tribunal = hit.tribunal || index.replace('api_publica_', '').toUpperCase()
      const grau = hit.grau || ''
      const dataAjuiz = hit.dataAjuizamento || ''
      const assunto = hit.assuntos?.[0]?.nome || ''
      const orgao = hit.orgaoJulgador?.nome || ''
      const lastMov = hit.movimentos?.[0]?.nome?.toLowerCase() || ''
      const arquivado = ['baixad', 'arquiv', 'extint', 'encerr', 'julgad'].some(s => lastMov.includes(s))

      const termosCriminais = ['criminal', 'penal', 'crime', 'homicídio', 'tráfico', 'roubo', 'furto', 'corrupção', 'lavagem', 'estelionato', 'violência']
      const criminal = termosCriminais.some(t => classe.toLowerCase().includes(t) || assunto.toLowerCase().includes(t))

      const procFormatado = `${digits.substring(0, 7)}-${digits.substring(7, 9)}.${digits.substring(9, 13)}.${digits[13]}.${digits.substring(14, 16)}.${digits.substring(16)}`

      findings.push({
        categoria: criminal ? 'CRIMINAL' : 'JUDICIAL',
        severidade: criminal && !arquivado ? 'CRITICO' : criminal ? 'ALTO' : !arquivado ? 'MEDIO' : 'BAIXO',
        titulo: `${arquivado ? 'Processo encerrado' : 'Processo ativo'}: ${classe || 'Processo judicial'}`,
        descricao: `Nº ${procFormatado} | ${tribunal} ${grau}${orgao ? ` | ${orgao}` : ''}${assunto ? ` | ${assunto}` : ''} | Ajuizado: ${formatDataAjuizamento(dataAjuiz)}`,
        fonte: `DataJud / CNJ — ${tribunal}`,
        fonte_url: `https://www.jusbrasil.com.br/processos/search?q=${digits}`,
        data_ocorrencia: dataAjuiz ? formatDataAjuizamento(dataAjuiz) : undefined,
        status_ocorrencia: arquivado ? 'ARQUIVADO' : 'ATIVO',
      })
    } catch (err: any) {
      erros.push(`Timeout ou erro ao buscar ${proc}: ${err.message}`)
    }
  }

  return {
    engine: 'DataJud / CNJ',
    success: true,
    findings,
    metadata: {
      processos_consultados: processos.length,
      processos_encontrados: findings.length,
      erros: erros.length > 0 ? erros : undefined,
    },
  }
}
