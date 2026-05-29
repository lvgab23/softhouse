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

    // Remove sanções falsas (acordos de leniência sem filtro CPF da API da CGU)
    const filtered = allFindings.filter((f: any) =>
      !(f.categoria === 'SANCAO' && f.titulo?.toLowerCase().startsWith('acordo de leni'))
    )

    // Limita por categoria — mantém resposta dentro do max_tokens
    const judiciais  = priorizar(filtered.filter(f => f.categoria === 'JUDICIAL'),   5)
    const criminais  = priorizar(filtered.filter(f => f.categoria === 'CRIMINAL'),   3)
    const sancoes    = priorizar(filtered.filter(f => f.categoria === 'SANCAO'),     3)
    const financeiro = priorizar(filtered.filter(f => f.categoria === 'FINANCEIRO'), 2)
    const ambiental  = priorizar(filtered.filter(f => f.categoria === 'AMBIENTAL'),  2)
    const midia      = priorizar(filtered.filter(f => f.categoria === 'MIDIA'),      2)

    const totalOriginal = filtered.length
    const totalEnviado  = judiciais.length + criminais.length + sancoes.length + financeiro.length + ambiental.length + midia.length

    const nome   = check.nome || 'Analisado'
    const docFmt = check.tipo === 'CPF'
      ? `CPF ${String(check.documento).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`
      : `CNPJ ${String(check.documento).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}`

    const prompt = `Especialista compliance Family Office brasileiro. Analise e responda APENAS JSON válido.

ANALISADO: ${nome} | ${docFmt} | ${new Date(check.created_at).toLocaleDateString('pt-BR')}
Ocorrências: ${totalOriginal} total (${totalEnviado} mais relevantes abaixo)

PROCESSOS JUDICIAIS (${judiciais.length} de ${filtered.filter(f => f.categoria === 'JUDICIAL').length} total):
${formatFindings(judiciais)}
CRIMINAIS (${criminais.length}): ${formatFindings(criminais)}
SANÇÕES (${sancoes.length}): ${formatFindings(sancoes)}
FINANCEIRO (${financeiro.length}): ${formatFindings(financeiro)}
AMBIENTAL (${ambiental.length}): ${formatFindings(ambiental)}
MÍDIA (${midia.length}): ${formatFindings(midia)}

REGRAS DE POLO: PASSIVO=Execução/Monitória/Cobrança/Ação Penal/Inquérito/Despejo. ATIVO=MS/HC/Rescisória/Reclamação Trabalhista. INDEFINIDO=sem dados.
SCORE 0-100 (cumulativo com caps): criminal ativo passivo +35(cap70) | sanção ativa +25(cap50) | dívida federal +20 | cível ativo passivo +8(cap24) | trabalhista +6(cap18) | encerrados +1(cap10) | mídia +5(cap15). Considere CONTEXTO: advogado/procurador não é parte; processo encerrado há anos pesa menos.

JSON (sem texto antes/depois, strings curtas máx 200 chars cada):
{"score_ia":0,"nivel_risco":"LIMPO","resumo_executivo":"","processos_analise":[{"numero":"","titulo":"","tribunal":"","polo":"INDEFINIDO","polo_descricao":"","status":"ATIVO","natureza":"cível","resumo":"","impacto_compliance":"BAIXO"}],"analise_financeira":"","pontos_atencao":[""],"recomendacao_final":"","justificativa_score":""}`

    const anthropic = new Anthropic({ apiKey })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 5000,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Resposta inválida da IA')

    // Extrai JSON mesmo se a IA colocar texto antes/depois
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON não encontrado na resposta da IA. Tente novamente.')

    const analiseIA = JSON.parse(jsonMatch[0])

    const resumoAtual = check.resumo || {}

    // Salva análise e atualiza o score/nível com o score contextual da IA
    const updatePayload: any = {
      resumo: { ...resumoAtual, _ai_analise: analiseIA },
    }
    if (analiseIA.score_ia !== undefined) updatePayload.score_total = analiseIA.score_ia
    if (analiseIA.nivel_risco) updatePayload.nivel_risco = analiseIA.nivel_risco

    await (supabase as any)
      .from('compliance_checks')
      .update(updatePayload)
      .eq('id', params.id)

    return NextResponse.json({ success: true, analise: analiseIA })
  } catch (err: any) {
    console.error('[analisar] erro:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao gerar análise.' }, { status: 500 })
  }
}
