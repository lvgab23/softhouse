import { NextResponse } from 'next/server'

const clean = (s: string = '') => s.replace(/^﻿/, '').replace(/[^\x20-\x7E]/g, '').trim()

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const urlClean = clean(url)
  const keyClean = clean(key)

  return NextResponse.json({
    raw: {
      urlHasBom: url.charCodeAt(0) === 65279,
      keyHasBom: key.charCodeAt(0) === 65279,
    },
    cleaned: {
      urlOk: urlClean.length === 43 && urlClean.startsWith('https://'),
      keyOk: keyClean.length === 219 && keyClean.startsWith('eyJ'),
      urlLength: urlClean.length,
      keyLength: keyClean.length,
      urlFirst5: urlClean.substring(0, 5),
      keyFirst5: keyClean.substring(0, 5),
    }
  })
}
