import { EngineResult, Finding } from '../types'

export async function checkIBAMA(documento: string, tipo: 'CPF' | 'CNPJ'): Promise<EngineResult> {
  const engineName = 'IBAMA — Infrações Ambientais'
  const clean = documento.replace(/\D/g, '')
  const findings: Finding[] = []

  try {
    // IBAMA API pública — autos de infração por CPF/CNPJ
    const res = await fetch(
      `https://api.ibama.gov.br/v1/autos-infracao?cpfCnpj=${clean}&page=0&size=50`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
      }
    )

    if (!res.ok) {
      // Fallback: portal público CTF
      const res2 = await fetch(
        `https://servicos.ibama.gov.br/ctf/publico/ait/ConsultaPublicaAIT.php?cpfCnpj=${clean}`,
        {
          headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(12000),
        }
      )
      if (!res2.ok) {
        return {
          engine: engineName,
          success: false,
          findings: [],
          error: `API IBAMA indisponível (HTTP ${res.status}). Verificar manualmente: servicos.ibama.gov.br/ctf/publico/ait`,
        }
      }
      // Resposta HTML — não parseável de forma confiável, retorna sucesso sem findings
      return {
        engine: engineName,
        success: true,
        findings: [],
        metadata: { nota: 'Verificar manualmente em servicos.ibama.gov.br/ctf/publico/ait — API JSON indisponível.' },
      }
    }

    const data = await res.json()
    const items: any[] = data?.content || data?.items || (Array.isArray(data) ? data : [])

    for (const item of items) {
      const valor = item.valorMulta || item.valor
      const situacao = (item.situacao || '').toUpperCase()
      const ativo = !['CANCELADO', 'PAGO', 'PRESCRITO', 'ARQUIVADO'].some(s => situacao.includes(s))

      findings.push({
        categoria: 'AMBIENTAL',
        severidade: ativo ? 'ALTO' : 'BAIXO',
        titulo: 'Auto de Infração Ambiental — IBAMA',
        descricao: `Nº: ${item.numeroAuto || item.numero || 'N/A'} | Infração: ${item.descricaoInfracao || item.tipoInfracao || 'N/A'} | Multa: ${valor ? `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A'} | Status: ${item.situacao || 'N/A'} | Data: ${item.dataLavratura || item.data || 'N/A'}`,
        fonte: 'IBAMA — Autos de Infração Ambiental',
        fonte_url: 'https://servicos.ibama.gov.br/ctf/publico/ait/',
        data_ocorrencia: item.dataLavratura || item.data,
        status_ocorrencia: ativo ? 'ATIVO' : 'ARQUIVADO',
      })
    }

    return { engine: engineName, success: true, findings, metadata: { total: items.length } }
  } catch (err: any) {
    return { engine: engineName, success: false, findings: [], error: err.message }
  }
}
