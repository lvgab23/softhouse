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

export async function checkPGFN(documento: string, tipo: 'CPF' | 'CNPJ'): Promise<EngineResult> {
  const apiKey = process.env.TRANSPARENCIA_API_KEY || ''
  if (!apiKey) {
    return {
      engine: 'PGFN — Dívida Ativa Federal',
      success: false,
      findings: [],
      error: 'Chave não configurada. Defina TRANSPARENCIA_API_KEY no .env.local.',
    }
  }

  const clean = documento.replace(/\D/g, '')
  const findings: Finding[] = []

  try {
    const paramKey = tipo === 'CNPJ' ? 'cnpj' : 'cpf'

    // Dívida ativa PGFN (empresas e pessoas físicas)
    const [pgfn, fgts] = await Promise.all([
      fetchAPI('pgfn-empresas-devedoras', { [paramKey]: clean }, apiKey).catch(() => null),
      fetchAPI('pgfn-fgts-devedores', { [paramKey]: clean }, apiKey).catch(() => null),
    ])

    if (Array.isArray(pgfn)) {
      for (const item of pgfn) {
        const valor = item.valorConsolidado || item.valorTotal || item.valorDevido
        findings.push({
          categoria: 'FINANCEIRO',
          severidade: 'ALTO',
          titulo: 'Inscrição em Dívida Ativa Federal — PGFN',
          descricao: `Situação: ${item.situacaoInscricao || item.situacao || 'N/A'} | Valor consolidado: ${valor ? `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A'} | Tipo: ${item.tipoDivida || item.naturezaJuridica || 'N/A'} | Inscrição: ${item.numeroInscricao || 'N/A'}`,
          fonte: 'PGFN — Procuradoria-Geral da Fazenda Nacional',
          fonte_url: 'https://portaldatransparencia.gov.br/pgfn',
          data_ocorrencia: item.dataInscricao,
          status_ocorrencia: item.situacaoInscricao?.toUpperCase().includes('ATIV') ? 'ATIVO' : (item.situacaoInscricao?.toUpperCase() || 'ATIVO'),
        })
      }
    }

    if (Array.isArray(fgts)) {
      for (const item of fgts) {
        const valor = item.valorConsolidado || item.valorTotal || item.valorDevido
        findings.push({
          categoria: 'FINANCEIRO',
          severidade: 'MEDIO',
          titulo: 'Débito de FGTS em Dívida Ativa — PGFN',
          descricao: `Situação: ${item.situacaoInscricao || item.situacao || 'N/A'} | Valor: ${valor ? `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A'} | Competência: ${item.competencia || 'N/A'}`,
          fonte: 'PGFN — Dívida Ativa FGTS',
          fonte_url: 'https://portaldatransparencia.gov.br/pgfn',
          data_ocorrencia: item.dataInscricao,
          status_ocorrencia: 'ATIVO',
        })
      }
    }

    return { engine: 'PGFN — Dívida Ativa Federal', success: true, findings }
  } catch (err: any) {
    return { engine: 'PGFN — Dívida Ativa Federal', success: false, findings: [], error: err.message }
  }
}
