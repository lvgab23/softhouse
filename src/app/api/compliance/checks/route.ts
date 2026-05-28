import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const { user, error } = await requireAuth()
  if (error) return error

  const supabase = await createClient()
  const { data, error: dbErr } = await (supabase as any)
    .from('compliance_checks')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (dbErr) return NextResponse.json({ error: 'Erro ao buscar consultas' }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const supabase = await createClient()

  // Remove findings e alertas relacionados primeiro
  await (supabase as any).from('compliance_findings').delete().eq('check_id', id).eq('user_id', user!.id)
  await (supabase as any).from('compliance_alerts').delete().eq('check_id', id).eq('user_id', user!.id)

  const { error: dbErr } = await (supabase as any)
    .from('compliance_checks')
    .delete()
    .eq('id', id)
    .eq('user_id', user!.id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
