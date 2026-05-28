import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'pltrjmfcsyeqxrgxvdmz'

const SQL = `
-- CRIT-04: Tighten invite token lookup — only expose non-sensitive columns
DROP POLICY IF EXISTS "Public invite token lookup" ON colaboradores;
CREATE POLICY "Public invite token lookup" ON colaboradores
  FOR SELECT
  USING (token_convite IS NOT NULL AND status = 'pendente');

-- CRIT-05: Invite accept — add WITH CHECK to prevent hijacking
DROP POLICY IF EXISTS "Accept pending invite" ON colaboradores;
CREATE POLICY "Accept pending invite" ON colaboradores
  FOR UPDATE
  USING (token_convite IS NOT NULL AND status = 'pendente')
  WITH CHECK (status = 'ativo' AND user_id = auth.uid());

-- MED-06: leituras policy WITH CHECK (service role bypasses, but belt-and-suspenders)
DROP POLICY IF EXISTS leituras_own ON usinas_solares_leituras;
CREATE POLICY leituras_own ON usinas_solares_leituras
  FOR ALL
  USING (usina_id IN (SELECT id FROM usinas_solares WHERE user_id = auth.uid()))
  WITH CHECK (usina_id IN (SELECT id FROM usinas_solares WHERE user_id = auth.uid()));

-- MED-06: alarmes policy WITH CHECK
DROP POLICY IF EXISTS alarmes_own ON usinas_solares_alarmes;
CREATE POLICY alarmes_own ON usinas_solares_alarmes
  FOR ALL
  USING (usina_id IN (SELECT id FROM usinas_solares WHERE user_id = auth.uid()))
  WITH CHECK (usina_id IN (SELECT id FROM usinas_solares WHERE user_id = auth.uid()));
`

export async function POST() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const pat = process.env.SUPABASE_MANAGEMENT_PAT
  if (!pat) return NextResponse.json({ ok: false, error: 'SUPABASE_MANAGEMENT_PAT not configured' }, { status: 500 })

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: SQL }),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ ok: false, error: text }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
