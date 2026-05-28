import { EngineResult, Finding } from '../types'

function normalizeText(s: string): string {
  return s.toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Partículas de nome que não contribuem para similaridade
const STOPWORDS = new Set(['DOS', 'DAS', 'DEL', 'DES', 'THE', 'VAN', 'VON', 'BIN', 'ABU', 'EL', 'AL'])

function significantWords(s: string): string[] {
  return normalizeText(s).split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w))
}

function nameSimilarity(query: string, candidate: string): number {
  const a = significantWords(query)
  const b = significantWords(candidate)
  if (a.length < 2 || b.length < 2) return 0
  const hits = a.filter(w => b.includes(w)).length
  // Bidirecional: ambos os nomes precisam compartilhar a maioria das palavras entre si
  // Evita falsos positivos de nomes parcialmente semelhantes
  const scoreA = hits / a.length
  const scoreB = hits / b.length
  return Math.min(scoreA, scoreB)
}

function parseCSVLine(line: string): string[] {
  const cols: string[] = []
  let inQuote = false
  let cur = ''
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue }
    if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  cols.push(cur.trim())
  return cols
}

export async function checkSancoesInternacionais(
  documento: string,
  tipo: 'CPF' | 'CNPJ',
  nome: string = ''
): Promise<EngineResult> {
  const engineName = 'Sanções Internacionais (OFAC/ONU/UE)'

  if (!nome) {
    return { engine: engineName, success: false, findings: [], error: 'Nome obrigatório para verificação em listas de sanções internacionais.' }
  }

  const findings: Finding[] = []
  const openSanctionsKey = process.env.OPENSANCTIONS_API_KEY || ''

  try {
    // Primário: OpenSanctions — cobre OFAC, ONU, UE, UK e +200 listas em um único call
    if (openSanctionsKey) {
      const schema = tipo === 'CPF' ? 'Person' : 'Company'
      const res = await fetch(
        `https://api.opensanctions.org/search/default?q=${encodeURIComponent(nome)}&schema=${schema}&limit=10`,
        {
          headers: { Authorization: `ApiKey ${openSanctionsKey}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(12000),
        }
      )
      if (res.ok) {
        const data = await res.json()
        for (const entity of (data?.results || [])) {
          if ((entity.score || 0) < 0.85) continue
          findings.push({
            categoria: 'SANCAO',
            severidade: 'CRITICO',
            titulo: 'Constante em Lista de Sanções Internacionais',
            descricao: `Correspondência: ${entity.caption} | Listas: ${(entity.datasets || []).join(', ')} | Score: ${((entity.score || 0) * 100).toFixed(0)}%`,
            fonte: 'OpenSanctions (OFAC / ONU / UE / +200 listas)',
            fonte_url: `https://www.opensanctions.org/entities/${entity.id}/`,
            status_ocorrencia: 'ATIVO',
          })
        }
        return { engine: engineName, success: true, findings, metadata: { fonte: 'OpenSanctions' } }
      }
    }

    // Fallback: OFAC SDN List — Tesouro Americano (sem chave necessária)
    const sdnRes = await fetch('https://www.treasury.gov/ofac/downloads/sdn.csv', {
      signal: AbortSignal.timeout(20000),
    })
    if (!sdnRes.ok) throw new Error(`OFAC SDN HTTP ${sdnRes.status}`)

    const csv = await sdnRes.text()
    let linhasVerificadas = 0

    for (const line of csv.split('\n')) {
      if (!line.trim()) continue
      linhasVerificadas++
      const cols = parseCSVLine(line)
      const sdnName = cols[1]
      if (!sdnName || sdnName === '-0-') continue

      const score = nameSimilarity(nome, sdnName)
      if (score < 0.85) continue

      findings.push({
        categoria: 'SANCAO',
        severidade: 'CRITICO',
        titulo: 'Correspondência na Lista OFAC SDN — Tesouro Americano',
        descricao: `Nome na lista: ${sdnName} | Tipo: ${cols[2] || 'N/A'} | Programa: ${cols[3] || 'N/A'} | Similaridade: ${(score * 100).toFixed(0)}%`,
        fonte: 'OFAC — US Department of the Treasury (SDN)',
        fonte_url: 'https://sanctionssearch.ofac.treas.gov',
        status_ocorrencia: 'ATIVO',
      })
    }

    return {
      engine: engineName,
      success: true,
      findings,
      metadata: {
        fonte: 'OFAC SDN',
        linhas_verificadas: linhasVerificadas,
        nota: 'Configure OPENSANCTIONS_API_KEY para cobertura completa: ONU + UE + +200 listas',
      },
    }
  } catch (err: any) {
    return { engine: engineName, success: false, findings: [], error: err.message }
  }
}
