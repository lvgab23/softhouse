import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

const PROJECT_REF = 'pltrjmfcsyeqxrgxvdmz'

const SQL = `
CREATE TABLE IF NOT EXISTS compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('CPF', 'CNPJ')),
  documento TEXT NOT NULL,
  nome TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error')),
  score_total INTEGER DEFAULT 0,
  nivel_risco TEXT DEFAULT 'LIMPO' CHECK (nivel_risco IN ('CRITICO', 'ALTO', 'MEDIO', 'BAIXO', 'LIMPO')),
  resumo JSONB DEFAULT '{}',
  erro TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  concluido_em TIMESTAMPTZ
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'compliance_checks' AND indexname = 'compliance_checks_user_id_created_at_idx') THEN
    CREATE INDEX compliance_checks_user_id_created_at_idx ON compliance_checks (user_id, created_at DESC);
  END IF;
END $$;

ALTER TABLE compliance_checks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'compliance_checks' AND policyname = 'users_own_compliance_checks') THEN
    CREATE POLICY users_own_compliance_checks ON compliance_checks FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE compliance_findings DROP CONSTRAINT IF EXISTS compliance_findings_categoria_check;
ALTER TABLE compliance_findings ADD CONSTRAINT compliance_findings_categoria_check
  CHECK (categoria IN ('JUDICIAL', 'CADASTRAL', 'TRABALHISTA', 'SANCAO', 'CRIMINAL', 'CREDITO', 'MIDIA', 'FINANCEIRO', 'AMBIENTAL'));

CREATE TABLE IF NOT EXISTS compliance_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID REFERENCES compliance_checks ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('JUDICIAL', 'CADASTRAL', 'TRABALHISTA', 'SANCAO', 'CRIMINAL', 'CREDITO', 'MIDIA', 'FINANCEIRO', 'AMBIENTAL')),
  severidade TEXT NOT NULL CHECK (severidade IN ('CRITICO', 'ALTO', 'MEDIO', 'BAIXO', 'INFO')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  fonte TEXT,
  fonte_url TEXT,
  data_ocorrencia TEXT,
  status_ocorrencia TEXT DEFAULT 'ATIVO',
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'compliance_findings' AND indexname = 'compliance_findings_check_id_idx') THEN
    CREATE INDEX compliance_findings_check_id_idx ON compliance_findings (check_id);
  END IF;
END $$;

ALTER TABLE compliance_findings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'compliance_findings' AND policyname = 'users_own_compliance_findings') THEN
    CREATE POLICY users_own_compliance_findings ON compliance_findings FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS compliance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  check_id UUID REFERENCES compliance_checks ON DELETE CASCADE,
  finding_id UUID REFERENCES compliance_findings ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  severidade TEXT NOT NULL CHECK (severidade IN ('CRITICO', 'ALTO', 'MEDIO', 'BAIXO', 'INFO')),
  lido BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'compliance_alerts' AND indexname = 'compliance_alerts_user_id_idx') THEN
    CREATE INDEX compliance_alerts_user_id_idx ON compliance_alerts (user_id, lido, created_at DESC);
  END IF;
END $$;

ALTER TABLE compliance_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'compliance_alerts' AND policyname = 'users_own_compliance_alerts') THEN
    CREATE POLICY users_own_compliance_alerts ON compliance_alerts FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
`

export async function GET() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const pat = process.env.SUPABASE_MANAGEMENT_PAT
  if (!pat) {
    return NextResponse.json({
      status: 'no_pat',
      message: 'SUPABASE_MANAGEMENT_PAT não configurado.',
      sql: SQL.trim(),
    })
  }

  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: SQL }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ status: 'error', message: JSON.stringify(data) }, { status: 500 })
    }

    return NextResponse.json({ status: 'ok', message: 'Tabelas de compliance criadas com sucesso!' })
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 })
  }
}
