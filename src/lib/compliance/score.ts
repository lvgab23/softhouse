import { Finding, NivelRisco, Severidade } from './types'

const PESOS: Record<Severidade, number> = {
  CRITICO: 40,
  ALTO: 20,
  MEDIO: 8,
  BAIXO: 2,
  INFO: 0,
}

export function calcularScore(findings: Finding[]): { score: number; nivel: NivelRisco } {
  let score = findings.reduce((acc, f) => acc + (PESOS[f.severidade] ?? 0), 0)
  score = Math.min(score, 100)

  let nivel: NivelRisco = 'LIMPO'
  if (score >= 50) nivel = 'CRITICO'
  else if (score >= 25) nivel = 'ALTO'
  else if (score >= 8) nivel = 'MEDIO'
  else if (score >= 1) nivel = 'BAIXO'

  return { score, nivel }
}
