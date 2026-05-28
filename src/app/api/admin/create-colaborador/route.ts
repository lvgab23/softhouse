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

  const { email, password, nome, nivel, permissoes } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'email e password são obrigatórios' }, { status: 400 })
  }

  const sb = adminClient()

  let userId: string

  // Tenta criar — se já existir, busca e atualiza
  const { data: created, error: createError } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: nome || null, primeiro_acesso: true },
  })

  if (createError) {
    if (!createError.message.toLowerCase().includes('already been registered') &&
        !createError.message.toLowerCase().includes('already exists')) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    // Usuário já existe — busca pelo e-mail
    const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 })
    const existing = list?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!existing) {
      return NextResponse.json({ error: 'Usuário não encontrado após conflito de e-mail.' }, { status: 500 })
    }

    // Atualiza senha e reativa flag de primeiro acesso
    await sb.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: { ...existing.user_metadata, nome: nome || existing.user_metadata?.nome, primeiro_acesso: true },
    })

    userId = existing.id
  } else {
    userId = created.user.id
  }

  // Upsert na tabela colaboradores (cobre casos de tentativa anterior de convite)
  const { error: upsertError } = await (sb as any).from('colaboradores').upsert(
    {
      user_id: userId,
      owner_id: adminUser.id,
      owner_user_id: adminUser.id,
      email,
      nome: nome || null,
      nivel,
      status: 'ativo',
      permissoes,
    },
    { onConflict: 'user_id' }
  )

  if (upsertError) {
    // Se não houver conflito por user_id, tenta insert simples
    const { error: insertError } = await sb.from('colaboradores').insert({
      user_id: userId,
      owner_id: adminUser.id,
      owner_user_id: adminUser.id,
      email,
      nome: nome || null,
      nivel,
      status: 'ativo',
      permissoes,
    })
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
