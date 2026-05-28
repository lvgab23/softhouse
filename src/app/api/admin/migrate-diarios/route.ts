import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'pltrjmfcsyeqxrgxvdmz'

const SQL = `
CREATE TABLE IF NOT EXISTS diarios_monitorados (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  termo text NOT NULL,
  tipo text NOT NULL DEFAULT 'nome' CHECK (tipo IN ('nome', 'cpf', 'cnpj', 'empresa')),
  ativo boolean DEFAULT true,
  ultima_busca timestamptz,
  total_resultados int DEFAULT 0,
  novos_resultados int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, termo)
);

CREATE TABLE IF NOT EXISTS diarios_resultados (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  monitorado_id uuid REFERENCES diarios_monitorados(id) ON DELETE CASCADE,
  fonte text NOT NULL,
  fonte_tipo text DEFAULT 'municipal',
  data_publicacao date,
  titulo text,
  resumo text,
  url text,
  lido boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diarios_monitorados_user ON diarios_monitorados(user_id);
CREATE INDEX IF NOT EXISTS idx_diarios_resultados_monitorado ON diarios_resultados(monitorado_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diarios_resultados_lido ON diarios_resultados(monitorado_id, lido);

ALTER TABLE diarios_monitorados ENABLE ROW LEVEL SECURITY;
ALTER TABLE diarios_resultados ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'diarios_monitorados' AND policyname = 'users own diarios_monitorados'
  ) THEN
    CREATE POLICY "users own diarios_monitorados" ON diarios_monitorados
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'diarios_resultados' AND policyname = 'users own diarios_resultados'
  ) THEN
    CREATE POLICY "users own diarios_resultados" ON diarios_resultados
      FOR ALL USING (
        monitorado_id IN (SELECT id FROM diarios_monitorados WHERE user_id = auth.uid())
      );
  END IF;
END $$;
`

export async function GET() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const pat = process.env.SUPABASE_MANAGEMENT_PAT
  if (!pat) return NextResponse.json({ ok: false, error: 'SUPABASE_MANAGEMENT_PAT not configured' }, { status: 500 })

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: SQL }),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ ok: false, error: text }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
