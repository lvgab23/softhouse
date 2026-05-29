'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, ShieldCheck, AlertTriangle, CheckCircle2, Info,
  Scale, Building2, Briefcase, XCircle, Globe, Landmark, Leaf,
  AlertCircle, MinusCircle, Printer, FileText, Sparkles, Loader2,
  TrendingUp, TrendingDown, Minus, ChevronRight, Trash2,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/app-layout'
import { Topbar } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

type Finding = {
  id: string
  categoria: string
  severidade: string
  titulo: string
  descricao: string
  fonte: string
  fonte_url?: string
  data_ocorrencia?: string
  status_ocorrencia?: string
}

type CheckDetail = {
  id: string
  tipo: string
  documento: string
  nome: string | null
  status: string
  score_total: number
  nivel_risco: string
  resumo: Record<string, number>
  created_at: string
  concluido_em: string | null
  findings: Finding[]
}

const RISCO_CONFIG: Record<string, { label: string; variant: any; color: string; bg: string; border: string }> = {
  CRITICO: { label: 'RISCO CRÍTICO', variant: 'danger', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  ALTO: { label: 'RISCO ALTO', variant: 'warning', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  MEDIO: { label: 'RISCO MÉDIO', variant: 'info', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  BAIXO: { label: 'RISCO BAIXO', variant: 'gray', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  LIMPO: { label: 'SEM OCORRÊNCIAS', variant: 'success', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
}

const SEV_CONFIG: Record<string, { variant: any; label: string }> = {
  CRITICO: { variant: 'danger', label: 'Crítico' },
  ALTO: { variant: 'warning', label: 'Alto' },
  MEDIO: { variant: 'info', label: 'Médio' },
  BAIXO: { variant: 'gray', label: 'Baixo' },
  INFO: { variant: 'gray', label: 'Info' },
}

const CAT_CONFIG: Record<string, { label: string; icon: any }> = {
  JUDICIAL: { label: 'Processos Judiciais', icon: Scale },
  CRIMINAL: { label: 'Antecedentes Criminais', icon: AlertTriangle },
  CADASTRAL: { label: 'Situação Cadastral', icon: Building2 },
  TRABALHISTA: { label: 'Débitos Trabalhistas', icon: Briefcase },
  SANCAO: { label: 'Sanções / Impedimentos', icon: XCircle },
  FINANCEIRO: { label: 'Bacen / PGFN', icon: Landmark },
  AMBIENTAL: { label: 'Infrações Ambientais', icon: Leaf },
  CREDITO: { label: 'Restrições de Crédito', icon: ShieldCheck },
  MIDIA: { label: 'Mídia Negativa', icon: Globe },
}

const TABS = ['Todos', 'JUDICIAL', 'CRIMINAL', 'CADASTRAL', 'TRABALHISTA', 'SANCAO', 'FINANCEIRO', 'AMBIENTAL', 'MIDIA', 'NOTICIAS']

function gerarAnalise(data: CheckDetail): string[] {
  const f = data.findings
  const paragrafos: string[] = []
  const nivel = data.nivel_risco
  const nome = data.nome || 'O analisado'
  const doc = data.tipo === 'CPF' ? `CPF ${data.documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}` : `CNPJ ${data.documento.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}`

  // Parágrafo 1 — situação geral
  if (nivel === 'LIMPO') {
    paragrafos.push(`A análise de compliance de ${nome} (${doc}), realizada em ${formatDate(data.created_at)}, não identificou ocorrências nas fontes consultadas. O perfil apresenta baixo risco de compliance, não constando registros em cadastros de sanções, dívida ativa, processos judiciais ou antecedentes criminais nas bases verificadas.`)
  } else {
    const total = f.length
    const criticos = f.filter(x => x.severidade === 'CRITICO').length
    const altos = f.filter(x => x.severidade === 'ALTO').length
    paragrafos.push(`A análise de compliance de ${nome} (${doc}), realizada em ${formatDate(data.created_at)}, identificou ${total} ocorrência(s) nas fontes consultadas, resultando em classificação de ${RISCO_CONFIG[nivel]?.label || nivel}. ${criticos > 0 ? `Foram encontradas ${criticos} ocorrência(s) de severidade CRÍTICA` : altos > 0 ? `Foram encontradas ${altos} ocorrência(s) de severidade ALTA` : 'As ocorrências são de severidade moderada'}, demandando atenção imediata da equipe de compliance.`)
  }

  // Parágrafo 2 — criminais
  const criminais = f.filter(x => x.categoria === 'CRIMINAL')
  if (criminais.length > 0) {
    const ativos = criminais.filter(x => x.status_ocorrencia === 'ATIVO').length
    paragrafos.push(`ANTECEDENTES CRIMINAIS: Foram identificados ${criminais.length} registro(s) de natureza criminal, sendo ${ativos} ativo(s). A existência de antecedentes criminais constitui fator de risco elevado, podendo comprometer a elegibilidade para relações comerciais, contratos com o poder público e acesso a produtos financeiros regulados.`)
  }

  // Parágrafo 3 — sanções
  const sancoes = f.filter(x => x.categoria === 'SANCAO')
  if (sancoes.length > 0) {
    paragrafos.push(`SANÇÕES E IMPEDIMENTOS: Foram encontrados ${sancoes.length} registro(s) em cadastros de sanções (CEIS, CNEP, CEPIM ou similares). Entidades e pessoas físicas constantes nesses cadastros estão impedidas de contratar com a Administração Pública Federal e podem ter restrições em operações financeiras reguladas pelo Banco Central.`)
  }

  // Parágrafo 4 — financeiro/pgfn
  const financeiro = f.filter(x => x.categoria === 'FINANCEIRO')
  if (financeiro.length > 0) {
    paragrafos.push(`SITUAÇÃO FINANCEIRA: Foram identificados ${financeiro.length} registro(s) de natureza financeira, podendo incluir inscrições em Dívida Ativa Federal (PGFN) ou processos administrativos sancionadores junto ao Banco Central. Dívidas com a Fazenda Nacional podem resultar em restrições a financiamentos, exportações e participação em licitações.`)
  }

  // Parágrafo 5 — judiciais
  const judiciais = f.filter(x => x.categoria === 'JUDICIAL')
  if (judiciais.length > 0) {
    const ativos = judiciais.filter(x => x.status_ocorrencia === 'ATIVO').length
    const arquivados = judiciais.length - ativos
    paragrafos.push(`PROCESSOS JUDICIAIS: Foram localizados ${judiciais.length} processo(s) judicial(is), sendo ${ativos} ativo(s) e ${arquivados} encerrado(s). Processos ativos podem indicar litígios em andamento com implicações patrimoniais, trabalhistas ou regulatórias. Recomenda-se a análise detalhada de cada processo para avaliação do mérito e impacto potencial.`)
  }

  // Parágrafo — ambiental
  const ambiental = f.filter(x => x.categoria === 'AMBIENTAL')
  if (ambiental.length > 0) {
    const ativos = ambiental.filter(x => x.status_ocorrencia === 'ATIVO').length
    paragrafos.push(`INFRAÇÕES AMBIENTAIS: Foram identificados ${ambiental.length} auto(s) de infração ambiental junto ao IBAMA, sendo ${ativos} com situação ativa. Infrações ambientais não regularizadas podem resultar em multas, embargos de atividades, impedimentos para obtenção de licenças e restrições a financiamentos públicos e privados.`)
  }

  // Parágrafo — mídia negativa
  const midia = f.filter(x => x.categoria === 'MIDIA')
  if (midia.length > 0) {
    paragrafos.push(`MÍDIA NEGATIVA: Foram encontradas ${midia.length} referência(s) em veículos de imprensa associando o nome analisado a termos de risco (fraude, crime, corrupção, investigação ou similares). Recomenda-se a leitura e avaliação individual de cada resultado para verificar contexto, relevância e atualidade das informações.`)
  }

  // Parágrafo final — recomendação
  if (nivel === 'LIMPO' || nivel === 'BAIXO') {
    paragrafos.push(`RECOMENDAÇÃO: Com base nas informações disponíveis nas fontes consultadas, o perfil analisado apresenta risco baixo. Recomenda-se manutenção do monitoramento periódico conforme política de compliance da instituição.`)
  } else if (nivel === 'MEDIO') {
    paragrafos.push(`RECOMENDAÇÃO: O perfil apresenta risco moderado. Recomenda-se a realização de diligências adicionais, incluindo verificação manual dos processos identificados e coleta de declarações complementares antes da aprovação de novos relacionamentos comerciais ou financeiros.`)
  } else {
    paragrafos.push(`RECOMENDAÇÃO: O perfil apresenta risco ${nivel === 'CRITICO' ? 'crítico' : 'alto'}. É fortemente recomendada a suspensão ou não aprovação do relacionamento até que as ocorrências críticas sejam devidamente esclarecidas. A decisão final deve ser submetida ao Comitê de Compliance ou instância equivalente da instituição.`)
  }

  return paragrafos
}

function ScoreGauge({ score, nivel }: { score: number; nivel: string }) {
  const cfg = RISCO_CONFIG[nivel] || RISCO_CONFIG.LIMPO
  const colors: Record<string, string> = {
    CRITICO: '#ef4444', ALTO: '#f97316', MEDIO: '#eab308', BAIXO: '#3b82f6', LIMPO: '#22c55e',
  }
  const color = colors[nivel] || '#22c55e'
  const radius = 54
  const circ = 2 * Math.PI * radius
  const offset = circ - (score / 100) * circ

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg width="128" height="128" className="-rotate-90">
          <circle cx="64" cy="64" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
          <circle
            cx="64" cy="64" r={radius} fill="none"
            stroke={color} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.2s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-gray-900">{score}</span>
          <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">score</span>
        </div>
      </div>
      <span className={`mt-2 text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
    </div>
  )
}

function formatDoc(doc: string, tipo: string) {
  if (tipo === 'CNPJ') return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function parseJudicialDesc(descricao: string) {
  const get = (prefix: string) => {
    const part = descricao.split(' | ').find(p => p.trim().startsWith(prefix))
    return part ? part.trim().slice(prefix.length).trim() : ''
  }
  const parts = descricao.split(' | ').map(p => p.trim())
  const numero   = get('Nº ')
  const polo     = get('Polo: ')
  const autor    = get('Autor: ')
  const reu      = get('Réu: ')
  const ultimaMov = get('Última mov.: ')
  const movs     = get('Movimentações: ')
  const empresa  = get('Empresa: ')
  // Tribunal: parte que não começa com nenhum prefixo conhecido e não é o número
  const tribunal = parts.find(p =>
    !p.startsWith('Nº ') && !p.startsWith('Polo:') && !p.startsWith('Autor:') &&
    !p.startsWith('Réu:') && !p.startsWith('Última') && !p.startsWith('Movim') &&
    !p.startsWith('Empresa:') && p.length > 0
  ) || ''
  return { numero, tribunal, polo, autor, reu, ultimaMov: ultimaMov || movs, empresa }
}

function JudicialCard({ f }: { f: Finding }) {
  const sevCfg = SEV_CONFIG[f.severidade] || SEV_CONFIG.INFO
  const { numero, tribunal, polo, autor, reu, ultimaMov, empresa } = parseJudicialDesc(f.descricao || '')
  const classe = f.titulo.replace(/^Processo (ativo|encerrado): /, '')
  const isAtivo = f.status_ocorrencia === 'ATIVO'
  const poloColor = polo === 'PASSIVO' ? 'border-l-red-400' : polo === 'ATIVO' ? 'border-l-blue-400' : 'border-l-gray-300'

  return (
    <div className={`p-4 border-l-4 ${poloColor} hover:bg-gray-50 transition-colors`}>
      {/* Linha 1: classe + badges */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <Scale className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-900">{classe || 'Processo judicial'}</span>
        <Badge variant={sevCfg.variant}>{sevCfg.label}</Badge>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          isAtivo ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
        }`}>{isAtivo ? 'ATIVO' : 'ENCERRADO'}</span>
        {f.categoria === 'CRIMINAL' && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-900 text-white">CRIMINAL</span>
        )}
      </div>

      {/* Grid de informações */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
        {numero && (
          <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Número</p>
            <p className="text-[11px] font-mono text-gray-700 break-all">{numero}</p>
          </div>
        )}
        {tribunal && (
          <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Tribunal</p>
            <p className="text-[11px] font-semibold text-gray-700">{tribunal}</p>
          </div>
        )}
        {polo && polo !== 'INDEFINIDO' && (
          <div className={`rounded-lg px-2.5 py-1.5 ${
            polo === 'PASSIVO' ? 'bg-red-50' : 'bg-blue-50'
          }`}>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Polo do analisado</p>
            <p className={`text-[11px] font-bold ${polo === 'PASSIVO' ? 'text-red-700' : 'text-blue-700'}`}>
              {polo === 'PASSIVO' ? '⚠ RÉU / DEMANDADO' : '→ AUTOR / DEMANDANTE'}
            </p>
          </div>
        )}
        {ultimaMov && (
          <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Última mov.</p>
            <p className="text-[11px] text-gray-700">{ultimaMov}</p>
          </div>
        )}
      </div>

      {/* Partes */}
      {(autor || reu || empresa) && (
        <div className="flex flex-wrap gap-2 mb-2">
          {autor && (
            <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1">
              <TrendingUp className="h-3 w-3 text-blue-500 flex-shrink-0" />
              <span className="text-[10px] font-semibold text-blue-700">Polo Ativo:</span>
              <span className="text-[10px] text-blue-900">{autor}</span>
            </div>
          )}
          {reu && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1">
              <TrendingDown className="h-3 w-3 text-red-500 flex-shrink-0" />
              <span className="text-[10px] font-semibold text-red-700">Polo Passivo:</span>
              <span className="text-[10px] text-red-900">{reu}</span>
            </div>
          )}
          {empresa && !autor && !reu && (
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1">
              <Building2 className="h-3 w-3 text-gray-500 flex-shrink-0" />
              <span className="text-[10px] text-gray-700">{empresa}</span>
            </div>
          )}
        </div>
      )}

      {/* Rodapé */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] text-gray-400">Fonte: {f.fonte}</span>
        {f.data_ocorrencia && <span className="text-[10px] text-gray-400">Data: {f.data_ocorrencia}</span>}
        {f.fonte_url && (
          <a href={f.fonte_url} target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-blue-500 hover:underline no-print">
            Ver no portal →
          </a>
        )}
      </div>
    </div>
  )
}

function sanitizeAnaliseIA(raw: any): any {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const toStr = (v: any) => (v == null ? '' : String(v))
  const toNum = (v: any) => (typeof v === 'number' ? v : Number(v) || 0)
  const toArr = (v: any): string[] =>
    Array.isArray(v) ? v.map(toStr).filter(Boolean) : []
  const toObjArr = (v: any): any[] => (Array.isArray(v) ? v : [])
  return {
    score_ia: toNum(raw.score_ia),
    nivel_risco: toStr(raw.nivel_risco) || 'LIMPO',
    resumo_executivo: toStr(raw.resumo_executivo),
    analise_financeira: toStr(raw.analise_financeira),
    recomendacao_final: toStr(raw.recomendacao_final),
    justificativa_score: toStr(raw.justificativa_score),
    pontos_atencao: toArr(raw.pontos_atencao),
    processos_analise: toObjArr(raw.processos_analise).map((p: any) => ({
      numero: toStr(p?.numero),
      titulo: toStr(p?.titulo),
      tribunal: toStr(p?.tribunal),
      polo: toStr(p?.polo) || 'INDEFINIDO',
      polo_descricao: toStr(p?.polo_descricao),
      status: toStr(p?.status) || 'ATIVO',
      natureza: toStr(p?.natureza),
      resumo: toStr(p?.resumo),
      impacto_compliance: toStr(p?.impacto_compliance),
      observacoes: toStr(p?.observacoes),
      do_que_se_trata: toStr(p?.do_que_se_trata),
      possiveis_implicacoes: toStr(p?.possiveis_implicacoes),
      movimentacoes: toStr(p?.movimentacoes),
    })),
  }
}

export default function ResultadoPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [data, setData] = useState<CheckDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Todos')
  const [analiseIA, setAnaliseIA] = useState<any>(null)
  const [loadingIA, setLoadingIA] = useState(false)
  const [erroIA, setErroIA] = useState('')

  useEffect(() => {
    fetch(`/api/compliance/checks/${id}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
        // Carrega análise IA salva anteriormente, se existir
        if (d?.resumo?._ai_analise) setAnaliseIA(sanitizeAnaliseIA(d.resumo._ai_analise))
      })
      .catch(() => setLoading(false))
  }, [id])

  async function gerarAnaliseIA() {
    setLoadingIA(true)
    setErroIA('')
    try {
      const res = await fetch(`/api/compliance/analisar/${id}`, { method: 'POST' })
      const resClone = res.clone()
      let json: any
      try {
        json = await res.json()
      } catch {
        const text = await resClone.text().catch(() => '')
        throw new Error(text?.substring(0, 300) || `Erro ${res.status} — tente novamente`)
      }
      if (!res.ok) throw new Error(json?.error || `Erro ${res.status}`)
      setAnaliseIA(sanitizeAnaliseIA(json.analise))
      // Atualiza o score exibido com o score contextual da IA
      if (json.analise?.score_ia !== undefined && json.analise?.nivel_risco) {
        setData(prev => prev ? {
          ...prev,
          score_total: json.analise.score_ia,
          nivel_risco: json.analise.nivel_risco,
        } : prev)
      }
    } catch (e: any) {
      setErroIA(e.message)
    } finally {
      setLoadingIA(false)
    }
  }

  function downloadRelatorioPDF() {
    if (!analiseIA || !data) return
    const nome = data.nome || data.documento
    const doc = data.tipo === 'CPF'
      ? data.documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      : data.documento.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')

    const nivelColor: Record<string, string> = {
      CRITICO: '#dc2626', ALTO: '#ea580c', MEDIO: '#ca8a04', BAIXO: '#2563eb', LIMPO: '#16a34a',
    }
    const cor = nivelColor[analiseIA.nivel_risco] || '#1e293b'

    const processosHtml = (analiseIA.processos_analise || []).map((p: any, i: number) => `
      <div style="margin:12px 0;padding:10px 12px;border-left:3px solid ${p.polo === 'PASSIVO' ? '#dc2626' : p.polo === 'ATIVO' ? '#2563eb' : '#94a3b8'};background:#f8fafc;border-radius:0 6px 6px 0">
        <div style="font-size:11px;color:#64748b;margin-bottom:4px">
          <b style="color:${p.polo === 'PASSIVO' ? '#dc2626' : p.polo === 'ATIVO' ? '#2563eb' : '#475569'}">[${i+1}] ${p.polo === 'PASSIVO' ? '⚠ RÉU/DEMANDADO' : p.polo === 'ATIVO' ? '→ AUTOR/DEMANDANTE' : '? POLO INDEFINIDO'}</b>
          &nbsp;|&nbsp;${p.status || 'N/I'}&nbsp;|&nbsp;${p.natureza || ''}&nbsp;|&nbsp;Impacto: <b>${p.impacto_compliance || 'N/I'}</b>
        </div>
        <div style="font-size:12px;font-weight:600;color:#1e293b;margin-bottom:2px">${p.titulo || 'Processo'}</div>
        <div style="font-size:11px;color:#475569">Nº ${p.numero || 'N/I'} | ${p.tribunal || ''}</div>
        ${p.polo_descricao ? `<div style="font-size:11px;color:#64748b;margin-top:3px">${p.polo_descricao}</div>` : ''}
        ${p.resumo ? `<div style="font-size:11px;color:#374151;margin-top:4px">${p.resumo}</div>` : ''}
      </div>`).join('')

    const pontosHtml = (analiseIA.pontos_atencao || []).map((p: string) =>
      `<li style="margin:4px 0;font-size:12px">${p}</li>`).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Relatório Compliance — ${nome}</title>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#1e293b;font-size:13px}
  h1{font-size:17px;color:#0f172a;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:16px}
  h2{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin:20px 0 8px}
  .score-box{display:flex;align-items:center;gap:24px;padding:16px;background:#f8fafc;border-radius:8px;margin-bottom:16px}
  .score-num{font-size:52px;font-weight:900;color:${cor};line-height:1}
  .nivel{font-size:14px;font-weight:700;color:${cor}}
  .section{margin:16px 0;padding:12px 16px;background:#f8fafc;border-radius:6px}
  ul{margin:0;padding-left:20px} li{margin:3px 0}
  .footer{margin-top:32px;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px}
  @media print{body{padding:16px}button{display:none}}
</style></head><body>
<h1>RELATÓRIO DE COMPLIANCE — ANÁLISE COM INTELIGÊNCIA ARTIFICIAL</h1>
<table style="font-size:12px;margin-bottom:12px"><tr><td style="padding-right:32px"><b>Analisado:</b> ${nome}</td><td><b>Documento:</b> ${doc} (${data.tipo})</td></tr>
<tr><td><b>Data:</b> ${formatDate(data.created_at)}</td><td><b>Gerado em:</b> ${new Date().toLocaleDateString('pt-BR')}</td></tr></table>

<div class="score-box">
  <div><div class="score-num">${analiseIA.score_ia}</div><div style="font-size:10px;color:#64748b">SCORE IA</div></div>
  <div><div class="nivel">${analiseIA.nivel_risco}</div><div style="font-size:10px;color:#64748b;margin-top:4px">NÍVEL DE RISCO</div></div>
</div>

<h2>Resumo Executivo</h2>
<div class="section"><p style="margin:0;line-height:1.6">${analiseIA.resumo_executivo || ''}</p></div>

${(analiseIA.processos_analise?.length > 0) ? `<h2>Processos Judiciais Analisados (${analiseIA.processos_analise.length})</h2>${processosHtml}` : ''}

${analiseIA.analise_financeira ? `<h2>Situação Financeira</h2><div class="section"><p style="margin:0">${analiseIA.analise_financeira}</p></div>` : ''}

${pontosHtml ? `<h2>Pontos de Atenção</h2><ul>${pontosHtml}</ul>` : ''}

<h2>Recomendação Final</h2>
<div class="section" style="background:#fef9f0;border-left:3px solid ${cor}">
  <p style="margin:0;line-height:1.6">${analiseIA.recomendacao_final || ''}</p>
</div>

${analiseIA.justificativa_score ? `<h2>Justificativa do Score</h2><p style="font-size:11px;color:#475569">${analiseIA.justificativa_score}</p>` : ''}

<div class="footer">
  Relatório gerado pelo sistema SoftHouse — Compliance IA | Esta análise não substitui parecer jurídico profissional.<br>
  ${nome} | ${doc} | Score IA: ${analiseIA.score_ia}/100
</div>
<script>setTimeout(()=>window.print(),600)</script>
</body></html>`

    const win = window.open('', '_blank')
    if (!win) { alert('Permita pop-ups para baixar o PDF.'); return }
    win.document.write(html)
    win.document.close()
  }

  if (loading) {
    return (
      <AppLayout>
        <Topbar title="Resultado" subtitle="Carregando..." />
        <div className="p-6 space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />)}
        </div>
      </AppLayout>
    )
  }

  if (!data) {
    return (
      <AppLayout>
        <Topbar title="Resultado" subtitle="Consulta não encontrada" />
        <div className="p-6 flex flex-col items-center py-12">
          <p className="text-gray-500">Consulta não encontrada ou sem permissão.</p>
          <Button className="mt-4" onClick={() => router.push('/compliance/dashboard')}>Voltar</Button>
        </div>
      </AppLayout>
    )
  }

  const cfg = RISCO_CONFIG[data.nivel_risco] || RISCO_CONFIG.LIMPO
  const midiaFindings = data.findings.filter(f => f.categoria === 'MIDIA')
  const financeiro = data.findings.filter(f => f.categoria === 'FINANCEIRO')
  const filteredFindings = tab === 'Todos' ? data.findings : tab === 'NOTICIAS' ? midiaFindings : data.findings.filter(f => f.categoria === tab)
  const analise = gerarAnalise(data)

  return (
    <AppLayout>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          body { background: white !important; }
          .print-full { width: 100% !important; max-width: 100% !important; }
        }
      `}</style>

      <Topbar
        title="Resultado de Compliance"
        subtitle={data.nome || formatDoc(data.documento, data.tipo)}
      >
        <Button variant="outline" size="sm" onClick={() => router.push('/compliance/dashboard')} className="no-print">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button
          variant="outline" size="sm" className="no-print text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          onClick={async () => {
            if (!confirm('Excluir esta consulta permanentemente?')) return
            const res = await fetch(`/api/compliance/checks?id=${id}`, { method: 'DELETE' })
            if (res.ok) {
              router.push('/compliance/dashboard')
            } else {
              const data = await res.json().catch(() => ({}))
              alert(`Erro ao excluir: ${data.error || res.status}`)
            }
          }}
        >
          <Trash2 className="h-4 w-4 mr-1" /> Excluir
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="no-print">
          <Printer className="h-4 w-4 mr-1" /> Imprimir
        </Button>
        {analiseIA && (
          <Button variant="outline" size="sm" onClick={downloadRelatorioPDF} className="no-print text-violet-600 hover:text-violet-700 hover:bg-violet-50 border-violet-200">
            <FileText className="h-4 w-4 mr-1" /> Baixar PDF IA
          </Button>
        )}
        <Button
          size="sm"
          onClick={gerarAnaliseIA}
          disabled={loadingIA}
          className="no-print bg-violet-600 hover:bg-violet-700 text-white"
        >
          {loadingIA
            ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Analisando...</>
            : <><Sparkles className="h-4 w-4 mr-1" /> {analiseIA ? 'Reanalisar com IA' : 'Analisar com IA'}</>
          }
        </Button>
        <Button size="sm" onClick={() => router.push('/compliance/consulta')} className="no-print">
          Nova Consulta
        </Button>
      </Topbar>

      <div className="p-6 space-y-5 print-full">

        {/* Header card */}
        <div className={`bg-white rounded-xl border ${cfg.border} p-5`}>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <ScoreGauge score={data.score_total} nivel={data.nivel_risco} />

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {data.nome || formatDoc(data.documento, data.tipo)}
                  </h2>
                  {data.nome && (
                    <p className="text-sm text-gray-500 mt-0.5">{formatDoc(data.documento, data.tipo)} · {data.tipo}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Analisado em {formatDate(data.created_at)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-8 gap-3 mt-4">
                {Object.entries({
                  Judicial: data.resumo?.judicial || 0,
                  Criminal: data.resumo?.criminal || 0,
                  Cadastral: data.resumo?.cadastral || 0,
                  Trabalhista: data.resumo?.trabalhista || 0,
                  Sanções: data.resumo?.sancao || 0,
                  Financeiro: (data.resumo as any)?.financeiro || 0,
                  Ambiental: (data.resumo as any)?.ambiental || 0,
                  Mídia: (data.resumo as any)?.midia || 0,
                }).map(([label, val]) => (
                  <div key={label} className={`rounded-lg p-2.5 text-center ${val > 0 ? cfg.bg : 'bg-gray-50'}`}>
                    <p className={`text-xl font-bold ${val > 0 ? cfg.color : 'text-gray-400'}`}>{val}</p>
                    <p className="text-[10px] text-gray-500 font-medium">{label}</p>
                  </div>
                ))}
              </div>

              {data.findings.length === 0 && (
                <div className="mt-4 flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <p className="text-sm font-medium text-green-700">Nenhuma ocorrência encontrada nas fontes consultadas.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Análise narrativa */}
        <div className="bg-white rounded-xl border border-black/[0.07] p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Análise de Compliance</h3>
          </div>
          <div className="space-y-3">
            {analise.map((p, i) => {
              const isHeader = p.match(/^(ANTECEDENTES|SANÇÕES|SITUAÇÃO|PROCESSOS|RECOMENDAÇÃO):/)
              if (isHeader) {
                const [titulo, ...resto] = p.split(': ')
                return (
                  <div key={i} className={`p-3 rounded-lg ${
                    titulo === 'RECOMENDAÇÃO'
                      ? data.nivel_risco === 'LIMPO' || data.nivel_risco === 'BAIXO' ? 'bg-green-50' : data.nivel_risco === 'MEDIO' ? 'bg-yellow-50' : 'bg-red-50'
                      : 'bg-gray-50'
                  }`}>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{titulo}</span>
                    <p className="text-sm text-gray-700 mt-1">{resto.join(': ')}</p>
                  </div>
                )
              }
              return <p key={i} className="text-sm text-gray-700 leading-relaxed">{p}</p>
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-4 pt-3 border-t border-gray-100">
            Esta análise é gerada automaticamente com base nas fontes consultadas e não substitui parecer jurídico. Score calculado conforme metodologia interna de ponderação de riscos. Gerado em {formatDate(data.created_at)}.
          </p>
        </div>

        {/* Análise com IA */}
        {erroIA && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
            {erroIA}
          </div>
        )}

        {analiseIA && (
          <div className="bg-white rounded-xl border border-violet-200 p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-violet-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Análise com Inteligência Artificial</h3>
              </div>
              <button
                onClick={downloadRelatorioPDF}
                className="no-print flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 border border-violet-200 hover:border-violet-400 px-3 py-1.5 rounded-lg transition-colors bg-violet-50 hover:bg-violet-100"
                title="Baixar relatório IA em PDF"
              >
                <FileText className="h-3.5 w-3.5" /> Baixar PDF
              </button>
              {/* Score IA */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Score IA</p>
                  <p className={`text-2xl font-black ${
                    analiseIA.score_ia >= 50 ? 'text-red-600' :
                    analiseIA.score_ia >= 25 ? 'text-orange-500' :
                    analiseIA.score_ia >= 8  ? 'text-yellow-600' :
                    analiseIA.score_ia >= 1  ? 'text-blue-600' : 'text-green-600'
                  }`}>{analiseIA.score_ia}</p>
                </div>
                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  analiseIA.nivel_risco === 'CRITICO' ? 'bg-red-100 text-red-700' :
                  analiseIA.nivel_risco === 'ALTO'    ? 'bg-orange-100 text-orange-700' :
                  analiseIA.nivel_risco === 'MEDIO'   ? 'bg-yellow-100 text-yellow-700' :
                  analiseIA.nivel_risco === 'BAIXO'   ? 'bg-blue-100 text-blue-700' :
                                                        'bg-green-100 text-green-700'
                }`}>
                  {analiseIA.nivel_risco}
                </div>
              </div>
            </div>

            {/* Resumo executivo */}
            <div className="bg-violet-50 rounded-lg p-4">
              <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-1">Resumo Executivo</p>
              <p className="text-sm text-gray-700 leading-relaxed">{analiseIA.resumo_executivo}</p>
            </div>

            {/* Processos analisados */}
            {analiseIA.processos_analise?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                  Processos Judiciais — Análise Detalhada ({analiseIA.processos_analise.length})
                </p>
                <div className="space-y-3">
                  {analiseIA.processos_analise.map((proc: any, i: number) => (
                    <div key={i} className={`rounded-xl border p-4 space-y-3 ${
                      proc.polo === 'PASSIVO' ? 'border-red-200 bg-red-50/30' :
                      proc.polo === 'ATIVO'   ? 'border-blue-200 bg-blue-50/30' :
                                                'border-gray-200 bg-gray-50/30'
                    }`}>
                      {/* Cabeçalho do processo */}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            proc.polo === 'PASSIVO' ? 'bg-red-100 text-red-700' :
                            proc.polo === 'ATIVO'   ? 'bg-blue-100 text-blue-700' :
                                                      'bg-gray-100 text-gray-600'
                          }`}>
                            {proc.polo === 'PASSIVO' ? '⚠ RÉU / DEMANDADO' :
                             proc.polo === 'ATIVO'   ? '→ AUTOR / DEMANDANTE' : '? POLO INDEFINIDO'}
                          </span>
                          <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                            proc.status === 'ATIVO' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
                          }`}>{proc.status}</span>
                          <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-1 rounded-full font-medium capitalize">
                            {proc.natureza}
                          </span>
                          {proc.impacto_compliance && (
                            <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                              proc.impacto_compliance?.startsWith('ALTO')  ? 'bg-red-100 text-red-700' :
                              proc.impacto_compliance?.startsWith('MEDIO') ? 'bg-yellow-100 text-yellow-700' :
                                                                              'bg-green-100 text-green-700'
                            }`}>
                              Impacto: {proc.impacto_compliance?.split(' — ')[0]}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dados identificadores */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {proc.numero && proc.numero !== 'Não informado' && (
                          <div className="bg-white rounded-lg p-2.5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Número do processo</p>
                            <p className="text-xs font-mono text-gray-800 mt-0.5">{proc.numero}</p>
                          </div>
                        )}
                        {proc.tribunal && (
                          <div className="bg-white rounded-lg p-2.5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Tribunal / Local</p>
                            <p className="text-xs text-gray-800 mt-0.5">{proc.tribunal}</p>
                          </div>
                        )}
                        {proc.titulo && (
                          <div className="bg-white rounded-lg p-2.5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Classe processual</p>
                            <p className="text-xs text-gray-800 mt-0.5">{proc.titulo}</p>
                          </div>
                        )}
                        {proc.polo_descricao && (
                          <div className="bg-white rounded-lg p-2.5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Posição do analisado</p>
                            <p className="text-xs text-gray-800 mt-0.5">{proc.polo_descricao}</p>
                          </div>
                        )}
                        {proc.movimentacoes && (
                          <div className="bg-white rounded-lg p-2.5 md:col-span-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Movimentações</p>
                            <p className="text-xs text-gray-700 mt-0.5">{proc.movimentacoes}</p>
                          </div>
                        )}
                      </div>

                      {/* Do que se trata */}
                      {proc.do_que_se_trata && (
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Do que se trata</p>
                          <p className="text-xs text-gray-700 leading-relaxed">{proc.do_que_se_trata}</p>
                        </div>
                      )}

                      {/* Possíveis implicações */}
                      {proc.possiveis_implicacoes && (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                          <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Possíveis implicações</p>
                          <p className="text-xs text-gray-700 leading-relaxed">{proc.possiveis_implicacoes}</p>
                        </div>
                      )}

                      {/* Impacto compliance + observações */}
                      <div className="flex flex-col gap-2">
                        {proc.impacto_compliance && (
                          <p className="text-[11px] text-gray-500">
                            <strong className="text-gray-600">Impacto na análise:</strong> {proc.impacto_compliance?.split(' — ')[1] || proc.impacto_compliance}
                          </p>
                        )}
                        {proc.observacoes && proc.observacoes !== 'N/A' && (
                          <p className="text-[11px] text-gray-400 italic">{proc.observacoes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Análise financeira */}
            {analiseIA.analise_financeira && financeiro.length > 0 && (
              <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wide mb-1">Análise Financeira</p>
                <p className="text-sm text-gray-700 leading-relaxed">{analiseIA.analise_financeira}</p>
              </div>
            )}

            {/* Pontos de atenção */}
            {analiseIA.pontos_atencao?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Pontos de Atenção</p>
                <ul className="space-y-1.5">
                  {analiseIA.pontos_atencao.map((p: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <ChevronRight className="h-3.5 w-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recomendação */}
            <div className={`rounded-lg p-4 ${
              analiseIA.nivel_risco === 'LIMPO' || analiseIA.nivel_risco === 'BAIXO' ? 'bg-green-50' :
              analiseIA.nivel_risco === 'MEDIO' ? 'bg-yellow-50' : 'bg-red-50'
            }`}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Recomendação</p>
              <p className="text-sm text-gray-700 leading-relaxed">{analiseIA.recomendacao_final}</p>
            </div>

            {/* Justificativa do score */}
            {analiseIA.justificativa_score && (
              <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-3">
                <strong>Justificativa do score:</strong> {analiseIA.justificativa_score}
              </p>
            )}

            <p className="text-[10px] text-gray-400">
              Análise gerada por IA (Claude). Não substitui parecer jurídico. Use como apoio à decisão.
            </p>
          </div>
        )}

        {/* Findings */}
        {data.findings.length > 0 && (
          <div className="bg-white rounded-xl border border-black/[0.07]">
            <div className="px-5 py-4 border-b border-black/[0.06]">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Ocorrências Encontradas ({data.findings.length})
              </h3>
              <div className="flex items-center gap-2 flex-wrap no-print">
                {TABS.map(t => {
                  const count = t === 'Todos'
                    ? data.findings.length
                    : t === 'NOTICIAS'
                    ? midiaFindings.length
                    : data.findings.filter(f => f.categoria === t).length
                  if (count === 0 && t !== 'Todos') return null
                  const label = t === 'Todos' ? 'Todos'
                    : t === 'NOTICIAS' ? 'Notícias'
                    : CAT_CONFIG[t]?.label || t
                  return (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        tab === t
                          ? t === 'NOTICIAS' ? 'bg-blue-600 text-white' : 'bg-[#0f172a] text-white'
                          : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {label} ({count})
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Aba Notícias — layout especial */}
            {tab === 'NOTICIAS' && (
              <div className="p-5">
                {midiaFindings.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <Globe className="h-10 w-10 text-gray-200 mb-2" />
                    <p className="text-sm text-gray-500">Nenhuma notícia negativa encontrada</p>
                    <p className="text-xs text-gray-400 mt-1">Configure GOOGLE_API_KEY + GOOGLE_SEARCH_CX para ativar a busca em mídia</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {midiaFindings.map(f => {
                      const parts = f.descricao?.split('| Domínio:') || []
                      const resumo = parts[0]?.trim() || f.descricao
                      const dominio = parts[1]?.trim() || f.fonte
                      return (
                        <a
                          key={f.id}
                          href={f.fonte_url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all group"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded uppercase">Mídia Negativa</span>
                                <span className="text-[10px] text-gray-400 truncate">{dominio}</span>
                              </div>
                              <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-800 leading-snug mb-1">{f.titulo}</p>
                              <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{resumo}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 flex-shrink-0 mt-1" />
                          </div>
                        </a>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {tab !== 'NOTICIAS' && <div className="divide-y divide-gray-50">
              {filteredFindings.map(f => {
                if (f.categoria === 'JUDICIAL' || f.categoria === 'CRIMINAL') {
                  return <JudicialCard key={f.id} f={f} />
                }
                const sevCfg = SEV_CONFIG[f.severidade] || SEV_CONFIG.INFO
                const catCfg = CAT_CONFIG[f.categoria] || { label: f.categoria, icon: Info }
                const CatIcon = catCfg.icon
                return (
                  <div key={f.id} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        f.severidade === 'CRITICO' ? 'bg-red-100' :
                        f.severidade === 'ALTO' ? 'bg-orange-100' :
                        f.severidade === 'MEDIO' ? 'bg-yellow-100' : 'bg-gray-100'
                      }`}>
                        <CatIcon className={`h-4 w-4 ${
                          f.severidade === 'CRITICO' ? 'text-red-600' :
                          f.severidade === 'ALTO' ? 'text-orange-600' :
                          f.severidade === 'MEDIO' ? 'text-yellow-600' : 'text-gray-500'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-gray-900">{f.titulo}</span>
                          <Badge variant={sevCfg.variant}>{sevCfg.label}</Badge>
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-medium">
                            {catCfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">{f.descricao}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-[11px] text-gray-400">Fonte: {f.fonte}</span>
                          {f.data_ocorrencia && (
                            <span className="text-[11px] text-gray-400">Data: {f.data_ocorrencia}</span>
                          )}
                          {f.status_ocorrencia && (
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                              f.status_ocorrencia === 'ATIVO' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {f.status_ocorrencia}
                            </span>
                          )}
                          {f.fonte_url && (
                            <a href={f.fonte_url} target="_blank" rel="noopener noreferrer"
                              className="text-[11px] text-blue-500 hover:underline no-print">
                              Ver fonte →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>}
          </div>
        )}

        {/* Engines summary */}
        <div className="bg-white rounded-xl border border-black/[0.07] p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Fontes Consultadas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: 'Receita Federal', key: 'Receita Federal', keyword: 'receita', cat: '' },
              { label: 'Portal Transparência (CEIS/CNEP)', key: 'Portal Transparência (CGU)', keyword: 'transparência', cat: '' },
              { label: 'CGU — PEP & Impedimentos', key: 'CGU — PEP & Impedimentos', keyword: 'pep|cgu|expuls|leniência|cepim', cat: '' },
              { label: 'Banco Central (PAS)', key: 'Banco Central (Bacen)', keyword: 'bacen', cat: '' },
              { label: 'PGFN — Dívida Ativa Federal', key: 'PGFN — Dívida Ativa Federal', keyword: 'pgfn', cat: '' },
              { label: 'Tribunais SAJ (16 TJs)', key: 'Tribunais Estaduais — SAJ', keyword: 'esaj', cat: '' },
              { label: 'TJMG', key: 'TJMG', keyword: 'tjmg', cat: '' },
              { label: 'TJRJ', key: 'TJRJ', keyword: 'tjrj', cat: '' },
              { label: 'TJRS / TJPR / TJPE e outros', key: 'Tribunais Estaduais — Demais', keyword: 'tjrs|tjpr|tjpe|tjgo|tjmt|tjpa|tjpb', cat: '' },
              { label: 'STJ / STF / TST / TRF / TRT', key: 'Tribunais Superiores e Federais', keyword: 'stj|stf|tst|trf|trt', cat: '' },
              { label: 'DataJud / CNJ (por número)', key: 'DataJud / CNJ', keyword: 'datajud', cat: '' },
              { label: 'Escavador (todos os tribunais)', key: 'Escavador (Processos Judiciais)', keyword: 'escavador', cat: '' },
              { label: 'Sanções Internacionais (OFAC/ONU/UE)', key: 'Sanções Internacionais (OFAC/ONU/UE)', keyword: 'ofac|opensanctions', cat: '' },
              { label: 'IBAMA — Infrações Ambientais', key: 'IBAMA — Infrações Ambientais', keyword: 'ibama', cat: '' },
              { label: 'CVM — Mercado de Capitais', key: 'CVM — Mercado de Capitais', keyword: 'cvm', cat: '' },
              { label: 'Mídia Negativa', key: 'Mídia Negativa', keyword: '', cat: 'MIDIA' },
            ].map(engine => {
              const count = engine.cat
                ? data.findings.filter(f => f.categoria === engine.cat).length
                : data.findings.filter(f => new RegExp(engine.keyword, 'i').test(f.fonte)).length
              const engineStatus = (data.resumo as any)?._engines?.[engine.key] as { success: boolean; error?: string } | undefined

              let icon = <MinusCircle className="h-4 w-4 text-gray-300 flex-shrink-0" />
              let statusText = 'Não consultado'
              let cardBg = 'bg-gray-50'

              if (engineStatus) {
                if (!engineStatus.success) {
                  icon = <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                  statusText = engineStatus.error?.includes('Chave') || engineStatus.error?.includes('configurad')
                    ? 'Chave de API não configurada'
                    : engineStatus.error?.includes('Nome obrigatório')
                    ? 'Informe o nome na consulta'
                    : (engineStatus.error || 'Falha ao consultar')
                  cardBg = 'bg-amber-50'
                } else if (count > 0) {
                  icon = <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  statusText = `${count} ocorrência(s) encontrada(s)`
                  cardBg = 'bg-red-50'
                } else {
                  icon = <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  statusText = 'Consultado — sem ocorrências'
                  cardBg = 'bg-green-50'
                }
              }

              return (
                <div key={engine.label} className={`flex items-start gap-2 p-3 ${cardBg} rounded-lg`}>
                  <div className="mt-0.5">{icon}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700">{engine.label}</p>
                    <p className="text-[11px] text-gray-400 truncate" title={statusText}>{statusText}</p>
                  </div>
                </div>
              )
            })}
          </div>
          {Object.values((data.resumo as any)?._engines || {}).some((e: any) => !e.success) && (
            <p className="mt-3 text-[11px] text-amber-600 bg-amber-50 rounded-lg p-2 no-print">
              ⚠ Alguns engines falharam. Configure <strong>TRANSPARENCIA_API_KEY</strong> para ativar Portal Transparência, PGFN e PEP. Tribunais estaduais requerem browser real e não funcionam em servidores externos.
            </p>
          )}
        </div>

      </div>
    </AppLayout>
  )
}
