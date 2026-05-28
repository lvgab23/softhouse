export type Severidade = 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAIXO' | 'INFO'
export type NivelRisco = 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAIXO' | 'LIMPO'
export type Categoria = 'JUDICIAL' | 'CADASTRAL' | 'TRABALHISTA' | 'SANCAO' | 'CRIMINAL' | 'CREDITO' | 'MIDIA' | 'FINANCEIRO' | 'AMBIENTAL'

export interface Finding {
  categoria: Categoria
  severidade: Severidade
  titulo: string
  descricao: string
  fonte: string
  fonte_url?: string
  data_ocorrencia?: string
  status_ocorrencia?: string
}

export interface EngineResult {
  engine: string
  success: boolean
  findings: Finding[]
  error?: string
  metadata?: Record<string, any>
}

export interface ComplianceResumo {
  judicial: number
  cadastral: number
  trabalhista: number
  sancao: number
  criminal: number
  financeiro: number
  ambiental: number
  midia: number
  total: number
}

export interface ComplianceResult {
  documento: string
  tipo: 'CPF' | 'CNPJ'
  nome: string
  score_total: number
  nivel_risco: NivelRisco
  findings: Finding[]
  engines: Record<string, EngineResult>
  resumo: ComplianceResumo
}
