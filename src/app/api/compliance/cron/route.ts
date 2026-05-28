import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runCompliance } from '@/lib/compliance/orchestrator'

export const maxDuration = 60

function proximaVerificacao(frequencia: string): Date {
  const d = new Date()
  if (frequencia === 'diaria') d.setDate(d.getDate() + 1)
  else if (frequencia === 'mensal') d.setMonth(d.getMonth() + 1)
  else d.setDate(d.getDate() + 7) // semanal (padrão)
  return d
}

// Endpoint chamado pelo Vercel Cron toda segunda-feira às 08h UTC
// Também aceita chamada manual via GET com CRON_SECRET no header Authorization
export async function GET(req: NextRequest) {
  // Verificação de segurança: Vercel envia header automaticamente, ou aceita segredo manual
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')

  const isVercelCron = req.headers.get('x-vercel-cron-signature') !== null
  const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isVercelCron && !hasValidSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Cliente Supabase com service role (acesso admin a todos os usuários)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Busca todos os documentos monitorados ativos com verificação vencida
  const { data: monitorados, error } = await supabase
    .from('compliance_monitored' as any)
    .select('*')
    .eq('ativo', true)
    .or(`proximo_verificacao.is.null,proximo_verificacao.lte.${new Date().toISOString()}`)
    .limit(20) // máx 20 por execução para não estourar o timeout de 60s

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!monitorados?.length) return NextResponse.json({ verificados: 0, mensagem: 'Nenhum documento vencido para verificar.' })

  const resultados: any[] = []

  for (const mon of monitorados) {
    try {
      const result = await runCompliance(mon.documento, mon.tipo as 'CPF' | 'CNPJ', [], mon.nome || '')

      const mudanca_detectada =
        mon.score_ultimo !== null &&
        mon.score_ultimo !== undefined &&
        result.score_total !== mon.score_ultimo

      // Registra nova verificação no histórico
      const { data: check } = await supabase
        .from('compliance_checks' as any)
        .insert({
          user_id: mon.user_id,
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
        await supabase
          .from('compliance_findings' as any)
          .insert(result.findings.map((f: any) => ({ check_id: (check as any).id, user_id: mon.user_id, ...f })))

        // Alerta só se score mudou ou se tem ocorrências críticas novas
        if (mudanca_detectada || result.nivel_risco === 'CRITICO' || result.nivel_risco === 'ALTO') {
          const importantes = result.findings.filter((f: any) => f.severidade === 'CRITICO' || f.severidade === 'ALTO')
          if (importantes.length > 0) {
            await supabase
              .from('compliance_alerts' as any)
              .insert(importantes.slice(0, 5).map((f: any) => ({
                user_id: mon.user_id,
                check_id: (check as any).id,
                titulo: `[MONITORAMENTO SEMANAL] ${f.severidade}: ${f.titulo}`,
                mensagem: f.descricao,
                severidade: f.severidade,
              })))
          }
        }
      }

      // Atualiza o registro de monitoramento
      await supabase
        .from('compliance_monitored' as any)
        .update({
          ultima_verificacao: new Date().toISOString(),
          proximo_verificacao: proximaVerificacao(mon.frequencia).toISOString(),
          score_ultimo: result.score_total,
          nivel_ultimo: result.nivel_risco,
          nome: result.nome || mon.nome || null,
          mudanca_detectada,
        })
        .eq('id', mon.id)

      resultados.push({
        documento: mon.documento,
        nome: result.nome || mon.nome,
        score: result.score_total,
        nivel: result.nivel_risco,
        mudanca_detectada,
      })
    } catch (err: any) {
      resultados.push({ documento: mon.documento, erro: err.message })
    }
  }

  return NextResponse.json({
    executado_em: new Date().toISOString(),
    verificados: resultados.length,
    resultados,
  })
}
