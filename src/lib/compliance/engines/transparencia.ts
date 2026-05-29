import { EngineResult, Finding } from '../types'

const BASE = 'https://api.portaldatransparencia.gov.br/api-de-dados'

async function fetchAPI(endpoint: string, params: Record<string, string>, apiKey: string) {
  const qs = new URLSearchParams({ ...params, pagina: '1' })
  const res = await fetch(`${BASE}/${endpoint}?${qs}`, {
    headers: { 'chave-api-dados': apiKey },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return null
  return res.json()
}

export async function checkTransparencia(documento: string, tipo: 'CPF' | 'CNPJ'): Promise<EngineResult> {
  const apiKey = process.env.TRANSPARENCIA_API_KEY || ''
  if (!apiKey) {
    return {
      engine: 'Portal Transparência (CGU)',
      success: false,
      findings: [],
      error: 'Chave não configurada. Cadastre-se em portaldatransparencia.gov.br/api e defina TRANSPARENCIA_API_KEY no .env.local.',
    }
  }

  const clean = documento.replace(/\D/g, '')
  const findings: Finding[] = []

  try {
    // CEIS e CNEP são cadastros de EMPRESAS — para CPF retornam resultados não filtrados (falso positivo)
    // CPF só entra nessas listas como empresa representada, verificado via engine socios
    if (tipo === 'CNPJ') {
      const [ceis, cnep] = await Promise.all([
        fetchAPI('ceis', { cnpjSancionado: clean }, apiKey),
        fetchAPI('cnep', { cnpjSancionado: clean }, apiKey),
      ])

      if (Array.isArray(ceis)) {
        for (const item of ceis) {
          findings.push({
            categoria: 'SANCAO',
            severidade: 'CRITICO',
            titulo: 'Constante no CEIS — Empresa Inidônea ou Suspensa',
            descricao: `Sanção: ${item.tipoSancao || 'N/A'} | Órgão sancionador: ${item.orgaoSancionador?.nome || 'N/A'} | Vigência: ${item.dataInicioSancao || '?'} até ${item.dataFimSancao || 'indefinido'} | Fundamentação: ${item.fundamentacaoLegal || 'N/A'}`,
            fonte: 'CGU — Portal da Transparência (CEIS)',
            fonte_url: 'https://portaldatransparencia.gov.br/sancoes/consulta',
            data_ocorrencia: item.dataInicioSancao,
            status_ocorrencia: item.dataFimSancao ? 'ARQUIVADO' : 'ATIVO',
          })
        }
      }

      if (Array.isArray(cnep)) {
        for (const item of cnep) {
          findings.push({
            categoria: 'SANCAO',
            severidade: 'CRITICO',
            titulo: 'Constante no CNEP — Empresa Punida (Lei Anticorrupção)',
            descricao: `Penalidade: ${item.tipoPenalidade || 'N/A'} | Valor multa: ${item.valorMulta ? `R$ ${Number(item.valorMulta).toLocaleString('pt-BR')}` : 'N/A'} | Publicação DOU: ${item.dataPublicacaoDou || 'N/A'}`,
            fonte: 'CGU — Portal da Transparência (CNEP)',
            fonte_url: 'https://portaldatransparencia.gov.br/sancoes/consulta',
            data_ocorrencia: item.dataPublicacaoDou,
            status_ocorrencia: 'ATIVO',
          })
        }
      }
    }

    return { engine: 'Portal Transparência (CGU)', success: true, findings }
  } catch (err: any) {
    return { engine: 'Portal Transparência (CGU)', success: false, findings: [], error: err.message }
  }
}
