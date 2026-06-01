import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/api-auth'

const clean = (s: string = '') => s.replace(/^﻿/, '').replace(/[^\x20-\x7E]/g, '').trim()

function adminClient() {
  return createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  )
}

export async function POST(req: NextRequest) {
  const { user: adminUser, error: authError } = await requireAdmin()
  if (authError) return authError

  const { email, nivel, permissoes } = await req.json()

  if (!email) {
    return NextResponse.json({ error: 'E-mail é obrigatório' }, { status: 400 })
  }

  const sb = adminClient()

  // Busca usuário pelo e-mail na lista de auth users
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const existing = list?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase().trim())

  if (!existing) {
    return NextResponse.json({
      error: 'Nenhuma conta encontrada com este e-mail. Peça para a pessoa criar uma conta primeiro, ou use "Criar com senha".',
    }, { status: 404 })
  }

  // Garante que existe um profile para o usuário
  await (sb as any).from('profiles').upsert(
    { id: existing.id, email: existing.email, nome: existing.user_metadata?.nome || null },
    { onConflict: 'id' }
  )

  // Verifica se já é colaborador
  const { data: existente } = await (sb as any)
    .from('colaboradores')
    .select('id, status')
    .eq('user_id', existing.id)
    .eq('owner_id', adminUser.id)
    .maybeSingle()

  if (existente) {
    // Atualiza para ativo com as novas permissões
    const { error: updErr } = await (sb as any)
      .from('colaboradores')
      .update({ status: 'ativo', nivel: nivel || 'editor', permissoes: permissoes || {} })
      .eq('id', existente.id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, nome: existing.user_metadata?.nome || email.split('@')[0], reativado: true })
  }

  // Insere novo colaborador já ativo
  const { error: insertError } = await (sb as any).from('colaboradores').insert({
    user_id: existing.id,
    owner_id: adminUser.id,
    owner_user_id: adminUser.id,
    email: email.toLowerCase().trim(),
    nome: existing.user_metadata?.nome || email.split('@')[0],
    nivel: nivel || 'editor',
    status: 'ativo',
    permissoes: permissoes || {},
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, nome: existing.user_metadata?.nome || email.split('@')[0] })
}
