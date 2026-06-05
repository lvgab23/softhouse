import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const { user, error } = await requireAuth()
  if (error) return error

  const supabase = await createClient()
  const { data, error: dbErr } = await (supabase as any)
    .from('compliance_alerts')
    .select('*, compliance_checks(documento, tipo, nome)')    .order('created_at', { ascending: false })
    .limit(100)

  if (dbErr) return NextResponse.json({ error: 'Erro ao buscar alertas' }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { ids, lido } = await req.json() as { ids: string[]; lido: boolean }
  const supabase = await createClient()

  await (supabase as any)
    .from('compliance_alerts')
    .update({ lido })
    .in('id', ids)
  return NextResponse.json({ ok: true })
}
