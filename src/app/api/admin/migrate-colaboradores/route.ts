import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'pltrjmfcsyeqxrgxvdmz'

const SQL = `
-- 1. Adicionar colunas que podem estar faltando
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente';
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS permissoes jsonb NOT NULL DEFAULT '{}';
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS token_convite text DEFAULT encode(gen_random_bytes(32), 'hex');
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Garantir que token_convite não seja nulo em registros existentes que não têm token
UPDATE colaboradores SET token_convite = encode(gen_random_bytes(32), 'hex') WHERE token_convite IS NULL;

-- 2. Tornar user_id nullable (colaboradores pendentes ainda não têm conta)
ALTER TABLE colaboradores ALTER COLUMN user_id DROP NOT NULL;

-- 3. Remover o CHECK constraint antigo do nivel e adicionar 'personalizado'
ALTER TABLE colaboradores DROP CONSTRAINT IF EXISTS colaboradores_nivel_check;
ALTER TABLE colaboradores ADD CONSTRAINT colaboradores_nivel_check
  CHECK (nivel IN ('admin', 'editor', 'visualizador', 'personalizado'));

-- 4. Habilitar RLS
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;

-- 5. Policy do owner (SELECT/INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "Owner manages colaboradores" ON colaboradores;
CREATE POLICY "Owner manages colaboradores" ON colaboradores
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 6. Policy pública para busca de convite por token (página /convite)
DROP POLICY IF EXISTS "Public invite token lookup" ON colaboradores;
CREATE POLICY "Public invite token lookup" ON colaboradores
  FOR SELECT USING (token_convite IS NOT NULL AND status = 'pendente');

-- 7. Policy para o colaborador aceitar o convite (UPDATE via token)
DROP POLICY IF EXISTS "Accept pending invite" ON colaboradores;
CREATE POLICY "Accept pending invite" ON colaboradores
  FOR UPDATE
  USING (token_convite IS NOT NULL AND status = 'pendente')
  WITH CHECK (status = 'ativo' AND user_id = auth.uid());
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
