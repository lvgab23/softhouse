import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  const nonIsoInUrl = [...url].filter(c => c.charCodeAt(0) > 255).map(c => ({ char: c, code: c.charCodeAt(0) }))
  const nonIsoInKey = [...key].filter(c => c.charCodeAt(0) > 255).map(c => ({ char: c, code: c.charCodeAt(0) }))

  return NextResponse.json({
    urlLength: url.length,
    urlExpected: 43,
    urlOk: url.length === 43 && nonIsoInUrl.length === 0,
    urlNonIso: nonIsoInUrl,
    urlFirst10Codes: [...url.substring(0, 10)].map(c => c.charCodeAt(0)),
    keyLength: key.length,
    keyExpected: 219,
    keyOk: key.length === 219 && nonIsoInKey.length === 0,
    keyNonIso: nonIsoInKey,
    keyFirst10Codes: [...key.substring(0, 10)].map(c => c.charCodeAt(0)),
  })
}
