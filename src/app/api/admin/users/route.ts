import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ADMIN_EMAIL = 'medeiros.gabrielsmb@gmail.com'

async function getCallerEmail(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await sb.auth.getUser()
    return user?.email ?? null
  } catch { return null }
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const email = await getCallerEmail()
  if (email !== ADMIN_EMAIL)
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const supabase = adminClient()

  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users = data.users.map(u => ({
    id:             u.id,
    email:          u.email,
    created_at:     u.created_at,
    last_sign_in:   u.last_sign_in_at,
    confirmed:      !!u.email_confirmed_at,
    banned:         u.banned ?? false,
    provider:       u.app_metadata?.provider || 'email',
  }))

  return NextResponse.json({ users })
}

export async function DELETE(req: NextRequest) {
  const email = await getCallerEmail()
  if (email !== ADMIN_EMAIL)
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const supabase = adminClient()

  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
