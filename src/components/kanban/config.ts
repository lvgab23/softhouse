export type ModuleType = 'projects' | 'assets' | 'businesses'

export interface ColumnConfig {
  id: string
  label: string
  color: string
  light: string
  text: string
  border: string
}

export const MODULE_COLUMNS: Record<ModuleType, ColumnConfig[]> = {
  projects: [
    { id: 'planejamento', label: 'Planejamento', color: '#3b82f6', light: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    { id: 'em_andamento', label: 'Em Andamento', color: '#f59e0b', light: '#fffbeb', text: '#b45309', border: '#fde68a' },
    { id: 'revisao',      label: 'Revisão',       color: '#f97316', light: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    { id: 'ativo',        label: 'Ativo',          color: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    { id: 'pausado',      label: 'Pausado',        color: '#94a3b8', light: '#f8fafc', text: '#475569', border: '#e2e8f0' },
    { id: 'encerrado',    label: 'Encerrado',      color: '#64748b', light: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
  ],
  assets: [
    { id: 'em_analise',      label: 'Em Análise',         color: '#6366f1', light: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
    { id: 'aquisicao',       label: 'Em Aquisição',       color: '#3b82f6', light: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    { id: 'documentacao',    label: 'Documentação',       color: '#f59e0b', light: '#fffbeb', text: '#b45309', border: '#fde68a' },
    { id: 'regularizacao',   label: 'Regularização',      color: '#f97316', light: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    { id: 'ativo',           label: 'Ativo',              color: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    { id: 'manutencao',      label: 'Manutenção',         color: '#ef4444', light: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
    { id: 'encerrado',       label: 'Vendido/Encerrado',  color: '#64748b', light: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
  ],
  businesses: [
    { id: 'oportunidade',    label: 'Oportunidade',       color: '#8b5cf6', light: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
    { id: 'em_analise',      label: 'Em Análise',         color: '#3b82f6', light: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    { id: 'negociacao',      label: 'Negociação',         color: '#f59e0b', light: '#fffbeb', text: '#b45309', border: '#fde68a' },
    { id: 'due_diligence',   label: 'Due Diligence',      color: '#f97316', light: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    { id: 'contrato',        label: 'Contrato',           color: '#06b6d4', light: '#ecfeff', text: '#0e7490', border: '#a5f3fc' },
    { id: 'ativo',           label: 'Ativo',              color: '#22c55e', light: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    { id: 'encerrado',       label: 'Encerrado',          color: '#64748b', light: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
  ],
}

export const PRIORITY_CONFIG = {
  baixa:   { label: 'Baixa',   color: '#22c55e', bg: '#f0fdf4' },
  media:   { label: 'Média',   color: '#f59e0b', bg: '#fffbeb' },
  alta:    { label: 'Alta',    color: '#f97316', bg: '#fff7ed' },
  urgente: { label: 'Urgente', color: '#ef4444', bg: '#fef2f2' },
}

export const MODULE_LABELS: Record<ModuleType, string> = {
  projects:   'Projetos',
  assets:     'Bens',
  businesses: 'Negócios',
}
