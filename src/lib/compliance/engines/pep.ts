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

export async function checkPEP(documento: string, tipo: 'CPF' | 'CNPJ'): Promise<EngineResult> {
  const apiKey = process.env.TRANSPARENCIA_API_KEY || ''
  if (!apiKey) {
    return {
      engine: 'CGU — PEP & Impedimentos',
      success: false,
      findings: [],
      error: 'Chave não configurada. Defina TRANSPARENCIA_API_KEY no .env.local.',
    }
  }

  const clean = documento.replace(/\D/g, '')
  const findings: Finding[] = []

  try {
    const tasks: Promise<any>[] = []

    if (tipo === 'CNPJ') {
      // Acordos de Leniência são firmados apenas por PJ — filtro por CNPJ funciona
      tasks.push(fetchAPI('cepim', { cnpj: clean }, apiKey))
      tasks.push(fetchAPI('acordos-leniencia', { cnpj: clean }, apiKey))
      tasks.push(Promise.resolve(null))
    } else {
      // A API acordos-leniencia não suporta filtro por CPF — retorna tudo (falso positivo)
      // Expulsões do serviço público só se aplicam a pessoa física
      tasks.push(Promise.resolve(null))
      tasks.push(Promise.resolve(null))
      tasks.push(fetchAPI('expulsoes-do-servico-publico', { cpf: clean }, apiKey))
    }

    const [cepim, acordos, expulsoes] = await Promise.all(tasks)

    if (Array.isArray(cepim)) {
      for (const item of cepim) {
        findings.push({
          categoria: 'SANCAO',
          severidade: 'CRITICO',
          titulo: 'Constante no CEPIM — Entidade Impedida de Receber Recursos Federais',
          descricao: `Entidade: ${item.nomeEntidade || item.razaoSocial || 'N/A'} | Motivo: ${item.motivoImpedimento || 'N/A'} | Órgão: ${item.orgaoSuperior?.nome || 'N/A'} | Vigência: ${item.dataInicioImpedimento || '?'} até ${item.dataFimImpedimento || 'indefinido'}`,
          fonte: 'CGU — Portal da Transparência (CEPIM)',
          fonte_url: 'https://portaldatransparencia.gov.br/cepim',
          data_ocorrencia: item.dataInicioImpedimento,
          status_ocorrencia: item.dataFimImpedimento ? 'ARQUIVADO' : 'ATIVO',
        })
      }
    }

    if (Array.isArray(acordos)) {
      for (const item of acordos) {
        // Ignora registros sem dados mínimos (API retornando lista genérica sem filtro)
        if (!item.situacao && !item.valorAcordo && !item.dataCelebracao && !item.orgaoCelebrador?.nome) continue
        findings.push({
          categoria: 'SANCAO',
          severidade: 'ALTO',
          titulo: 'Acordo de Leniência — Lei Anticorrupção (12.846/2013)',
          descricao: `Situação: ${item.situacao || 'N/A'} | Valor: ${item.valorAcordo ? `R$ ${Number(item.valorAcordo).toLocaleString('pt-BR')}` : 'N/A'} | Data celebração: ${item.dataCelebracao || 'N/A'} | Órgão: ${item.orgaoCelebrador?.nome || 'N/A'}`,
          fonte: 'CGU — Portal da Transparência (Acordos de Leniência)',
          fonte_url: 'https://portaldatransparencia.gov.br/acordos-leniencia',
          data_ocorrencia: item.dataCelebracao,
          status_ocorrencia: item.situacao?.toUpperCase().includes('CUMPR') ? 'CUMPRIDO' : 'ATIVO',
        })
      }
    }

    if (Array.isArray(expulsoes)) {
      for (const item of expulsoes) {
        findings.push({
          categoria: 'SANCAO',
          severidade: 'ALTO',
          titulo: 'Expulsão do Serviço Público Federal',
          descricao: `Nome: ${item.nome || 'N/A'} | Tipo penalidade: ${item.tipoPenalidade || 'N/A'} | Órgão: ${item.orgao?.nome || 'N/A'} | Data: ${item.dataExpulsao || item.dataPenalidade || 'N/A'} | Fundamento: ${item.fundamentoLegal || 'N/A'}`,
          fonte: 'CGU — Portal da Transparência (Expulsões)',
          fonte_url: 'https://portaldatransparencia.gov.br/expulsoes',
          data_ocorrencia: item.dataExpulsao || item.dataPenalidade,
          status_ocorrencia: 'ATIVO',
        })
      }
    }

    return { engine: 'CGU — PEP & Impedimentos', success: true, findings }
  } catch (err: any) {
    return { engine: 'CGU — PEP & Impedimentos', success: false, findings: [], error: err.message }
  }
}
