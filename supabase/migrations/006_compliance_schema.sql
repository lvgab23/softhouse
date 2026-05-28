-- Compliance Module
-- Consultas de compliance (CPF/CNPJ)
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

ALTER TABLE compliance_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_compliance_checks" ON compliance_checks FOR ALL USING (auth.uid() = user_id);
CREATE INDEX ON compliance_checks (user_id, created_at DESC);

-- Achados por consulta
CREATE TABLE IF NOT EXISTS compliance_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID REFERENCES compliance_checks ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('JUDICIAL', 'CADASTRAL', 'TRABALHISTA', 'SANCAO', 'CRIMINAL', 'CREDITO', 'MIDIA')),
  severidade TEXT NOT NULL CHECK (severidade IN ('CRITICO', 'ALTO', 'MEDIO', 'BAIXO', 'INFO')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  fonte TEXT,
  fonte_url TEXT,
  data_ocorrencia TEXT,
  status_ocorrencia TEXT DEFAULT 'ATIVO',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE compliance_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_compliance_findings" ON compliance_findings FOR ALL USING (auth.uid() = user_id);
CREATE INDEX ON compliance_findings (check_id);

-- Alertas de compliance
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

ALTER TABLE compliance_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_compliance_alerts" ON compliance_alerts FOR ALL USING (auth.uid() = user_id);
CREATE INDEX ON compliance_alerts (user_id, lido, created_at DESC);
