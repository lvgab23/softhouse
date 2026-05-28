// Utilitários compartilhados entre todos os engines de tribunais

export const CRIMINAL_TERMS = [
  'criminal', 'penal', 'crime', 'homicídio', 'tráfico', 'roubo', 'furto',
  'corrupção', 'lavagem', 'estelionato', 'violência doméstica', 'drogas',
  'receptação', 'sequestro', 'extorsão', 'peculato', 'falsificação',
]

export function isCriminal(text: string): boolean {
  const lower = text.toLowerCase()
  return CRIMINAL_TERMS.some(t => lower.includes(t))
}

// Valida se é um número de processo CNJ real (não placeholder/exemplo)
export function isValidCNJ(digits: string): boolean {
  if (digits.length !== 20) return false

  // Rejeita padrões óbvios de placeholder
  if (/^(\d)\1{19}$/.test(digits)) return false     // todos iguais: 99999...
  if (/^0+$/.test(digits)) return false

  // Ano do processo (posições 9-12) deve ser realista
  const year = parseInt(digits.substring(9, 13))
  if (year < 1988 || year > 2030) return false

  // Segmento de justiça (posição 13) deve ser 1-8
  const j = parseInt(digits[13])
  if (j < 1 || j > 8) return false

  // TT (posições 14-15) — validação por segmento
  const tt = parseInt(digits.substring(14, 16))
  if (j === 8 && (tt < 1 || tt > 27)) return false  // TJs estaduais
  if (j === 4 && (tt < 1 || tt > 6)) return false   // TRFs
  if (j === 5 && (tt < 1 || tt > 24)) return false  // TRTs
  if ((j === 1 || j === 2 || j === 3) && tt !== 0 && tt !== 1) return false // STF/CNJ/STJ

  return true
}

// Extrai números de processo CNJ válidos de um HTML
export function extractProcessNumbers(html: string): string[] {
  const raw = html.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) || []
  const unique = Array.from(new Set(raw))
  return unique.filter(n => isValidCNJ(n.replace(/\D/g, '')))
}

export const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}

export function isBlockedResponse(html: string): boolean {
  return /just a moment|cf-browser-verification|enable javascript and cookies|acesso foi bloqueado|diretrizes de seguran/i.test(html)
}

export function hasNoResults(html: string): boolean {
  return /nenhum processo encontrado|não foram encontrados|sem resultado|0 result/i.test(html)
}

// Extrai classe e assunto das células de tabela próximas ao número do processo
export function extractClasseAssunto(html: string, numero: string): { classe: string; assunto: string; arquivado: boolean } {
  const idx = html.indexOf(numero)
  if (idx === -1) return { classe: '', assunto: '', arquivado: false }

  const context = html.substring(Math.max(0, idx - 300), Math.min(html.length, idx + 3000))
  const cells = (context.match(/<td[^>]*>\s*([^<]{3,120})\s*<\/td>/g) || [])
    .map(c => c.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim())
    .filter(c => c.length > 2 && !/^\d{2}\/\d{2}\/\d{4}$/.test(c) && !/^\d+$/.test(c))

  const arquivado = /arquivad|baixad|extint|cancelad|encerrad/.test(context.toLowerCase())

  return {
    classe: cells[0] || '',
    assunto: cells[1] || '',
    arquivado,
  }
}
