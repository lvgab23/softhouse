import { NextResponse } from 'next/server'
import { Client } from 'pg'

const SQL = `
CREATE TABLE IF NOT EXISTS usinas_solares_leituras (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  usina_id uuid NOT NULL REFERENCES usinas_solares(id) ON DELETE CASCADE,
  data date NOT NULL,
  kwh numeric(10,3) NOT NULL DEFAULT 0,
  potencia_pico_kw numeric(10,3),
  eficiencia numeric(6,2),
  source text DEFAULT 'api',
  created_at timestamptz DEFAULT now(),
  UNIQUE(usina_id, data)
);

CREATE INDEX IF NOT EXISTS idx_leituras_usina_data ON usinas_solares_leituras(usina_id, data DESC);

ALTER TABLE usinas_solares_leituras ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'usinas_solares_leituras' AND policyname = 'leituras_own'
  ) THEN
    CREATE POLICY leituras_own ON usinas_solares_leituras
      USING (usina_id IN (SELECT id FROM usinas_solares WHERE user_id = auth.uid()));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS usinas_solares_alarmes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  usina_id uuid NOT NULL REFERENCES usinas_solares(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  severidade text NOT NULL DEFAULT 'warning',
  descricao text,
  ativo boolean DEFAULT true,
  notificado boolean DEFAULT false,
  notificado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  resolvido_em timestamptz
);

CREATE INDEX IF NOT EXISTS idx_alarmes_usina_ativo ON usinas_solares_alarmes(usina_id, ativo);

ALTER TABLE usinas_solares_alarmes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'usinas_solares_alarmes' AND policyname = 'alarmes_own'
  ) THEN
    CREATE POLICY alarmes_own ON usinas_solares_alarmes
      USING (usina_id IN (SELECT id FROM usinas_solares WHERE user_id = auth.uid()));
  END IF;
END $$;

ALTER TABLE usinas_solares ADD COLUMN IF NOT EXISTS email_alerta text;
ALTER TABLE usinas_solares ADD COLUMN IF NOT EXISTS whatsapp_numero text;
ALTER TABLE usinas_solares ADD COLUMN IF NOT EXISTS alertas_ativo boolean DEFAULT true;
`

export async function GET() {
  const dbUrl = process.env.DATABASE_URL

  if (!dbUrl) {
    return NextResponse.json({
      status: 'no_database_url',
      message: 'Adicione DATABASE_URL ao .env.local para executar a migração automaticamente.',
      instructions: [
        '1. Abra o Supabase Dashboard: https://supabase.com/dashboard/project/pltrjmfcsyeqxrgxvdmz/settings/database',
        '2. Copie a "Connection string" (modo URI)',
        '3. Adicione ao .env.local: DATABASE_URL=postgresql://postgres:[SUA-SENHA]@db.pltrjmfcsyeqxrgxvdmz.supabase.co:5432/postgres',
        '4. Reinicie o servidor e acesse /api/admin/migrate novamente',
        '',
        'Alternativa: cole o SQL abaixo no SQL Editor do Supabase Dashboard.',
      ],
      sql: SQL.trim(),
    }, { status: 200 })
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    await client.query(SQL)
    await client.end()
    return NextResponse.json({ status: 'ok', message: 'Migração aplicada com sucesso! Tabelas criadas.' })
  } catch (err: any) {
    await client.end().catch(() => {})
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 })
  }
}
