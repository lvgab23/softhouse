import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import { calcularScore } from '@/lib/compliance/score'

// Findings inválidos: Acordos de Leniência retornados sem dados (API CGU não filtra por CPF)
function isFindingValido(f: any): boolean {
  if (
    f.titulo === 'Acordo de Leniência — Lei Anticorrupção (12.846/2013)' &&
    f.descricao?.includes('Situação: N/A') &&
    f.descricao?.includes('Valor: N/A') &&
    f.descricao?.includes('Data celebração: N/A') &&
    f.descricao?.includes('Órgão: N/A')
  ) return false
  return true
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth()
  if (error) return error

  const supabase = await createClient()

  const [checkRes, findingsRes] = await Promise.all([
    (supabase as any)
      .from('compliance_checks')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user!.id)
      .single(),
    (supabase as any)
      .from('compliance_findings')
      .select('*')
      .eq('check_id', params.id)
      .order('severidade', { ascending: true }),
  ])

  if (checkRes.error || !checkRes.data) {
    return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 })
  }

  const allFindings: any[] = findingsRes.data || []
  const findings = allFindings.filter(isFindingValido)
  const invalidIds = allFindings.filter(f => !isFindingValido(f)).map(f => f.id)

  // Remove registros inválidos do banco e recalcula score
  if (invalidIds.length > 0) {
    await (supabase as any).from('compliance_findings').delete().in('id', invalidIds)

    const { score, nivel } = calcularScore(findings as any)
    const resumoAtual = checkRes.data.resumo || {}
    const novoResumo = {
      ...resumoAtual,
      sancao: findings.filter((f: any) => f.categoria === 'SANCAO').length,
      judicial: findings.filter((f: any) => f.categoria === 'JUDICIAL').length,
      criminal: findings.filter((f: any) => f.categoria === 'CRIMINAL').length,
      trabalhista: findings.filter((f: any) => f.categoria === 'TRABALHISTA').length,
      financeiro: findings.filter((f: any) => f.categoria === 'FINANCEIRO').length,
      ambiental: findings.filter((f: any) => f.categoria === 'AMBIENTAL').length,
      midia: findings.filter((f: any) => f.categoria === 'MIDIA').length,
      total: findings.length,
    }
    await (supabase as any)
      .from('compliance_checks')
      .update({ score_total: score, nivel_risco: nivel, resumo: novoResumo })
      .eq('id', params.id)

    return NextResponse.json({
      ...checkRes.data,
      score_total: score,
      nivel_risco: nivel,
      resumo: novoResumo,
      findings,
    })
  }

  return NextResponse.json({ ...checkRes.data, findings })
}
