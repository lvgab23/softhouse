import { EngineResult, Finding } from '../types'

const BASE_TRANSPARENCIA = 'https://api.portaldatransparencia.gov.br/api-de-dados'
const DATAJUD_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=='

async function getCnpjDetails(cnpj: string): Promise<any | null> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

async function getEmpresasDoSocio(cpf: string): Promise<{ cnpj: string; nome: string }[]> {
  const apiKeyTransp = process.env.TRANSPARENCIA_API_KEY || ''
  const brasilIoToken = process.env.BRASIL_IO_TOKEN || ''

  // 1. brasil.io — dataset socios-brasil (fonte mais completa de QSA por CPF)
  if (brasilIoToken) {
    try {
      const res = await fetch(
        `https://brasil.io/api/dataset/socios-brasil/socios/data/?cpf_socio=${cpf}&format=json`,
        {
          headers: { Authorization: `Token ${brasilIoToken}` },
          signal: AbortSignal.timeout(12000),
        }
      )
      if (res.ok) {
        const data = await res.json()
        const items: any[] = data?.results || []
        if (items.length > 0) {
          return items.slice(0, 10).map((item: any) => ({
            cnpj: (item.cnpj || '').replace(/\D/g, ''),
            nome: item.razao_social || 'N/A',
          })).filter(e => e.cnpj.length === 14)
        }
      }
    } catch {}
  }

  // 2. Portal da Transparência — /socios endpoint (quando disponível)
  if (apiKeyTransp) {
    try {
      const res = await fetch(
        `${BASE_TRANSPARENCIA}/socios?cpf=${cpf}&pagina=1`,
        { headers: { 'chave-api-dados': apiKeyTransp }, signal: AbortSignal.timeout(10000) }
      )
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          const found = data.slice(0, 10).map((item: any) => ({
            cnpj: (item.cnpj || item.cnpjEmpresa || '').replace(/\D/g, ''),
            nome: item.razaoSocial || item.nomeEmpresa || 'N/A',
          })).filter(e => e.cnpj.length === 14)
          if (found.length > 0) return found
        }
      }
    } catch {}
  }

  // 3. open.cnpja.com — consulta pública RF (sem autenticação)
  try {
    const res = await fetch(
      `https://open.cnpja.com/people/${cpf}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (res.ok) {
      const data = await res.json()
      const companies: any[] = data?.companies || data?.offices || []
      if (companies.length > 0) {
        return companies.slice(0, 10).map((c: any) => ({
          cnpj: (c.cnpj || c.taxId || '').replace(/\D/g, ''),
          nome: c.alias || c.name || c.razao_social || 'N/A',
        })).filter(e => e.cnpj.length === 14)
      }
    }
  } catch {}

  return []
}

async function checkCEISCNEPEmpresa(cnpj: string, apiKey: string): Promise<{ ceis: boolean; cnep: boolean }> {
  if (!apiKey) return { ceis: false, cnep: false }
  try {
    const [ceisRes, cnepRes] = await Promise.all([
      fetch(`${BASE_TRANSPARENCIA}/ceis?cnpjSancionado=${cnpj}&pagina=1`, {
        headers: { 'chave-api-dados': apiKey }, signal: AbortSignal.timeout(6000)
      }).then(r => r.ok ? r.json() : null),
      fetch(`${BASE_TRANSPARENCIA}/cnep?cnpjSancionado=${cnpj}&pagina=1`, {
        headers: { 'chave-api-dados': apiKey }, signal: AbortSignal.timeout(6000)
      }).then(r => r.ok ? r.json() : null),
    ])
    return {
      ceis: Array.isArray(ceisRes) && ceisRes.length > 0,
      cnep: Array.isArray(cnepRes) && cnepRes.length > 0,
    }
  } catch { return { ceis: false, cnep: false } }
}

async function searchProcessosEmpresa(cnpj: string, nome: string): Promise<Finding[]> {
  const indices = ['api_publica_tjsp', 'api_publica_tjrj', 'api_publica_tjmg', 'api_publica_trf1', 'api_publica_tst']
  const findings: Finding[] = []

  await Promise.allSettled(indices.map(async (idx) => {
    try {
      const res = await fetch(`https://api-publica.datajud.cnj.jus.br/${idx}/_search`, {
        method: 'POST',
        headers: { Authorization: `APIKey ${DATAJUD_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          size: 3,
          query: {
            bool: {
              should: [
                { match_phrase: { 'partes.nome': nome } },
                { term: { 'partes.cpfCnpj': cnpj } },
              ],
              minimum_should_match: 1,
            },
          },
          _source: ['numeroProcesso', 'classeProcessual', 'movimentos', 'siglaTribunal'],
        }),
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) return
      const data = await res.json()
      for (const hit of (data.hits?.hits || [])) {
        const src = hit._source
        const numero = src.numeroProcesso || ''
        const classe = src.classeProcessual?.nome || 'Processo judicial'
        const lastMov = src.movimentos?.[0]?.nome?.toLowerCase() || ''
        const arquivado = ['baixad', 'arquiv', 'extint', 'encerr'].some(s => lastMov.includes(s))
        findings.push({
          categoria: 'JUDICIAL',
          severidade: arquivado ? 'BAIXO' : 'MEDIO',
          titulo: `${arquivado ? 'Processo encerrado' : 'Processo ativo'}: ${classe} — empresa vinculada`,
          descricao: `Nº ${numero} | Empresa: ${nome} | CNPJ: ${cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')} | ${src.siglaTribunal || idx.split('_').pop()?.toUpperCase()}`,
          fonte: `DataJud — ${src.siglaTribunal || 'CNJ'}`,
          fonte_url: `https://www.jusbrasil.com.br/processos/search?q=${numero.replace(/\D/g, '')}`,
          status_ocorrencia: arquivado ? 'ARQUIVADO' : 'ATIVO',
        })
      }
    } catch {}
  }))

  const seen = new Set<string>()
  return findings.filter(f => {
    const n = f.descricao.match(/Nº (\S+)/)?.[1] || f.titulo
    if (seen.has(n)) return false
    seen.add(n)
    return true
  })
}

export async function checkSocios(cpf: string): Promise<EngineResult> {
  const apiKey = process.env.TRANSPARENCIA_API_KEY || ''
  const cpfClean = cpf.replace(/\D/g, '')
  const findings: Finding[] = []

  try {
    const empresas = await getEmpresasDoSocio(cpfClean)

    if (empresas.length === 0) {
      const hasBrasilIo = !!process.env.BRASIL_IO_TOKEN
      return {
        engine: 'Empresas Vinculadas (QSA)',
        success: true,
        findings: [],
        metadata: {
          message: hasBrasilIo
            ? 'Nenhuma empresa vinculada localizada nas fontes consultadas.'
            : 'Sem resultados. Para ativar busca de empresas vinculadas, configure BRASIL_IO_TOKEN (gratuito em brasil.io).',
        },
      }
    }

    await Promise.allSettled(
      empresas.slice(0, 6).map(async (empresa) => {
        const { cnpj, nome } = empresa
        if (!cnpj) return

        const cnpjFmt = cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')

        const [details, sancoes, processos] = await Promise.all([
          getCnpjDetails(cnpj),
          checkCEISCNEPEmpresa(cnpj, apiKey),
          searchProcessosEmpresa(cnpj, nome),
        ])

        const situacao = (details?.situacao_cadastral || 'N/A').toUpperCase()
        const nomeReal = details?.razao_social || nome
        const irregular = !['ATIVA', 'N/A'].includes(situacao)

        findings.push({
          categoria: 'CADASTRAL',
          severidade: irregular ? 'ALTO' : 'INFO',
          titulo: `Empresa vinculada: ${nomeReal}`,
          descricao: `CNPJ: ${cnpjFmt} | Situação: ${situacao}${details?.uf ? ` | UF: ${details.uf}` : ''}${details?.cnae_fiscal_descricao ? ` | Atividade: ${details.cnae_fiscal_descricao.substring(0, 80)}` : ''}${details?.data_abertura ? ` | Abertura: ${details.data_abertura}` : ''}`,
          fonte: 'Receita Federal / BrasilAPI',
          status_ocorrencia: irregular ? 'IRREGULAR' : 'ATIVO',
        })

        if (sancoes.ceis) {
          findings.push({
            categoria: 'SANCAO',
            severidade: 'CRITICO',
            titulo: `Empresa vinculada no CEIS: ${nomeReal}`,
            descricao: `O analisado é sócio/administrador de empresa constante no CEIS (Inidônea ou Suspensa). CNPJ: ${cnpjFmt}`,
            fonte: 'CGU — Portal da Transparência (CEIS)',
            fonte_url: 'https://portaldatransparencia.gov.br/sancoes/consulta',
            status_ocorrencia: 'ATIVO',
          })
        }
        if (sancoes.cnep) {
          findings.push({
            categoria: 'SANCAO',
            severidade: 'ALTO',
            titulo: `Empresa vinculada no CNEP: ${nomeReal}`,
            descricao: `O analisado é sócio/administrador de empresa punida pela Lei Anticorrupção. CNPJ: ${cnpjFmt}`,
            fonte: 'CGU — Portal da Transparência (CNEP)',
            fonte_url: 'https://portaldatransparencia.gov.br/sancoes/consulta',
            status_ocorrencia: 'ATIVO',
          })
        }

        findings.push(...processos)
      })
    )

    return {
      engine: 'Empresas Vinculadas (QSA)',
      success: true,
      findings,
      metadata: { empresas_encontradas: empresas.length },
    }
  } catch (err: any) {
    return {
      engine: 'Empresas Vinculadas (QSA)',
      success: false,
      findings: [],
      error: err.message,
    }
  }
}
