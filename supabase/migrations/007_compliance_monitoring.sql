-- Monitoramento contínuo de compliance
CREATE TABLE IF NOT EXISTS compliance_monitored (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  documento text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('CPF', 'CNPJ')),
  nome text,
  ativo boolean DEFAULT true NOT NULL,
  frequencia text DEFAULT 'semanal' CHECK (frequencia IN ('diaria', 'semanal', 'mensal')),
  ultima_verificacao timestamptz,
  proximo_verificacao timestamptz,
  score_ultimo integer,
  nivel_ultimo text,
  mudanca_detectada boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, documento)
);

ALTER TABLE compliance_monitored ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own monitored" ON compliance_monitored
  FOR ALL USING (auth.uid() = user_id);
