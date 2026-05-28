import { EngineResult, Finding } from '../types'

const BASE = 'https://api.escavador.com/api/v1'

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
}

function inferTribunal(diarioSigla: string, diarioNome: string, estado: string): string {
  if (diarioSigla?.startsWith('TRE-')) return diarioSigla
  if (diarioSigla === 'RPI-INPI') return 'INPI'
  if (estado) return `TJ${estado}`
  return diarioNome || diarioSigla || 'N/A'
}

function isAtivo(dataMovimentacoes: string): boolean {
  if (!dataMovimentacoes) return true
  const parts = dataMovimentacoes.split(' a ')
  const ultima = parts[parts.length - 1]
  const [d, m, y] = ultima.split('/')
  if (!y) return true
  const data = new Date(`${y}-${m}-${d}`)
  const tresAnosAtras = new Date()
  tresAnosAtras.setFullYear(tresAnosAtras.getFullYear() - 3)
  return data > tresAnosAtras
}

export async function checkEscavador(documento: string, tipo: 'CPF' | 'CNPJ', nome: string = ''): Promise<EngineResult> {
  const apiKey = process.env.ESCAVADOR_API_KEY || ''
  if (!apiKey) {
    return { engine: 'Escavador (Processos Judiciais)', success: false, findings: [], error: 'ESCAVADOR_API_KEY não configurada.' }
  }

  if (!nome) {
    return { engine: 'Escavador (Processos Judiciais)', success: false, findings: [], error: 'Nome obrigatório para busca no Escavador. Informe o nome completo na consulta.' }
  }

  const clean = documento.replace(/\D/g, '')
  const findings: Finding[] = []

  try {
    // Busca por nome + documento (quando disponível) para pinpoint exato do perfil
    const tipo_busca = tipo === 'CPF' ? 'pessoas' : 'instituicoes'
    const query = clean ? `${nome} ${clean}` : nome
    const searchRes = await fetch(
      `${BASE}/busca?q=${encodeURIComponent(query)}&tipo=${tipo_busca}`,
      { headers: headers(apiKey), signal: AbortSignal.timeout(15000) }
    )
    if (!searchRes.ok) throw new Error(`Erro ${searchRes.status} na busca`)

    const searchData = await searchRes.json()
    const pessoas = (searchData?.items || []).filter((i: any) => i.tipo_resultado === 'Pessoa' || i.tipo_resultado === 'Instituicao')

    // Com CPF na query, primeiro resultado é o perfil exato — sem CPF, até 2 candidatos
    const limite = clean ? 1 : 2
    const candidatos = pessoas.filter((p: any) => p.quantidade_processos > 0).slice(0, limite)

    for (const pessoa of candidatos) {
      const entityId = pessoa.id
      if (!entityId) continue

      const endpoint = tipo === 'CPF'
        ? `${BASE}/pessoas/${entityId}/processos?limit=50`
        : `${BASE}/instituicoes/${entityId}/processos?limit=50`

      const procRes = await fetch(endpoint, {
        headers: headers(apiKey),
        signal: AbortSignal.timeout(15000),
      })
      if (!procRes.ok) continue

      const procData = await procRes.json()
      const processos: any[] = procData?.items || []

      for (const proc of processos) {
        const numero = proc.numero_novo || proc.numero_antigo || ''
        const tribunal = inferTribunal(proc.diario_sigla, proc.diario_nome, proc.estado)
        const classe = proc.tipo_ultima_movimentacao || proc.tipo || ''
        const ativo = isAtivo(proc.data_movimentacoes)

        const termosCriminais = ['criminal', 'penal', 'crime', 'homicídio', 'tráfico', 'roubo', 'furto', 'corrupção', 'lavagem', 'estelionato', 'peculato', 'extorsão']
        const criminal = termosCriminais.some(t => classe.toLowerCase().includes(t))

        findings.push({
          categoria: criminal ? 'CRIMINAL' : 'JUDICIAL',
          severidade: criminal && ativo ? 'CRITICO' : criminal ? 'ALTO' : ativo ? 'MEDIO' : 'BAIXO',
          titulo: `${ativo ? 'Processo ativo' : 'Processo encerrado'}: ${classe || 'Processo judicial'}`,
          descricao: `Nº ${numero || 'N/A'} | ${tribunal} | Movimentações: ${proc.data_movimentacoes || 'N/A'} (${proc.quantidade_movimentacoes || 0} mov.)`,
          fonte: `Escavador — ${tribunal}`,
          fonte_url: proc.link || `https://www.escavador.com`,
          data_ocorrencia: proc.data_movimentacoes?.split(' a ')?.[0]?.split('/').reverse().join('-'),
          status_ocorrencia: ativo ? 'ATIVO' : 'ARQUIVADO',
        })
      }
    }

    // Deduplica por número de processo
    const seen = new Set<string>()
    const deduped = findings.filter(f => {
      const m = f.descricao.match(/Nº ([\d\-\.]+)/)
      if (!m || m[1] === 'N/A') return true
      if (seen.has(m[1])) return false
      seen.add(m[1])
      return true
    })

    return {
      engine: 'Escavador (Processos Judiciais)',
      success: true,
      findings: deduped,
      metadata: { total_processos: deduped.length, perfis_encontrados: candidatos.length },
    }
  } catch (err: any) {
    return { engine: 'Escavador (Processos Judiciais)', success: false, findings: [], error: err.message }
  }
}
