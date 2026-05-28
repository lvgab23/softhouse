import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'medeiros.gabrielsmb@gmail.com'

export async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { user, error: null }
}

export async function requireAdmin() {
  const { user, error } = await requireAuth()
  if (error || !user) return { user: null, error: error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (user.email !== ADMIN_EMAIL) {
    return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, error: null }
}
