import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 300

const SEV_ORDER: Record<string, number> = { CRITICO: 0, ALTO: 1, MEDIO: 2, BAIXO: 3, INFO: 4 }

function priorizar(list: any[], max: number): any[] {
  return [...list]
    .sort((a, b) => (SEV_ORDER[a.severidade] ?? 5) - (SEV_ORDER[b.severidade] ?? 5))
    .slice(0, max)
}

function formatFindings(list: any[]): string {
  if (list.length === 0) return 'Nenhum registro encontrado.'
  return list.map((f, i) =>
    `[${i + 1}] ${f.severidade} | ${f.titulo}\n` +
    `    ${f.descricao?.substring(0, 200) || 'N/A'}\n` +
    `    Fonte: ${f.fonte} | Status: ${f.status_ocorrencia || 'N/A'} | Data: ${f.data_ocorrencia || 'N/A'}`
  ).join('\n\n')
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth()
  if (error) return error

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 503 })
  }

  try {
    const supabase = await createClient()

    const { data: check } = await (supabase as any)
      .from('compliance_checks')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user!.id)
      .single()

    if (!check) return NextResponse.json({ error: 'Consulta não encontrada.' }, { status: 404 })

    const { data: findings } = await (supabase as any)
      .from('compliance_findings')
      .select('*')
      .eq('check_id', params.id)
      .order('severidade', { ascending: true })

    const allFindings: any[] = findings || []

    // Limita por categoria para não estourar o contexto
    const judiciais  = priorizar(allFindings.filter(f => f.categoria === 'JUDICIAL'),   20)
    const criminais  = priorizar(allFindings.filter(f => f.categoria === 'CRIMINAL'),    5)
    const sancoes    = priorizar(allFindings.filter(f => f.categoria === 'SANCAO'),      8)
    const financeiro = priorizar(allFindings.filter(f => f.categoria === 'FINANCEIRO'),  5)
    const ambiental  = priorizar(allFindings.filter(f => f.categoria === 'AMBIENTAL'),   5)
    const midia      = priorizar(allFindings.filter(f => f.categoria === 'MIDIA'),       5)

    const totalOriginal = allFindings.length
    const totalEnviado  = judiciais.length + criminais.length + sancoes.length + financeiro.length + ambiental.length + midia.length

    const nome   = check.nome || 'Analisado'
    const docFmt = check.tipo === 'CPF'
      ? `CPF ${String(check.documento).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`
      : `CNPJ ${String(check.documento).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}`

    const prompt = `Você é especialista sênior em compliance e gestão de risco para Family Offices brasileiros. Analise os dados abaixo e gere um relatório JSON completo.

ANALISADO: ${nome} | ${docFmt} | ${new Date(check.created_at).toLocaleDateString('pt-BR')}
Total de ocorrências: ${totalOriginal} (analisando as ${totalEnviado} mais relevantes)

── PROCESSOS JUDICIAIS (${judiciais.length} de ${allFindings.filter(f => f.categoria === 'JUDICIAL').length}) ──
${formatFindings(judiciais)}

── ANTECEDENTES CRIMINAIS (${criminais.length}) ──
${formatFindings(criminais)}

── SANÇÕES E IMPEDIMENTOS (${sancoes.length} de ${allFindings.filter(f => f.categoria === 'SANCAO').length}) ──
${formatFindings(sancoes)}

── SITUAÇÃO FINANCEIRA / PGFN (${financeiro.length}) ──
${formatFindings(financeiro)}

── INFRAÇÕES AMBIENTAIS (${ambiental.length}) ──
${formatFindings(ambiental)}

── MÍDIA NEGATIVA (${midia.length}) ──
${formatFindings(midia)}

── INSTRUÇÕES ──
POLO PROCESSUAL: infira pela classe — PASSIVO: Execução, Monitória, Cobrança, Ação Penal, Inquérito, Despejo, Busca e Apreensão. ATIVO: Mandado de Segurança, Habeas Corpus, Rescisória, Reclamação Trabalhista (PF). INDEFINIDO: sem dados suficientes.
TRIBUNAL: extraia da fonte (TJSP=São Paulo, TJRJ=Rio, TRF=federal, TST=trabalhista).
SCORE 0-100: criminal ativo passivo +35 (cap 70) | sanção gov. ativa +25 (cap 50) | dívida ativa federal +20 | cível ativo passivo +8 (cap 24) | trabalhista ativo +6 (cap 18) | encerrados +1 (cap 10) | mídia neg. +5 (cap 15).

Responda SOMENTE com JSON válido, sem texto antes ou depois:

{
  "score_ia": <0-100>,
  "nivel_risco": "<CRITICO|ALTO|MEDIO|BAIXO|LIMPO>",
  "resumo_executivo": "<3-4 frases objetivas sobre o perfil de risco>",
  "processos_analise": [
    {
      "numero": "<CNJ ou 'Não informado'>",
      "titulo": "<classe processual>",
      "tribunal": "<sigla — estado>",
      "polo": "<ATIVO|PASSIVO|INDEFINIDO>",
      "polo_descricao": "<ex: Réu em ação de execução>",
      "status": "<ATIVO|ENCERRADO>",
      "natureza": "<cível|criminal|trabalhista|fiscal|ambiental|família|empresarial|previdenciário|outro>",
      "do_que_se_trata": "<2-3 frases sobre o que é este processo juridicamente>",
      "possiveis_implicacoes": "<2-3 frases sobre impactos em patrimônio, crédito, reputação, liberdade>",
      "impacto_compliance": "<ALTO|MEDIO|BAIXO> — <justificativa>",
      "movimentacoes": "<última movimentação e quantidade se disponível>",
      "observacoes": "<detalhes adicionais relevantes>"
    }
  ],
  "analise_sancoes": "<parágrafo sobre sanções encontradas>",
  "analise_financeira": "<parágrafo sobre situação financeira e dívidas>",
  "pontos_atencao": ["<ponto 1>", "<ponto 2>"],
  "recomendacao_final": "<2-3 parágrafos com recomendação profissional e ações concretas>",
  "justificativa_score": "<como chegou ao score, fatores e pontos atribuídos>"
}`

    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Resposta inválida da IA')

    // Extrai JSON mesmo se a IA colocar texto antes/depois
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON não encontrado na resposta da IA. Tente novamente.')

    const analiseIA = JSON.parse(jsonMatch[0])

    const resumoAtual = check.resumo || {}
    await (supabase as any)
      .from('compliance_checks')
      .update({ resumo: { ...resumoAtual, _ai_analise: analiseIA } })
      .eq('id', params.id)

    return NextResponse.json({ success: true, analise: analiseIA })
  } catch (err: any) {
    console.error('[analisar] erro:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao gerar análise.' }, { status: 500 })
  }
}
