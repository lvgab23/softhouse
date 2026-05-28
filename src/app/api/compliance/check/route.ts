import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import { runCompliance } from '@/lib/compliance/orchestrator'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const { documento, tipo, processos, nome } = body as { documento: string; tipo: 'CPF' | 'CNPJ'; processos?: string[]; nome?: string }

  if (!documento || !tipo) {
    return NextResponse.json({ error: 'documento e tipo são obrigatórios' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: check, error: dbErr } = await (supabase as any)
    .from('compliance_checks')
    .insert({ user_id: user!.id, documento, tipo, status: 'running' })
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: 'Erro ao criar consulta' }, { status: 500 })

  try {
    const result = await runCompliance(documento, tipo, processos || [], nome || '')

    const enginesStatus = Object.fromEntries(
      Object.entries(result.engines).map(([name, e]) => [name, { success: e.success, error: e.error }])
    )

    await (supabase as any)
      .from('compliance_checks')
      .update({
        nome: result.nome || null,
        status: 'done',
        score_total: result.score_total,
        nivel_risco: result.nivel_risco,
        resumo: { ...result.resumo, _engines: enginesStatus },
        concluido_em: new Date().toISOString(),
      })
      .eq('id', check.id)

    if (result.findings.length > 0) {
      await (supabase as any).from('compliance_findings').insert(
        result.findings.map(f => ({ check_id: check.id, user_id: user!.id, ...f }))
      )

      const importantes = result.findings.filter(f => f.severidade === 'CRITICO' || f.severidade === 'ALTO')
      if (importantes.length > 0) {
        await (supabase as any).from('compliance_alerts').insert(
          importantes.map(f => ({
            user_id: user!.id,
            check_id: check.id,
            titulo: `${f.severidade}: ${f.titulo}`,
            mensagem: f.descricao,
            severidade: f.severidade,
          }))
        )
      }
    }

    return NextResponse.json({ id: check.id, ...result })
  } catch (err: any) {
    await (supabase as any)
      .from('compliance_checks')
      .update({ status: 'error', erro: err.message })
      .eq('id', check.id)
    return NextResponse.json({ error: 'Erro durante a análise', detalhe: err.message }, { status: 500 })
  }
}
