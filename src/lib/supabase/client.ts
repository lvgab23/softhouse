import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

// Strip BOM (U+FEFF) and non-printable chars — Vercel CLI on Windows injects BOM via stdin
const clean = (s: string = '') => s.replace(/^﻿/, '').replace(/[^\x20-\x7E]/g, '').trim()

export function createClient() {
  return createBrowserClient<Database>(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  )
}
