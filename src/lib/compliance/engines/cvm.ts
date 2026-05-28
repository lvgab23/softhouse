import { EngineResult, Finding } from '../types'

const CVM_URLS = [
  'https://dados.cvm.gov.br/dados/INFOSANC/INFOSANC.CSV',
  'https://dados.cvm.gov.br/dados/INFOSANC/infosanc.csv',
]

function parseCSVRow(line: string, sep: string): string[] {
  return line.split(sep).map(c => c.replace(/^"|"$/g, '').trim())
}

export async function checkCVM(documento: string, tipo: 'CPF' | 'CNPJ', nome: string = ''): Promise<EngineResult> {
  const engineName = 'CVM — Mercado de Capitais'
  const clean = documento.replace(/\D/g, '')
  const findings: Finding[] = []

  let csv: string | null = null

  for (const url of CVM_URLS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (res.ok) { csv = await res.text(); break }
    } catch {
      continue
    }
  }

  if (!csv) {
    return {
      engine: engineName,
      success: false,
      findings: [],
      error: 'CSV de sanções CVM indisponível. Verificar manualmente: dados.cvm.gov.br',
    }
  }

  try {
    const lines = csv.split('\n').filter(l => l.trim())
    if (lines.length < 2) {
      return { engine: engineName, success: true, findings: [], metadata: { total_registros: 0 } }
    }

    // Detectar separador (;  ou ,)
    const sep = lines[0].includes(';') ? ';' : ','
    const header = parseCSVRow(lines[0], sep).map(h => h.toLowerCase())

    const idx = (keys: string[]) => header.findIndex(h => keys.some(k => h.includes(k)))
    const idxDoc  = idx(['cpf', 'cnpj', 'documento', 'doc'])
    const idxNome = idx(['nome', 'sancionado', 'pessoa'])
    const idxTipo = idx(['tipo_sancao', 'penalidade', 'sancao', 'tipo'])
    const idxProc = idx(['processo', 'proc', 'pas'])
    const idxIni  = idx(['data_inicio', 'inicio', 'data_sancao', 'data'])
    const idxFim  = idx(['data_fim', 'fim', 'termino', 'vencimento'])

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVRow(lines[i], sep)
      const docLinha = idxDoc >= 0 ? cols[idxDoc]?.replace(/\D/g, '') : ''
      const nomeLinha = idxNome >= 0 ? cols[idxNome] : ''

      const matchDoc = clean && docLinha === clean
      const matchNome = nome && nomeLinha && nomeLinha.toUpperCase().includes(nome.toUpperCase().split(' ')[0])
      if (!matchDoc && !matchNome) continue

      const dataFim = idxFim >= 0 ? cols[idxFim] : ''
      const ativo = !dataFim || dataFim === '' || dataFim === 'N/A'

      findings.push({
        categoria: 'SANCAO',
        severidade: 'ALTO',
        titulo: 'Sanção CVM — Mercado de Capitais',
        descricao: `Sancionado: ${nomeLinha || 'N/A'} | Tipo: ${idxTipo >= 0 ? cols[idxTipo] : 'N/A'} | Processo: ${idxProc >= 0 ? cols[idxProc] : 'N/A'} | Vigência: ${idxIni >= 0 ? cols[idxIni] : '?'} até ${dataFim || 'indeterminado'}`,
        fonte: 'CVM — Comissão de Valores Mobiliários',
        fonte_url: 'https://www.gov.br/cvm/pt-br/assuntos/noticias/sancoes',
        data_ocorrencia: idxIni >= 0 ? cols[idxIni] : undefined,
        status_ocorrencia: ativo ? 'ATIVO' : 'ARQUIVADO',
      })
    }

    return { engine: engineName, success: true, findings, metadata: { total_registros: lines.length - 1 } }
  } catch (err: any) {
    return { engine: engineName, success: false, findings: [], error: err.message }
  }
}
