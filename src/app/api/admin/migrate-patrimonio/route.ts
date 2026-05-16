import { NextResponse } from 'next/server'

const PROJECT_REF = 'pltrjmfcsyeqxrgxvdmz'

const MIGRATION_SQL = `
ALTER TABLE patrimonios ADD COLUMN IF NOT EXISTS tipo_aquisicao TEXT;
ALTER TABLE patrimonios ADD COLUMN IF NOT EXISTS avista_valor NUMERIC;
ALTER TABLE patrimonios ADD COLUMN IF NOT EXISTS financiamento_valor NUMERIC;
ALTER TABLE patrimonios ADD COLUMN IF NOT EXISTS consorcio_valor NUMERIC;
ALTER TABLE patrimonios ADD COLUMN IF NOT EXISTS socio_aquisicao BOOLEAN DEFAULT FALSE;
ALTER TABLE patrimonios ADD COLUMN IF NOT EXISTS socio_aquisicao_nome TEXT;
ALTER TABLE patrimonios ADD COLUMN IF NOT EXISTS socio_aquisicao_valor NUMERIC;
`

const DESPESAS_SQL = `
CREATE TABLE IF NOT EXISTS despesas_operacionais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  projeto_id uuid REFERENCES projetos(id) ON DELETE SET NULL,
  valor numeric NOT NULL,
  data date NOT NULL,
  descricao text,
  categoria text DEFAULT 'outros',
  created_at timestamptz DEFAULT now()
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'despesas_operacionais' AND schemaname = 'public'
  ) THEN
    RETURN;
  END IF;
  PERFORM 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'despesas_operacionais' AND n.nspname = 'public' AND c.relrowsecurity = false;
  IF FOUND THEN
    EXECUTE 'ALTER TABLE despesas_operacionais ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'despesas_operacionais' AND policyname = 'users own despesas_operacionais'
  ) THEN
    CREATE POLICY "users own despesas_operacionais"
      ON despesas_operacionais FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
`

async function runSQL(sql: string): Promise<{ ok: boolean; error?: string }> {
  const pat = process.env.SUPABASE_MANAGEMENT_PAT
  if (!pat) return { ok: false, error: 'SUPABASE_MANAGEMENT_PAT not configured' }

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: text }
  }
  return { ok: true }
}

export async function POST() {
  const r1 = await runSQL(MIGRATION_SQL)
  if (!r1.ok) return NextResponse.json({ ok: false, error: r1.error }, { status: 500 })

  const r2 = await runSQL(DESPESAS_SQL)
  if (!r2.ok) return NextResponse.json({ ok: false, error: r2.error }, { status: 500 })

  return NextResponse.json({ ok: true })
}
