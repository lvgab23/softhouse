import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import { runCompliance } from '@/lib/compliance/orchestrator'

function proximaVerificacao(frequencia: string): Date {
  const d = new Date()
  if (frequencia === 'diaria') d.setDate(d.getDate() + 1)
  else if (frequencia === 'mensal') d.setMonth(d.getMonth() + 1)
  else d.setDate(d.getDate() + 7)
  return d
}

// POST — re-verifica um ou todos os documentos monitorados
// Body: { id?: string } — sem id = verifica todos vencidos
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const body = await req.json().catch(() => ({}))
  const { id } = body as { id?: string }

  const supabase = await createClient()

  // Busca monitorados ativos (um específico ou todos vencidos)
  let query = (supabase as any)
    .from('compliance_monitored')
    .select('*')
    .eq('user_id', user!.id)
    .eq('ativo', true)

  if (id) {
    query = query.eq('id', id)
  } else {
    query = query.or(`proximo_verificacao.is.null,proximo_verificacao.lte.${new Date().toISOString()}`)
  }

  const { data: monitorados, error: fetchErr } = await query
  if (fetchErr) return NextResponse.json({ error: 'Erro ao buscar monitorados' }, { status: 500 })
  if (!monitorados?.length) return NextResponse.json({ verificados: 0, resultados: [] })

  const resultados: any[] = []

  for (const mon of monitorados) {
    try {
      const result = await runCompliance(mon.documento, mon.tipo as 'CPF' | 'CNPJ')

      // Detecta mudança de score
      const mudanca_detectada =
        mon.score_ultimo !== null &&
        mon.score_ultimo !== undefined &&
        result.score_total !== mon.score_ultimo

      // Cria entrada no histórico (compliance_checks)
      const { data: check } = await (supabase as any)
        .from('compliance_checks')
        .insert({
          user_id: user!.id,
          documento: mon.documento,
          tipo: mon.tipo,
          nome: result.nome || mon.nome || null,
          status: 'done',
          score_total: result.score_total,
          nivel_risco: result.nivel_risco,
          resumo: result.resumo,
          concluido_em: new Date().toISOString(),
        })
        .select()
        .single()

      if (check && result.findings.length > 0) {
        await (supabase as any)
          .from('compliance_findings')
          .insert(result.findings.map((f: any) => ({ check_id: check.id, user_id: user!.id, ...f })))

        const importantes = result.findings.filter((f: any) => f.severidade === 'CRITICO' || f.severidade === 'ALTO')
        if (importantes.length > 0 && mudanca_detectada) {
          await (supabase as any).from('compliance_alerts').insert(
            importantes.map((f: any) => ({
              user_id: user!.id,
              check_id: check.id,
              titulo: `[MONITORAMENTO] ${f.severidade}: ${f.titulo}`,
              mensagem: f.descricao,
              severidade: f.severidade,
            }))
          )
        }
      }

      // Atualiza registro do monitoramento
      await (supabase as any)
        .from('compliance_monitored')
        .update({
          ultima_verificacao: new Date().toISOString(),
          proximo_verificacao: proximaVerificacao(mon.frequencia).toISOString(),
          score_ultimo: result.score_total,
          nivel_ultimo: result.nivel_risco,
          nome: result.nome || mon.nome || null,
          mudanca_detectada,
        })
        .eq('id', mon.id)

      resultados.push({ id: mon.id, documento: mon.documento, score: result.score_total, nivel: result.nivel_risco, mudanca_detectada })
    } catch (err: any) {
      resultados.push({ id: mon.id, documento: mon.documento, erro: err.message })
    }
  }

  return NextResponse.json({ verificados: resultados.length, resultados })
}
