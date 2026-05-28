import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import { calcularScore } from '@/lib/compliance/score'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth()
  if (error) return error

  const supabase = await createClient()

  const checkRes = await (supabase as any)
    .from('compliance_checks')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user!.id)
    .single()

  if (checkRes.error || !checkRes.data) {
    return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 })
  }

  // Remove direto no banco todos os registros falsos de Acordos de Leniência sem dados
  // (API da CGU não filtra por CPF e retorna todos os acordos do banco com campos N/A)
  const { count } = await (supabase as any)
    .from('compliance_findings')
    .delete()
    .eq('check_id', params.id)
    .ilike('titulo', 'Acordo de Leniên%')
    .select('id', { count: 'exact', head: true })

  const findingsRes = await (supabase as any)
    .from('compliance_findings')
    .select('*')
    .eq('check_id', params.id)
    .order('severidade', { ascending: true })

  const findings: any[] = findingsRes.data || []
  const removed = typeof count === 'number' ? count : 0

  // Se removeu registros falsos, recalcula score e atualiza o check
  if (removed > 0) {
    const { score, nivel } = calcularScore(findings)
    const resumoAtual = checkRes.data.resumo || {}
    const novoResumo = {
      ...resumoAtual,
      sancao:     findings.filter((f: any) => f.categoria === 'SANCAO').length,
      judicial:   findings.filter((f: any) => f.categoria === 'JUDICIAL').length,
      criminal:   findings.filter((f: any) => f.categoria === 'CRIMINAL').length,
      trabalhista:findings.filter((f: any) => f.categoria === 'TRABALHISTA').length,
      financeiro: findings.filter((f: any) => f.categoria === 'FINANCEIRO').length,
      ambiental:  findings.filter((f: any) => f.categoria === 'AMBIENTAL').length,
      midia:      findings.filter((f: any) => f.categoria === 'MIDIA').length,
      total:      findings.length,
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
