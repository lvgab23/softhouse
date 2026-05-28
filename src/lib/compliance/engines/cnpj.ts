import { EngineResult, Finding } from '../types'

export async function checkCNPJ(cnpj: string): Promise<EngineResult> {
  const clean = cnpj.replace(/\D/g, '')
  const findings: Finding[] = []

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      throw new Error(res.status === 404 ? 'CNPJ não encontrado na Receita Federal' : `Erro na API: ${res.status}`)
    }

    const data = await res.json()
    const situacao = (data.situacao_cadastral || '').toUpperCase()

    if (situacao && situacao !== 'ATIVA') {
      const severidade = ['INAPTA', 'BAIXADA', 'CANCELADA'].includes(situacao) ? 'ALTO' : 'MEDIO'
      findings.push({
        categoria: 'CADASTRAL',
        severidade,
        titulo: `CNPJ com situação irregular: ${situacao}`,
        descricao: `A empresa "${data.razao_social}" possui situação cadastral "${situacao}" junto à Receita Federal. Data da situação: ${data.data_situacao_cadastral || 'N/A'}. Motivo: ${data.motivo_situacao_cadastral || 'N/A'}.`,
        fonte: 'Receita Federal / BrasilAPI',
        fonte_url: 'https://www.receita.fazenda.gov.br/',
        data_ocorrencia: data.data_situacao_cadastral,
        status_ocorrencia: 'ATIVO',
      })
    }

    return {
      engine: 'Receita Federal',
      success: true,
      findings,
      metadata: {
        razao_social: data.razao_social,
        nome_fantasia: data.nome_fantasia,
        situacao_cadastral: data.situacao_cadastral,
        data_abertura: data.data_abertura,
        porte: data.porte,
        natureza_juridica: data.natureza_juridica,
        cnae: data.cnae_fiscal_descricao,
        uf: data.uf,
        municipio: data.municipio,
        capital_social: data.capital_social,
        qsa: data.qsa || [],
      },
    }
  } catch (err: any) {
    return { engine: 'Receita Federal', success: false, findings: [], error: err.message }
  }
}
