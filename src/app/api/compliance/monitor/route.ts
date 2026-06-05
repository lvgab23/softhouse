import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'

function proximaVerificacao(frequencia: string): Date {
  const d = new Date()
  if (frequencia === 'diaria') d.setDate(d.getDate() + 1)
  else if (frequencia === 'mensal') d.setMonth(d.getMonth() + 1)
  else d.setDate(d.getDate() + 7) // semanal (default)
  return d
}

// GET — lista documentos monitorados
export async function GET() {
  const { user, error } = await requireAuth()
  if (error) return error

  const supabase = await createClient()
  const { data, error: dbErr } = await (supabase as any)
    .from('compliance_monitored')
    .select('*')    .order('created_at', { ascending: false })

  if (dbErr) return NextResponse.json({ error: 'Erro ao buscar monitorados' }, { status: 500 })
  return NextResponse.json(data)
}

// POST — adicionar documento ao monitoramento
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const { documento, tipo, nome, frequencia = 'semanal' } = body as {
    documento: string
    tipo: 'CPF' | 'CNPJ'
    nome?: string
    frequencia?: string
  }

  if (!documento || !tipo) {
    return NextResponse.json({ error: 'documento e tipo são obrigatórios' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error: dbErr } = await (supabase as any)
    .from('compliance_monitored')
    .upsert(
      {
        user_id: user!.id,
        documento: documento.replace(/\D/g, ''),
        tipo,
        nome: nome || null,
        frequencia,
        ativo: true,
        proximo_verificacao: proximaVerificacao(frequencia).toISOString(),
      },
      { onConflict: 'user_id,documento' }
    )
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: 'Erro ao salvar monitoramento' }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE — remover documento do monitoramento
export async function DELETE(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const supabase = await createClient()
  const { error: dbErr } = await (supabase as any)
    .from('compliance_monitored')
    .delete()
    .eq('id', id)
  if (dbErr) return NextResponse.json({ error: 'Erro ao remover' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
