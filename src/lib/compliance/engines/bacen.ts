import { EngineResult, Finding } from '../types'

const OLINDA = 'https://olinda.bcb.gov.br/olinda/servico'

async function fetchOlinda(url: string) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return null
  return res.json()
}

export async function checkBacen(documento: string, tipo: 'CPF' | 'CNPJ'): Promise<EngineResult> {
  const clean = documento.replace(/\D/g, '')
  const findings: Finding[] = []

  try {
    if (tipo === 'CNPJ') {
      // Verifica se o CNPJ é uma instituição financeira do SFN via BrasilAPI
      // O ISPB é os primeiros 8 dígitos do CNPJ (raiz)
      const ispb = clean.substring(0, 8)
      const bankData = await fetch(`https://brasilapi.com.br/api/banks/v1`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      }).then(r => r.ok ? r.json() : null).catch(() => null)

      if (Array.isArray(bankData)) {
        const bank = bankData.find((b: { ispb: string }) => b.ispb === ispb)
        if (bank) {
          findings.push({
            categoria: 'FINANCEIRO',
            severidade: 'INFO',
            titulo: `Instituição Regulada pelo Banco Central`,
            descricao: `${bank.fullName || bank.name} — ISPB: ${ispb}. Entidade autorizada e supervisionada pelo Bacen no Sistema Financeiro Nacional.`,
            fonte: 'Banco Central do Brasil (SFN / BrasilAPI)',
            fonte_url: 'https://www.bcb.gov.br/supervisao/ifsegmentacao',
            status_ocorrencia: 'ATIVO',
          })
        }
      }

      // Processos Administrativos Sancionadores (PAS) por CNPJ
      const pasEncoded = encodeURIComponent(`cnpj eq '${clean}'`)
      const pas = await fetchOlinda(
        `${OLINDA}/PAS/versao/v1/odata/DocumentosJuridicos?$filter=${pasEncoded}&$format=json&$top=10`
      ).catch(() => null)

      if (Array.isArray(pas?.value)) {
        for (const item of pas.value) {
          findings.push({
            categoria: 'FINANCEIRO',
            severidade: 'ALTO',
            titulo: 'Processo Administrativo Sancionador — Banco Central (PAS)',
            descricao: `Processo: ${item.numeroProcesso || 'N/A'} | Assunto: ${item.assunto || 'N/A'} | Situação: ${item.situacao || 'N/A'} | Data: ${item.dataCiencia || item.dataAutuacao || 'N/A'}`,
            fonte: 'Banco Central do Brasil (PAS)',
            fonte_url: 'https://www.bcb.gov.br/estabilidadefinanceira/processoadministrativosancionador',
            data_ocorrencia: item.dataCiencia || item.dataAutuacao,
            status_ocorrencia: item.situacao?.toUpperCase().includes('ENCERR') ? 'ARQUIVADO' : 'ATIVO',
          })
        }
      }
    } else {
      // CPF — busca PAS por pessoa física
      const pasEncoded = encodeURIComponent(`cpf eq '${clean}'`)
      const pas = await fetchOlinda(
        `${OLINDA}/PAS/versao/v1/odata/DocumentosFisicos?$filter=${pasEncoded}&$format=json&$top=10`
      ).catch(() => null)

      if (Array.isArray(pas?.value)) {
        for (const item of pas.value) {
          findings.push({
            categoria: 'FINANCEIRO',
            severidade: 'ALTO',
            titulo: 'Processo Administrativo Sancionador — Banco Central (PAS)',
            descricao: `Processo: ${item.numeroProcesso || 'N/A'} | Assunto: ${item.assunto || 'N/A'} | Situação: ${item.situacao || 'N/A'} | Data: ${item.dataCiencia || item.dataAutuacao || 'N/A'}`,
            fonte: 'Banco Central do Brasil (PAS)',
            fonte_url: 'https://www.bcb.gov.br/estabilidadefinanceira/processoadministrativosancionador',
            data_ocorrencia: item.dataCiencia || item.dataAutuacao,
            status_ocorrencia: item.situacao?.toUpperCase().includes('ENCERR') ? 'ARQUIVADO' : 'ATIVO',
          })
        }
      }
    }

    return { engine: 'Banco Central (Bacen)', success: true, findings }
  } catch (err: any) {
    return { engine: 'Banco Central (Bacen)', success: false, findings: [], error: err.message }
  }
}
